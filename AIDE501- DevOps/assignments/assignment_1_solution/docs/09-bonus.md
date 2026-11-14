# 8. Bonus: DevOps challenges

## A. GitHub Actions: build → scan → publish to GHCR on every push

Workflow: [`.github/workflows/publish-ghcr.yml`](../.github/workflows/publish-ghcr.yml).
It runs once per component (matrix):

1. Build for amd64 and load the image into the runner.
2. **Scan it with Trivy.** A fixable HIGH/CRITICAL vulnerability fails the job,
   and nothing is pushed.
3. Log in to GHCR with the per-run `GITHUB_TOKEN`. No secret to create; the
   permissions are limited by the `permissions:` block.
4. Build amd64 + arm64 (layers come from the cache) and push
   `<component>-sha-<commit>` and `<component>-latest`. Pushing a git tag
   `v1.2.0` produces `<component>-1.2.0` instead.

To run it, put this folder at the root of a GitHub repo (see README), push to
`main`, then open the **Actions** tab.

**Gotcha:** if you already pushed `campus-events` to GHCR **by hand** with
your PAT, the package isn't linked to the repo, and the workflow fails with
`denied: permission_denied`. Fix: Package settings → **Manage Actions access**
→ add the repository with the **Write** role (or delete the package and let
the workflow create it).

Point to make: the scan runs **before** publishing. A vulnerable image never
reaches the registry. Show a failing run once: temporarily remove
`apk upgrade` from `frontend/Dockerfile`.

## B. Scan images before publication (locally)

```bash
docker compose build
scripts/scan.sh                       # both app images; exit code 1 = blocked
scripts/scan.sh postgres:18-alpine    # any image
```

What we found while building this solution, and how we fixed it:

| Image | Finding | Fix |
|---|---|---|
| backend | CVEs in `npm`'s *own* bundled packages (not our code!) | runtime stage deletes npm, which isn't needed to run the app |
| frontend | outdated Alpine packages in the nginx base image | `apk upgrade` at build time; rebuild regularly |

Lesson: most vulnerabilities come from what you *ship*, not what you *wrote*.
Ship less.

## C. Publish to Amazon ECR and deploy on EC2 with an IAM role

This is the "roles instead of static credentials" demonstration. On the other
three registries, the server stores a token. With ECR, the server stores
**nothing**.

### 1. Create the repository (laptop, as your admin user)

```bash
REGION=eu-west-3
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

aws ecr create-repository --repository-name campus-events --region $REGION \
  --image-scanning-configuration scanOnPush=true \
  --image-tag-mutability IMMUTABLE \
  --tags Key=Project,Value=aide501
```

`IMMUTABLE` means a tag like `backend-1.0.0` can never be overwritten. That's
good practice for versioned releases. `scanOnPush` gives you a second scanner
for free.

### 2. Push

```bash
aws ecr get-login-password --region $REGION |
  docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
# then set IMAGE_REPO in registries/ecr.env and:
scripts/publish.sh 1.0.0 ecr
```

The ECR password is a token valid for **12 hours**, generated from your IAM
identity. Nothing long-lived is involved.

### 3. Create the role for EC2 with a custom least-privilege policy

Console: IAM → Policies → Create policy → JSON → paste
[`aws/iam/ecr-pull-policy.json`](../aws/iam/ecr-pull-policy.json) (replace
region and account) → name `CampusEventsEcrPull`. Then IAM → Roles → Create
role → Trusted entity **AWS service → EC2** → attach `CampusEventsEcrPull` →
name `campus-events-ec2`. Then EC2 → your instance → Actions → Security →
**Modify IAM role** → `campus-events-ec2`.

Or with the CLI:

```bash
sed -e "s/<region>/$REGION/" -e "s/<account-id>/$ACCOUNT/" aws/iam/ecr-pull-policy.json > /tmp/ecr-pull.json

aws iam create-policy --policy-name CampusEventsEcrPull --policy-document file:///tmp/ecr-pull.json
aws iam create-role --role-name campus-events-ec2 \
  --assume-role-policy-document file://aws/iam/ec2-trust-policy.json \
  --tags Key=Project,Value=aide501
aws iam attach-role-policy --role-name campus-events-ec2 \
  --policy-arn arn:aws:iam::$ACCOUNT:policy/CampusEventsEcrPull
aws iam create-instance-profile --instance-profile-name campus-events-ec2
aws iam add-role-to-instance-profile --instance-profile-name campus-events-ec2 --role-name campus-events-ec2
aws ec2 associate-iam-instance-profile --instance-id <i-...> \
  --iam-instance-profile Name=campus-events-ec2
```

