# Answers: Containerising the Node App with Docker

All numbers below were measured on a MacBook with Apple silicon (arm64), Docker Desktop with
Docker Engine 29.9.2 (client and server), containerd image store. Images are `linux/arm64`.
On an Intel machine the sizes will be close but not identical.

The project in this folder is the handout project plus:

| File | Why |
| --- | --- |
| `Dockerfile` | Part 1, unchanged from the guide (`FROM node:26`) |
| `Dockerfile.multistage` | Part 2, unchanged from the guide |
| `Dockerfile.slim` | Exercise 4: the multistage file with `nginx:stable-alpine-slim` in stage 2 |
| `.dockerignore` | Section 1, unchanged from the guide |
| `.gitignore` | Generated files: `node_modules/`, `dist/`, Playwright output, `.DS_Store` |

## 0. Setup

```
$ docker --version
Docker version 29.9.2, build a82e528

$ docker run --rm hello-world
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

## Part 1: A simple Dockerfile

### 1–2. `.dockerignore` and `Dockerfile`

Both are exactly as in the guide. The `.dockerignore` matters: with it the build context sent to
the builder is **36.35 kB**. Without the `node_modules` line it is **50.15 MB** (see exercise 2).

### 3. Build the image

```
docker build -t node-auth-app:simple .
```

| Build | Time | What happened |
| --- | --- | --- |
| First build | 55.8 s | Pulled `node:26` (about 490 MB compressed), `npm ci` took 3.3 s, unpacking the image took 9.5 s |
| Second build, nothing changed | 2.2 s | Every step says `CACHED` |

Second build output:

```
#7 [2/5] WORKDIR /app
#7 CACHED
#8 [3/5] COPY package.json package-lock.json ./
#8 CACHED
#9 [4/5] RUN npm ci
#9 CACHED
#10 [5/5] COPY . .
#10 CACHED
```

### 4. Run a container

```
docker run --rm -p 5173:5173 node-auth-app:simple
```

The container logs show the Vite dev server listening on all interfaces:

```
> node-auth-app@1.0.0 dev
> vite --port 5173 --strictPort --host 0.0.0.0

  VITE v8.3.5  ready in 148 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://172.17.0.2:5173/  eth0
```

`curl http://localhost:5173` from the Mac returns the page, with the
`<script type="module" src="/@vite/client">` tag that only the dev server injects.

### 5. Confirm with the Playwright tests

```
docker run --rm -d -p 5173:5173 --name auth-app node-auth-app:simple
npx playwright test
docker stop auth-app
```

```
Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/auth.spec.js:19:1 › registered user can log in (707ms)
  ✓  2 [chromium] › tests/auth.spec.js:27:1 › login with invalid credentials shows an error (357ms)

  2 passed (4.5s)
```

Locally this needed `npm ci` and `npx playwright install chromium` once, so that the test
runner and a browser exist on the Mac. The app itself ran in the container: port 5173 was
already taken by it, so `reuseExistingServer: true` made Playwright test the container.

## Part 2: Multi-stage build and image size

### 6. The problem

```
$ docker images node-auth-app
IMAGE                  ID             DISK USAGE   CONTENT SIZE
node-auth-app:simple   8747197aee61       1.96GB          493MB
```

1.96 GB on disk for an app whose built output is a few kB:

```
$ npm run build
dist/index.html                 0.46 kB │ gzip: 0.31 kB
dist/assets/index-DaD-j0B4.css  0.80 kB │ gzip: 0.41 kB
dist/assets/index-Br8_pVzO.js   3.74 kB │ gzip: 1.76 kB
✓ built in 294ms
```

The three files add up to 5,013 bytes (`du -sh dist` shows 12 KB, because of disk block size).

### 7. A smaller base image

I changed the first line to `FROM node:26-alpine`, built, and changed it back
(the `Dockerfile` in this folder is back to `FROM node:26`):

```
docker build -t node-auth-app:alpine .      # 18.4 s, including the pull of node:26-alpine
```

Result: **429 MB** on disk, 127 MB content size. A lot better than 1.96 GB, but still a dev
server with Node, npm and `node_modules`.

### 8–9. Multi-stage build, run and confirm

