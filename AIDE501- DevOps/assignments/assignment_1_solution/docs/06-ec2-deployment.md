# 5b. Deploy on Amazon EC2

## Launch the instance (console: EC2 → Launch instance)

| Setting | Value | Why |
|---|---|---|
| Name and tags | `campus-events`, add tag `Project=aide501` | cleanup later |
| AMI | **Ubuntu Server 24.04 LTS** (or newer LTS), "Free tier eligible" | assignment |
| Architecture | 64-bit (x86) → `t3.micro`; or 64-bit (Arm) → `t4g.micro` | our images are multi-arch: both work |
| Instance type | one marked **Free tier eligible** on *your* account | cost |
| Key pair | Create new → **ED25519**, `.pem` → `campus-events.pem` | SSH login |
| Network | default VPC, **Auto-assign public IP: Enable** | reachable from the internet |
| Security group | create `campus-events-sg` (rules below) | firewall |
| Storage | 16 GiB **gp3** | images + Postgres; free allowance is 30 GiB |
| Advanced → Metadata | IMDSv2 **required** (default on new launches) | blocks a classic SSRF credential theft |

Security group, inbound rules:

| Type | Port | Source | Purpose |
|---|---|---|---|
| SSH | 22 | **My IP** | remote administration, from your IP only |
| HTTP | 80 | 0.0.0.0/0 (and ::/0) | the website, open to everyone |

Explain:
- A security group is a **stateful firewall** attached to the instance's
  network interface. Replies to allowed traffic are allowed automatically.
- Outbound is open by default, so the instance can pull images.
- **Never** open 5432 (database) or 3000 (API). They aren't published by
  compose either; this is defence in depth.

Launch → copy the **Public IPv4 address** from the instance details.

## Connect from Windows PowerShell

OpenSSH refuses a key that other users can read. On Windows, fix the file
permissions once:

```powershell
icacls .\campus-events.pem /inheritance:r
icacls .\campus-events.pem /grant:r "$($env:USERNAME):(R)"
ssh -i .\campus-events.pem ubuntu@<EC2_PUBLIC_IP>
```

(macOS/Linux: `chmod 400 campus-events.pem`.) The default user on Ubuntu AMIs is `ubuntu`.

## Install Docker on the instance

```powershell
scp -i .\campus-events.pem scripts\install-docker.sh ubuntu@<EC2_PUBLIC_IP>:~
```

```bash
bash install-docker.sh && newgrp docker
docker run --rm hello-world
free -h        # ~1 GB RAM on a micro: that's why compose sets mem_limit
```

## Copy the deployment files

```powershell
ssh -i .\campus-events.pem ubuntu@<EC2_PUBLIC_IP> "mkdir -p ~/campus-events"
scp -i .\campus-events.pem -r docker-compose.deploy.yml .env.example registries ubuntu@<EC2_PUBLIC_IP>:~/campus-events/
```

```bash
cd ~/campus-events
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
alias dc='docker compose -f docker-compose.deploy.yml --env-file .env'
```

## Deploy from each registry (private → authenticate first)

```bash
# 1) Docker Hub
docker login -u <dockerhub-user>                                   # read-only token
dc --env-file registries/dockerhub.env pull
dc --env-file registries/dockerhub.env up -d
dc --env-file registries/dockerhub.env ps
```

Open `http://<EC2_PUBLIC_IP>` in your Windows browser. Register, create an
event, reserve a seat. Show the About page: API **ok**, database **up**.

```bash
# 2) GHCR — stop the previous stack first (port 80 is taken)
dc --env-file registries/dockerhub.env down
echo <ghcr-pull-token> | docker login ghcr.io -u <github-user> --password-stdin
dc --env-file registries/ghcr.env pull
dc --env-file registries/ghcr.env up -d

# 3) GitLab
dc --env-file registries/ghcr.env down
echo <deploy-token> | docker login registry.gitlab.com -u <deploy-token-username> --password-stdin
dc --env-file registries/gitlab.env pull
dc --env-file registries/gitlab.env up -d
```

Because the database lives in a named volume, the users and events you created
in step 1 are still there in steps 2 and 3. That's a nice moment to point out.

Alternative from the assignment ("different host ports"): run each registry's
stack under its own project name and port, and add one security group rule per
port:

```bash
WEB_PORT=8082 dc --env-file registries/ghcr.env -p campus-ghcr up -d
```

When you're done on the instance, log out of the registries:

```bash
docker logout; docker logout ghcr.io; docker logout registry.gitlab.com
```

## Cleanup (do this every time, on camera)

1. **EC2 → Instances → Terminate** (Stop alone still bills for EBS and the public IPv4).
2. **EC2 → Volumes**: the root volume has *Delete on termination = Yes* by
   default, so it disappears. Delete any leftover volume in state `available`.
3. **EC2 → Snapshots / AMIs**: delete any you created.
4. **EC2 → Elastic IPs**: release any (we never needed one).
5. **ECR** (if you did the bonus): delete the repository. Storage is billed.
6. **Key pairs / security groups / IAM roles**: free, but delete them for hygiene.
7. **Tag Editor**: search all regions for `Project=aide501` → should be empty.
8. **Billing → Bills** and **Free Tier**: check usage. Remember that charges
   appear with a delay of a few hours.