Two documents, two questions:
- **Trust policy** (`ec2-trust-policy.json`): *who* may assume the role? → the EC2 service.
- **Permissions policy** (`ecr-pull-policy.json`): *what* may the role do? →
  get a login token, and read **only** the `campus-events` repository.

### 4. Pull on EC2: no keys, no tokens

```bash
sudo snap install aws-cli --classic
aws sts get-caller-identity          # Arn: ...assumed-role/campus-events-ec2/i-...
aws ecr get-login-password --region eu-west-3 |
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-west-3.amazonaws.com
dc --env-file registries/ecr.env pull
dc --env-file registries/ecr.env up -d
```

The credentials come from the instance metadata service and are rotated
automatically by AWS.

### 5. Prove least privilege (the best moment of the video)

```bash
docker tag postgres:18-alpine <account-id>.dkr.ecr.eu-west-3.amazonaws.com/campus-events:hack
docker push <account-id>.dkr.ecr.eu-west-3.amazonaws.com/campus-events:hack
#  → denied: ... is not authorized to perform: ecr:InitiateLayerUpload

aws ecr delete-repository --repository-name campus-events --region eu-west-3
#  → AccessDeniedException

aws s3 ls
#  → AccessDenied (implicit deny: nothing allows it)
```

If someone compromises this server, all they get is the ability to read one
image repository, for at most a few hours.

[`aws/iam/ecr-push-policy.json`](../aws/iam/ecr-push-policy.json) is the matching
policy for an identity that is allowed to **publish** (e.g. a CI role), and
nothing else.

Cleanup: `aws ecr delete-repository --repository-name campus-events --force`,
then detach and delete the role, instance profile and policy.

## D. Container management

Run these on the VM or the EC2 instance (`alias dc=...` as before).

**Restart policies**: the deploy compose file sets `restart: unless-stopped`.

```bash
docker inspect campus-events-backend-1 --format '{{.HostConfig.RestartPolicy.Name}}'

# Simulate a crash: kill the process, not the container.
sudo kill -9 $(docker inspect -f '{{.State.Pid}}' campus-events-backend-1)    # on the Linux host
# (or: docker exec campus-events-backend-1 kill 1   -> works on Docker Desktop too)
sleep 3
docker inspect campus-events-backend-1 --format '{{.State.Status}} restarts={{.RestartCount}}'   # running restarts=1

sudo reboot                     # after the reboot: all 3 containers are running again
```

Gotcha: `docker stop` and `docker kill` count as **manual** stops, so the
restart policy deliberately does *not* bring the container back. To demo
recovery, you have to make the process die on its own.

| Policy | Restarts after crash | After `docker stop` + daemon restart |
|---|---|---|
| `no` (default) | no | no |
| `on-failure` | only on non-zero exit | no |
| `always` | yes | **yes** |
| `unless-stopped` | yes | no (respects your manual stop) |

**Logs**

```bash
docker logs -f --tail 50 campus-events-backend-1
dc --env-file registries/ghcr.env logs -f --since 10m
```

The deploy file rotates logs (`max-size: 10m`, `max-file: 3`). Without that,
a chatty container can fill an 8–16 GB EC2 disk.

**Resource monitoring**

```bash
docker stats                       # live CPU / memory / network per container
docker stats --no-stream
docker system df                   # disk used by images, containers, volumes
```

`MEM USAGE / LIMIT` shows the `mem_limit` values from the compose file.

**Image versioning**

```bash
scripts/publish.sh 1.1.0 ghcr                 # after a code change
TAG=1.1.0 dc --env-file registries/ghcr.env up -d     # upgrade
TAG=1.0.0 dc --env-file registries/ghcr.env up -d     # instant rollback
```

Never deploy `latest` to a server: you can't tell what's running, and you
can't roll back to it.

**Removal and recreation**

```bash
dc --env-file registries/ghcr.env down                      # remove containers + network (volume kept)
dc --env-file registries/ghcr.env up -d --force-recreate    # recreate from images
docker image prune -a                                       # remove unused images
docker volume ls; docker volume rm campus-events_db-data    # deliberate data wipe
```

Containers are disposable and the data is in the volume. That's why
recreating is safe.