```
docker build -f Dockerfile.multistage -t node-auth-app:multistage .
```

It took 6.3 s. The interesting part: all the `builder` steps up to `COPY . .` said `CACHED`,
because the `:alpine` image had just run the same instructions on the same base
(`node:26-alpine`). Only `RUN npm run build` (0.7 s) and the nginx stage were new.

```
docker run --rm -d -p 5173:80 --name auth-app node-auth-app:multistage
npx playwright test
docker stop auth-app
```

```
HTTP/1.1 200 OK
Server: nginx/1.30.6

  ✓  1 [chromium] › tests/auth.spec.js:19:1 › registered user can log in (621ms)
  ✓  2 [chromium] › tests/auth.spec.js:27:1 › login with invalid credentials shows an error (259ms)

  2 passed (2.0s)
```

Same tests, unchanged, `2 passed`. Only the port mapping changed (`5173:80`).

### 10. Compare the sizes

```
$ docker images node-auth-app
IMAGE                      ID             DISK USAGE   CONTENT SIZE
node-auth-app:alpine       df721cc9f67a        429MB          127MB
node-auth-app:multistage   858e73082d5f       92.2MB           26MB
node-auth-app:simple       f4cbbdf04467       1.96GB          493MB
node-auth-app:slim         eebaefd23812       21.4MB         6.11MB
```

| Tag | Base image | Disk usage (mine) | Content size (mine) | Rough expectation (unpacked) |
| --- | --- | --- | --- | --- |
| `simple` | `node:26` | **1.96 GB** | 493 MB | > 1 GB |
| `alpine` | `node:26-alpine` | **429 MB** | 127 MB | ~ 250–300 MB |
| `multistage` | `nginx:stable-alpine` | **92.2 MB** | 26 MB | ~ 50 MB |
| `slim` (exercise 4) | `nginx:stable-alpine-slim` | **21.4 MB** | 6.11 MB | — |

`multistage` is about **21× smaller** than `simple` on disk (19× in content size).

My `alpine` and `multistage` numbers are above the guide's rough figures:

- `alpine`: the Node layer of `node:26-alpine` alone is 180 MB, and `npm ci` adds 113 MB
  (see below).
- `multistage`: the current `nginx:stable-alpine` image ships extra nginx modules (njs, acme,
  geoip, image-filter, xslt) and their libraries. Its main `RUN` layer is 51 MB and it has
  71 Alpine packages installed. That is exactly what exercise 4 removes.

#### Layers: `docker history`

`node-auth-app:simple` (trimmed):

```
CREATED BY                                      SIZE
CMD ["npm" "run" "dev" "--" "--host" "0.0.0.…   0B
EXPOSE [5173/tcp]                               0B
COPY . . # buildkit                             45.1kB
RUN /bin/sh -c npm ci # buildkit                113MB
COPY package.json package-lock.json ./          41kB
WORKDIR /app                                    8.19kB
...                                             (node:26 base image below)
RUN ... dpkgArch="$(dpkg --p…  (Node itself)    240MB
RUN ... apt-get update;  ap…   (build tools)    681MB
RUN ... apt-get update;  a…                     208MB
RUN ... apt-get update;  a…                     63.7MB
# debian.sh --arch 'arm64' out/ 'trixie'        156MB
```

The base image is about 1.35 GB of the 1.96 GB, and `npm ci` is the biggest layer we add
(113 MB). Inside the container that layer is 77 MB of `node_modules` (close to the guide's
~80 MB; `@rolldown` alone is 37 MB) plus 29 MB of npm cache in `/root/.npm`. The code
(`COPY . .`) is 45 kB.

`node-auth-app:multistage` (trimmed):

```
CREATED BY                                      SIZE
EXPOSE [80/tcp]                                 0B
COPY /app/dist /usr/share/nginx/html # build…   36.9kB
RUN /bin/sh -c set -x && apkArch="$(cat …       51MB      (nginx + modules)
...
RUN /bin/sh -c set -x && addgroup -g 101…       5.84MB
ADD alpine-minirootfs-3.24.4-aarch64.tar.gz     9.31MB
```

