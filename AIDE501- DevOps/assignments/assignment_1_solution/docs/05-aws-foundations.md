# 5a. AWS foundations: account, identity, cost control

Do this part once, before any EC2 work. It's the part students skip and later
regret.

## How AWS is organized (2-minute whiteboard)

- **Account**: the billing and security boundary. Everything lives in an account.
- **Region** (e.g. `eu-west-3` Paris, `eu-central-1` Frankfurt): an independent
  set of data centres. Most resources are **regional**: an instance in Paris is
  invisible when the console is set to Frankfurt. Pick one region and stay in it.
- **Availability Zone** (`eu-west-3a`…): one or more data centres inside a region.
- **Global services**: IAM and billing are not regional.
- **Shared responsibility**: AWS secures the hardware and hypervisor. *You*
  secure the OS, Docker, your security groups, your keys and your IAM.

## Step 1 — Lock down the root user

The root user (the email you signed up with) can do everything, including
closing the account, and **IAM policies cannot restrict it**.

1. Sign in as root → top-right menu → Security credentials.
2. **Assign an MFA device** (authenticator app or passkey).
3. Make sure there are **no access keys** for root.
4. From now on, use root only for the few tasks that require it.

## Step 2 — Cost control before anything else

1. Billing and Cost Management → **Budgets** → Create budget → template
   **"Zero spend budget"** → your email. AWS now emails you as soon as you
   spend $0.01.
2. Billing → **Free Tier**: shows which plan your account is on.
   - Accounts created **on or after 15 July 2025** are on the *Free plan*: credits
     for up to 6 months. Eligible EC2 types include `t3.micro`, `t3.small`,
     `t4g.micro`, `t4g.small`.
   - Older accounts are on the legacy 12-month Free Tier: 750 h/month of
     `t2.micro`/`t3.micro`.
3. Things that cost money even on a "free" instance: **public IPv4 addresses**
   (charged per hour), EBS storage beyond the free allowance, snapshots, an
   Elastic IP, data transfer out, ECR storage. The cleanup step covers these.

Estimate before launching: the EC2 launch wizard marks **"Free tier eligible"**
types and AMIs. The **AWS Pricing Calculator** (<https://calculator.aws>) shows
the monthly cost of anything else.

## Step 3 — An admin identity for daily work (the course method)

Following the course slides, create a group with a policy and put a user in
it. You never attach policies to users directly.

1. IAM → User groups → Create group `Admins` → attach **AdministratorAccess**.
2. IAM → Users → Create user `hadi-admin` → console access → add to `Admins`.
3. Sign in with the account's **IAM sign-in URL** (`https://<account-id>.signin.aws.amazon.com/console`).
4. Enable MFA for this user too.
5. For the CLI: Users → `hadi-admin` → Security credentials → Create access key →
   "Command Line Interface". Then:

```bash
aws configure              # key, secret, region (e.g. eu-west-3), output json
aws sts get-caller-identity
```

> **What production does instead:** AWS recommends **IAM Identity Center**
> for people: one login, short-lived credentials (`aws configure sso`), no
> long-lived access keys sitting in `~/.aws/credentials`. For machines, it
> recommends **roles**. We use a role for EC2 in the bonus (ECR).

## Step 4 — Understand a policy (read one, then write one)

An IAM policy is a JSON document. Each statement says **Effect** (Allow/Deny)
which **Action**s are allowed on which **Resource**s:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"],
    "Resource": "arn:aws:ecr:eu-west-3:123456789012:repository/campus-events"
  }]
}
```

Evaluation rules to state on camera:

1. Everything is **denied by default** (implicit deny).
2. An `Allow` grants access.
3. An explicit `Deny` always wins over any `Allow`.

Identity types:

| Identity | Use for | Credentials |
|---|---|---|
| IAM user | a person (course method) | password + MFA, optional long-lived access key |
| IAM group | attaching the same policies to many users | — |
| IAM role | **machines and temporary access** (EC2, CI, other accounts) | short-lived, rotated automatically |

**Hands-on: write a custom least-privilege policy.** We need "EC2 may pull
*one* ECR repository, nothing else". That's [`aws/iam/ecr-pull-policy.json`](../aws/iam/ecr-pull-policy.json).
Create it in IAM → Policies → Create policy → JSON. The **Visual editor** tab
shows the same policy as checkboxes, which helps when explaining it. You use it
in [09-bonus.md](09-bonus.md).

Compare it with the AWS-managed `AmazonEC2ContainerRegistryReadOnly`, which
allows reading **every** repository in the account. It's convenient, but it's
broader than this app needs.

## Step 5 — Tag everything

Tag every resource you create with `Project = aide501`. At the end, Resource
Groups & Tag Editor → search all regions for that tag to find anything left
over.
