# Containerising the Node App with Docker: solution guide

This lab packages the frontend-only auth app from lab 03 as a Docker image: first with a simple
Dockerfile that runs the Vite dev server, then with a multi-stage build that serves only the
compiled files with nginx, measuring the size at each step. You start from `starter.zip` (the
teacher's `node-auth-app.zip`), which already contains the handout's `Dockerfile`,
`Dockerfile.multistage` and `.dockerignore`, so most of the lab is building, running and
measuring them. `solution/` holds only `Dockerfile.slim`, the extra image from exercise 4.

All numbers below were measured on a MacBook with Apple silicon (arm64), Docker Desktop with
Docker Engine 29.9.2 (client and server) and the containerd image store, so the images are
`linux/arm64`. On an Intel machine the sizes will be close but not identical.

## 0. Vocabulary and setup

Unzip the starter and work from the `node-auth-app` folder: every command in this guide runs
there. The zip also contains a `__MACOSX` folder and a `.DS_Store` file added by macOS. You can
delete them; the app does not use them.

Check that Docker works:

```text
$ docker --version
Docker version 29.9.2, build a82e528

$ docker run --rm hello-world
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

## Part 1: A simple Dockerfile

### 1. Tell Docker what to ignore: `.dockerignore`

`node-auth-app/.dockerignore` (already in the starter, as in the handout):

```text
# Never copy these into the image: they are rebuilt inside it, or not needed.
node_modules
dist
test-results
playwright-report
.git
*.md
Dockerfile*
.dockerignore
```

`node_modules` and `dist` are rebuilt inside the image, and `node_modules` was installed for your
OS, not for Linux (exercise 2 shows why that matters). Test reports, `.git` and docs are not
needed to run the app. Leaving out `Dockerfile*` and `.dockerignore` means editing a Dockerfile
does not invalidate the `COPY . .` layer.

The build output reports the size of the build context (the folder sent to the builder) in its
`load build context` step. With this file it is **36.35 kB**. Without the `node_modules` line it
is **50.15 MB** (see exercise 2).

### 2. Write the Dockerfile

`node-auth-app/Dockerfile` (already in the starter, the handout's file plus comments):

```dockerfile
# Simple image: runs the Vite dev server inside a container.
FROM node:26

WORKDIR /app

# Dependencies first: this layer is cached until package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci

# Then the source code.
COPY . .

EXPOSE 5173

# --host 0.0.0.0 makes Vite reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

Why it is written this way:

- **Dependency files before the code.** A layer is only rebuilt if its inputs or a layer before
  it changed, so editing `src/main.js` leaves `npm ci` cached (exercise 1 measures this).
- **`npm ci`, not `npm install`.** It installs exactly the versions in `package-lock.json` and
  refuses to run if the lock file disagrees with `package.json`, so the image is reproducible.
- **`--host 0.0.0.0`.** The `dev` script is `vite --port 5173 --strictPort`; the `--` passes the
  extra flag through npm to Vite. Without it Vite only listens on the container's own
  `localhost`, which your browser cannot reach.
- **`EXPOSE 5173`** only documents the port. The `-p` flag of `docker run` publishes it.

### 3. Build the image

```bash
docker build -t node-auth-app:simple .
```

| Build | Time | What happened |
| --- | --- | --- |
| First build | 55.8 s | Pulled `node:26` (about 490 MB compressed), `npm ci` took 3.3 s, unpacking the image took 9.5 s |
| Second build, nothing changed | 2.2 s | Every step says `CACHED` |

The second build looks like this:

```text
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

```bash
docker run --rm -p 5173:5173 node-auth-app:simple
```

The container logs show the Vite dev server listening on all interfaces. Note the command line:
it is the `dev` script plus the `--host 0.0.0.0` from `CMD`.

```text
> node-auth-app@1.0.0 dev
> vite --port 5173 --strictPort --host 0.0.0.0

  VITE v8.3.5  ready in 148 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://172.17.0.2:5173/  eth0
```

Open http://localhost:5173, register and log in. `curl http://localhost:5173` from the host also
returns the page, with the `<script type="module" src="/@vite/client">` tag that only the dev
server injects. Stop the container with Ctrl+C.

### 5. Confirm with the Playwright tests

```bash
docker run --rm -d -p 5173:5173 --name auth-app node-auth-app:simple
npx playwright test
docker stop auth-app
```

The test runner and the browser run on your machine, so you need `npm ci` and
`npx playwright install chromium` once in the project folder. The app itself runs in the
container. This works because of the `webServer` block in the starter's config:

`node-auth-app/playwright.config.js` (from the starter):

```js
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true, // if `npm run dev` is already running, use it
  },
```

Port 5173 is already taken by the container, so with `reuseExistingServer: true` Playwright does
not start its own dev server and tests the container instead:

```text
Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/auth.spec.js:19:1 › registered user can log in (707ms)
  ✓  2 [chromium] › tests/auth.spec.js:27:1 › login with invalid credentials shows an error (357ms)

  2 passed (4.5s)
```

## Part 2: Multi-stage build and image size

### 6. The problem

```text
$ docker images node-auth-app
IMAGE                  ID             DISK USAGE   CONTENT SIZE
node-auth-app:simple   8747197aee61       1.96GB          493MB
```

**1.96 GB** on disk (493 MB compressed) for an app whose built output is a few kB:

```text
$ npm run build
dist/index.html                 0.46 kB │ gzip: 0.31 kB
dist/assets/index-DaD-j0B4.css  0.80 kB │ gzip: 0.41 kB
dist/assets/index-Br8_pVzO.js   3.74 kB │ gzip: 1.76 kB
✓ built in 294ms
```

The three files add up to 5,013 bytes (`du -sh dist` shows 12 KB, because of the disk block
size). Everything else in the image (Debian, compilers, Node, npm, `node_modules`, a dev server)
is only needed to produce these files, not to serve them. Section 10 shows the layer breakdown.

### 7. Quick win: a smaller base image

Change the first line of `Dockerfile` to:

```dockerfile
FROM node:26-alpine
```

Build with a new tag, then change the line back to `FROM node:26`:

```bash
docker build -t node-auth-app:alpine .      # 18.4 s, including the pull of node:26-alpine
```

Result: **429 MB** on disk, 127 MB content size. A lot better than 1.96 GB, but it still ships a
dev server with Node, npm and `node_modules`.

### 8. The multi-stage Dockerfile: `Dockerfile.multistage`

`node-auth-app/Dockerfile.multistage` (already in the starter, the handout's file plus comments):

```dockerfile
# ---------- Stage 1: build the static files ----------
FROM node:26-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build            # outputs plain HTML/CSS/JS to /app/dist

# ---------- Stage 2: serve them with nginx ----------
FROM nginx:stable-alpine

# Only the built files are copied. Node, npm and node_modules stay behind.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
# nginx's default command starts the server; no CMD needed.
```

Each `FROM` starts a new stage, and only the last one becomes the image. Stage 1 has Node to run
the build; stage 2 starts again from nginx and takes nothing from stage 1 except `/app/dist`.

```bash
docker build -f Dockerfile.multistage -t node-auth-app:multistage .
```

It took 6.3 s. All the `builder` steps up to `COPY . .` said `CACHED`, because the `:alpine`
image had just run the same instructions on the same base (`node:26-alpine`). Only
`RUN npm run build` (0.7 s) and the nginx stage were new.

### 9. Run and confirm

```bash
docker run --rm -d -p 5173:80 --name auth-app node-auth-app:multistage
npx playwright test
docker stop auth-app
```

`-p 5173:80` maps your port 5173 to nginx's port 80, so the tests do not change at all. The
response headers now come from nginx instead of Vite (check with `curl -I http://localhost:5173`),
and the tests still pass:

```text
HTTP/1.1 200 OK
Server: nginx/1.30.6

  ✓  1 [chromium] › tests/auth.spec.js:19:1 › registered user can log in (621ms)
  ✓  2 [chromium] › tests/auth.spec.js:27:1 › login with invalid credentials shows an error (259ms)

  2 passed (2.0s)
```

### 10. Compare the sizes

```text
$ docker images node-auth-app
IMAGE                      ID             DISK USAGE   CONTENT SIZE
node-auth-app:alpine       df721cc9f67a        429MB          127MB
node-auth-app:multistage   858e73082d5f       92.2MB           26MB
node-auth-app:simple       f4cbbdf04467       1.96GB          493MB
node-auth-app:slim         eebaefd23812       21.4MB         6.11MB
```

DISK USAGE is the unpacked size on your machine, CONTENT SIZE the compressed size a pull
downloads. The handout's table, filled in:

| Tag | Base image | Disk usage (measured) | Content size (measured) | Rough expectation (unpacked) |
| --- | --- | --- | --- | --- |
| `simple` | `node:26` | **1.96 GB** | 493 MB | > 1 GB |
| `alpine` | `node:26-alpine` | **429 MB** | 127 MB | ~ 250–300 MB |
| `multistage` | `nginx:stable-alpine` | **92.2 MB** | 26 MB | ~ 50 MB |
| `slim` (exercise 4) | `nginx:stable-alpine-slim` | **21.4 MB** | 6.11 MB | not given |

`multistage` is about **21 times smaller** than `simple` on disk (19 times in content size).

The `alpine` and `multistage` numbers are above the handout's rough figures:

- `alpine`: the Node layer of `node:26-alpine` alone is 180 MB, and `npm ci` adds 113 MB.
- `multistage`: the current `nginx:stable-alpine` image ships extra nginx modules (njs, acme,
  geoip, image-filter, xslt) and their libraries. Its main `RUN` layer is 51 MB and it has 71
  Alpine packages installed. That is exactly what exercise 4 removes.

**Layers.** `docker history node-auth-app:simple` (trimmed):

```text
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

The base image is about 1.35 GB of the 1.96 GB, and `npm ci` is the biggest layer you add
(113 MB). Inside the container that layer is 77 MB of `node_modules` (close to the handout's
~80 MB; `@rolldown` alone is 37 MB) plus 29 MB of npm cache in `/root/.npm`. The code itself
(`COPY . .`) is 45 kB.

`docker history node-auth-app:multistage` (trimmed):

```text
CREATED BY                                      SIZE
EXPOSE [80/tcp]                                 0B
COPY /app/dist /usr/share/nginx/html # build…   36.9kB
RUN /bin/sh -c set -x && apkArch="$(cat …       51MB      (nginx + modules)
...
RUN /bin/sh -c set -x && addgroup -g 101…       5.84MB
ADD alpine-minirootfs-3.24.4-aarch64.tar.gz     9.31MB
```

As the handout says, the `COPY --from=builder` layer is tiny: 36.9 kB. None of the builder stage
(Node, npm, `node_modules`, npm cache) is in the final image.

**Why smaller is better:** faster to download and deploy, less disk and storage cost, and fewer
installed packages means fewer potential security vulnerabilities. **Dev vs production:** the
`simple` image runs a dev server (hot reload, unminified code) and is for development; the
`multistage` image serves the optimised production build and is the one to deploy.

## 11. Exercises

### Exercise 1: Cache in action

**Change a text in `src/main.js`** (for example `"Create an account"` to
`"Create your account"`), then rebuild `:simple`:

```text
#6 [2/5] WORKDIR /app
#6 CACHED
#7 [3/5] COPY package.json package-lock.json ./
#7 CACHED
#8 [4/5] RUN npm ci
#8 CACHED
#9 [5/5] COPY . .
#9 DONE 0.0s
```

Total: **1.3 s**. `WORKDIR`, `COPY package*.json` and `RUN npm ci` are `CACHED`. Only `COPY . .`
runs again, because a file it copies changed. This is why the dependency files are copied before
the code.

**Add a dependency.** There are two ways to do it, and the first one fails.

1. Edit `package.json` by hand (add `"dependencies": { "ms": "^2.1.3" }`) without touching the
   lock file. The `COPY package.json package-lock.json` step is no longer cached, and `npm ci`
   **fails**:

   ```text
   npm error `npm ci` can only install packages when your package.json and package-lock.json
   or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before
   continuing.
   npm error Missing: ms@2.1.3 from lock file
   ```

   `npm ci` refuses to install anything the lock file does not pin. That is the point of it: the
   image gets exactly the versions in `package-lock.json`, or nothing.

2. The right way: run `npm install ms` on the host, which updates both `package.json` and
   `package-lock.json` (+9 lines in the lock file). Rebuild:

   ```text
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
   `COPY package*.json` layer and **every layer after it**, so `npm ci` reinstalls all packages
   from scratch (not just `ms`), and `COPY . .` also reruns because its parent layer changed.
   Here `npm ci` is fast (2 s, 21 packages); in a project with hundreds of dependencies this is
   the step that takes minutes.

Afterwards, restore `src/main.js`, `package.json` and `package-lock.json` and rebuild `:simple`.

### Exercise 2: Break the ignore file

Remove the `node_modules` line from `.dockerignore`, run `npm install` on the host (49 MB of
`node_modules` on the Mac), and rebuild under a separate tag (for example `no-ignore`, so
`:simple` stays clean):

| | Build context sent | Image size |
| --- | --- | --- |
| With `node_modules` ignored | 36.35 kB | 1.96 GB |
| Without | **50.15 MB** (0.7 s to transfer) | **2.02 GB** (`COPY . .` layer 45.1 kB → 51.7 MB) |

**Does the build get slower?** Yes. The whole `node_modules` folder is sent to the builder on
every build (0.7 s just for the transfer here; the full build went from 1.3 s to 3.2 s), and the
`COPY . .` layer grows from 45 kB to 52 MB. On a bigger project, or with a remote builder, this is
seconds to minutes per build. Any local `npm install` also invalidates the `COPY . .` layer, even
if no source file changed.

**Why is it risky?** `node_modules` contains native binaries built for the host OS. On the Mac,
npm installed only the macOS ones:

```text
node_modules/@rolldown/binding-darwin-arm64/rolldown-binding.darwin-arm64.node:
  Mach-O 64-bit arm64 dynamically linked shared library
node_modules/lightningcss-darwin-arm64
node_modules/fsevents                   (macOS-only package)
```

A Linux container cannot load a Mach-O library. Running Linux Node against the Mac's
`node_modules` (mounted read-only) and loading Vite's bundler shows it:

```text
$ docker run --rm -v "$PWD":/app:ro -w /app node:26 node -e 'import("rolldown")...'
ERROR: Cannot find native binding. npm has a bug related to optional dependencies ...
```

In this build the app still started, but only by luck: `COPY . .` **merges** the host folder on
top of the Linux `node_modules` from `npm ci`. The Linux bindings (`binding-linux-arm64-gnu`) are
still there, next to the macOS ones that were added. Every file that exists on both sides, though,
is now the host's copy: package code, `.bin` links, `.package-lock.json`, and any native module
that is built into the same path on every OS (for example `build/Release/*.node` files from
`node-gyp` packages like `bcrypt`). Those break with errors like `invalid ELF header`. You also
lose reproducibility: the image no longer contains what `package-lock.json` says, but whatever
happens to be on the developer's machine, plus macOS-only packages (`fsevents`, `*-darwin-arm64`)
that are useless in Linux. That is why `node_modules` stays in `.dockerignore` and the container
installs its own with `npm ci`.

Restore the line afterwards and remove the test image (`docker rmi node-auth-app:no-ignore`).

### Exercise 3: Inspect a container

With `node-auth-app:multistage` running as `auth-app`:

```text
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

If your terminal is not interactive, `docker exec auth-app sh -c '...'` with the same commands
gives the same result.

**There is no Node, no npm and no `node_modules` anywhere in the image.** The folder has only the
three files from `dist/` (`index.html`, one JS and one CSS file) plus nginx's default `50x.html`
error page. The builder stage was thrown away; only `/app/dist` was copied out.

### Exercise 4: Even smaller?

This is the one file you write: a copy of `Dockerfile.multistage` with two header comments and
one changed line. Stage 1 is identical, so here is the top and stage 2.

`solution/Dockerfile.slim`:

```dockerfile
# Exercise 4: same as Dockerfile.multistage, but stage 2 uses nginx:stable-alpine-slim.
# Build: docker build -f Dockerfile.slim -t node-auth-app:slim .
```

```dockerfile
# ---------- Stage 2: serve them with nginx ----------
FROM nginx:stable-alpine-slim

# Only the built files are copied. Node, npm and node_modules stay behind.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
# nginx's default command starts the server; no CMD needed.
```

A separate file (instead of editing `Dockerfile.multistage`) keeps both images buildable, so you
can compare them side by side. `Dockerfile*` in `.dockerignore` already keeps it out of the build
context.

```bash
docker build -f Dockerfile.slim -t node-auth-app:slim .
docker run --rm -d -p 5173:80 --name auth-app node-auth-app:slim
npx playwright test          # 2 passed (1.9s)
docker stop auth-app
```

The builder stage was fully cached, so the build took 2.1 s.

| Tag | Disk usage | Content size | Alpine packages |
| --- | --- | --- | --- |
| `multistage` (`nginx:stable-alpine`) | 92.2 MB | 26 MB | 71 |
| `slim` (`nginx:stable-alpine-slim`) | **21.4 MB** | **6.11 MB** | 21 |

The slim image is **4.3 times smaller** than `multistage` and about **92 times smaller** than
`simple` (1.96 GB → 21.4 MB). It still passes the same tests and runs the same nginx (1.30.6).

The difference is what the non-slim image carries for features this app never uses: the `curl`
binary, the njs/acme/geoip/image-filter/xslt nginx modules and their libraries (`libgd`,
`libxml2`, `libxslt`, `libavif`, `libwebp`, `libx11`, fonts, ...). The slim image keeps only
nginx, musl, OpenSSL, BusyBox and a few base packages. For serving static files that is all you
need, and 50 fewer packages also means 50 fewer things that can have a CVE. The trade-off: without
`curl` you cannot write a `HEALTHCHECK` with `curl`, and you cannot use those nginx modules.

## Cleanup

The containers ran with `--rm`, so stopping them deleted them. To remove the images and the build
cache once you are done comparing:

```bash
docker rmi node-auth-app:simple node-auth-app:alpine node-auth-app:multistage node-auth-app:slim hello-world node:26
docker builder prune      # build cache
```

## Files in solution/

| File | New or changed | What it does |
| --- | --- | --- |
| `Dockerfile.slim` | New | Exercise 4: `Dockerfile.multistage` with `nginx:stable-alpine-slim` in stage 2 (21.4 MB image) |

Everything else comes from the starter unchanged: `Dockerfile`, `Dockerfile.multistage` and
`.dockerignore` are used as given, and the section 7 edit is reverted after building `:alpine`.
Nothing has to be deleted.

To get the finished project: unzip `starter.zip`, then copy `solution/Dockerfile.slim` into the
`node-auth-app` folder next to the other Dockerfiles.