As the guide says, the `COPY --from=builder` layer is tiny: 36.9 kB.
None of the builder stage (Node, npm, `node_modules`, npm cache) is in the final image.

## 11. Exercises

### Exercise 1: Cache in action

**Change a text in `src/main.js`** (`"Create an account"` → `"Create your account"`), rebuild
`:simple`:

```
#6 [2/5] WORKDIR /app
#6 CACHED
#7 [3/5] COPY package.json package-lock.json ./
#7 CACHED
#8 [4/5] RUN npm ci
#8 CACHED
#9 [5/5] COPY . .
#9 DONE 0.0s
```

Total: **1.3 s**. `WORKDIR`, `COPY package*.json` and `RUN npm ci` are `CACHED`. Only
`COPY . .` runs again, because a file it copies changed. This is why the dependency files are
copied before the code.

**Add a dependency.** I tried two ways.

1. Editing `package.json` by hand (adding `"dependencies": { "ms": "^2.1.3" }`) without
   touching the lock file. The `COPY package.json package-lock.json` step is no longer cached,
   and `npm ci` **fails**:

   ```
   npm error `npm ci` can only install packages when your package.json and package-lock.json
   or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before
   continuing.
   npm error Missing: ms@2.1.3 from lock file
   ```

   `npm ci` refuses to install anything the lock file does not pin. That is the point of it:
   the image gets exactly the versions in `package-lock.json`, or nothing.

2. The right way: `npm install ms` on the host, which updates both `package.json` and
   `package-lock.json` (+9 lines in the lock file). Rebuild:

   ```
   #6 [2/5] WORKDIR /app
   #6 CACHED
   #7 [3/5] COPY package.json package-lock.json ./
   #7 DONE 0.0s
   #8 [4/5] RUN npm ci
   #8 1.913 added 21 packages, and audited 22 packages in 2s
   #8 DONE 2.1s
   #9 [5/5] COPY . .
   #9 DONE 0.0s
   ```

   Total: **5.9 s**. Only `WORKDIR` is cached. Changing `package*.json` invalidates the
   `COPY package*.json` layer, and **every layer after it** is rebuilt, so `npm ci` runs again
   from scratch and reinstalls all packages (not just `ms`). `COPY . .` also reruns because
   its parent layer changed. Here `npm ci` is fast (2 s, 21 packages); in a project with
   hundreds of dependencies this is the step that takes minutes.

Afterwards `src/main.js`, `package.json` and `package-lock.json` were restored to the
originals and `:simple` was rebuilt.

### Exercise 2: Break the ignore file

I removed the `node_modules` line from `.dockerignore`, ran `npm install` on the Mac (49 MB of
`node_modules`), and rebuilt (tag `no-ignore`, so `:simple` stayed clean):

| | Build context sent | Image size |
| --- | --- | --- |
| With `node_modules` ignored | 36.35 kB | 1.96 GB |
| Without | **50.15 MB** (0.7 s to transfer) | **2.02 GB** (`COPY . .` layer 45.1 kB → 51.7 MB) |

**Does the build get slower?** Yes: the whole `node_modules` folder is sent to the builder on
every build (0.7 s just for the transfer here, the full build went from 1.3 s to 3.2 s), and the
`COPY . .` layer grows from 45 kB to 52 MB. On a bigger project, or with a remote builder,
this is seconds to minutes per build. Any local `npm install` also invalidates the
`COPY . .` layer, even if no source file changed.

**Why is it risky?** `node_modules` contains native binaries built for the host OS. On the Mac,
npm installed only the macOS ones:

```
node_modules/@rolldown/binding-darwin-arm64/rolldown-binding.darwin-arm64.node:
  Mach-O 64-bit arm64 dynamically linked shared library
node_modules/lightningcss-darwin-arm64
node_modules/fsevents                   (macOS-only package)
```

The container is Linux and cannot load a Mach-O library. To show it, I ran Linux Node against
the Mac's `node_modules` (mounted read-only) and loaded Vite's bundler:

```
$ docker run --rm -v "$PWD":/app:ro -w /app node:26 node -e 'import("rolldown")...'
ERROR: Cannot find native binding. npm has a bug related to optional dependencies ...
```

In this build the app still started, but only by luck: `COPY . .` **merges** the host folder
on top of the Linux `node_modules` from `npm ci`. The Linux bindings
(`binding-linux-arm64-gnu`) are still there, next to the macOS ones that were added. Every file
that exists on both sides, though, is now the host's copy: package code, `.bin` links,
`.package-lock.json`, and any native module that is built into the same path on every OS
(for example `build/Release/*.node` files from `node-gyp` packages like `bcrypt`). Those break
with errors like `invalid ELF header`. You also lose reproducibility: the image no longer
contains what `package-lock.json` says, but whatever happens to be on the developer's
machine, and it carries macOS-only packages (`fsevents`, `*-darwin-arm64`) that are useless
in Linux. That is why `node_modules` must stay in `.dockerignore` and the container installs
its own with `npm ci`.

The line was restored afterwards and the `no-ignore` image removed.

### Exercise 3: Inspect a container

With `node-auth-app:multistage` running as `auth-app`:

```
$ docker exec -it auth-app sh
/ # ls -la /usr/share/nginx/html /usr/share/nginx/html/assets
/usr/share/nginx/html:
-rw-r--r--    1 root     root           497 Oct  2 17:14 50x.html
drwxr-xr-x    2 root     root          4096 Nov  7 08:49 assets
-rw-r--r--    1 root     root           463 Nov  7 08:49 index.html

/usr/share/nginx/html/assets:
-rw-r--r--    1 root     root          3748 Nov  7 08:49 index-Br8_pVzO.js
-rw-r--r--    1 root     root           802 Nov  7 08:49 index-DaD-j0B4.css

/ # node --version
sh: node: not found
/ # which node npm          # prints nothing, exit code 1
/ # find / -name node_modules -type d    # no results
```

(I ran the same commands through `docker exec auth-app sh -c '...'`, since I was not in an
interactive terminal; the result is the same.)

**There is no Node, no npm and no `node_modules` anywhere in the image.** The folder has
only the three files from `dist/` (`index.html`, one JS and one CSS file) plus nginx's default
`50x.html` error page. The builder stage was thrown away; only `/app/dist` was copied out.

### Exercise 4: Even smaller?

`Dockerfile.slim` is `Dockerfile.multistage` with `FROM nginx:stable-alpine-slim` in stage 2.

```
docker build -f Dockerfile.slim -t node-auth-app:slim .
docker run --rm -d -p 5173:80 --name auth-app node-auth-app:slim
npx playwright test          # 2 passed (1.9s)
docker stop auth-app
```

| Tag | Disk usage | Content size | Alpine packages |
| --- | --- | --- | --- |
| `multistage` (`nginx:stable-alpine`) | 92.2 MB | 26 MB | 71 |
| `slim` (`nginx:stable-alpine-slim`) | **21.4 MB** | **6.11 MB** | 21 |

The slim image is **4.3× smaller** than `multistage` and about **90× smaller** than `simple`
(1.96 GB → 21.4 MB), and it still passes the same tests and runs the same nginx (1.30.6).
The builder stage was fully cached, so the build took 2.1 s.

The difference is what the non-slim image carries for features this app never uses: the
`curl` binary, the njs/acme/geoip/image-filter/xslt nginx modules and their libraries
(`libgd`, `libxml2`, `libxslt`, `libavif`, `libwebp`, `libx11`, fonts, ...). The slim image
keeps only nginx, musl, OpenSSL, BusyBox and a few base packages. For serving static files
that is all we need, and 50 fewer packages also means 50 fewer things that can have a CVE.
The trade-off: without `curl` you cannot write a `HEALTHCHECK` with `curl`, and you cannot use
those nginx modules.

## Cleanup

All containers were stopped (they ran with `--rm`, so they were also deleted); `docker ps -a`
is empty. I kept the images `node-auth-app:simple`, `:alpine`, `:multistage` and `:slim`
so the sizes can be compared again with `docker images node-auth-app`, plus `hello-world` and
`node:26`. To remove them:

```bash
docker rmi node-auth-app:simple node-auth-app:alpine node-auth-app:multistage node-auth-app:slim hello-world node:26
docker builder prune      # build cache
```
