# GitLab CI/CD Lab — AIDE501 Assignment 2 solution

Deliverable: **one short video** showing the three parts working:

1. **GitLab CI** — pipeline, stages, artifacts, tests (JUnit), merge-request rules
2. **Continuous Delivery (CD)** — Netlify, UAT with smoke test, manual approval to production
3. **Deploy to a public cloud** — AWS S3 static website from the pipeline

The *Embedding Security* section of the PDF is not part of the deliverable and is skipped.

## Ground rules (from the professor)

Create **your own new project** and only *use the files* of
`https://gitlab.com/anhlab1/exercise4`. No fork, no merge request / push back to that
repository. Merge requests **inside your own project** (Part 1 code review, Part 2 release)
are part of the lab and stay.

Everything runs in **one project** (the PDF makes a second fork for AWS; not needed).

## What is in this folder

| Path | What it is |
|---|---|
| `pipelines/01…13-*.yml` | The `.gitlab-ci.yml` content at each step, in recording order. Paste each one into the Web IDE as `.gitlab-ci.yml`. |
| `.gitlab-ci.yml` | The final pipeline (same as `pipelines/13-aws-s3-final.yml`). |
| `aws/s3-bucket-policy.json` | Public-read bucket policy for the static website. Replace the bucket name. |
| `aws/iam-s3-deploy-policy.json` | Optional least-privilege alternative to `AmazonS3FullAccess` for the `gitlab` IAM user. |

The recording script (what to click and say, step by step, with each pipeline ready to copy)
is [`recording-script.html`](recording-script.html), also published as an artifact:
<https://claude.ai/artifact/Gxkgk8z6WTmzfhjEx94Jet>.

| Step | File | Branch | Expected result |
|---|---|---|---|
| 1 | `01-first-job-fails.yml` | main | ❌ `node: not found` (on purpose) |
| 2 | `02-node22.yml` | main | ✅ prints node/npm versions |
| 3 | `03-slim-image.yml` | main | ✅ faster job (smaller image) |
| 4 | `04-stages.yml` | main | ✅ `build/` appears in `ls -la` |
| 5 | `05-artifacts.yml` | main | ✅ artifact browsable on the job page |
| 6 | `06-test-artifact.yml` | main | ✅ build → test |
| 7 | `07-unit-tests-sequential.yml` | main | ✅ build → test → unit |
| 8 | `08-parallel-junit.yml` | main | ✅ tests in parallel, **Tests** tab filled |
| — | merge-request settings + protect `main` | — | — |
| — | small change via `features/improve-docs` + MR | features/improve-docs → main | ✅ merged after green pipeline |
| 9 | `09-netlify-cli-pre.yml` | features/netlify | ✅ `.pre` job installs CLI |
| 10 | `10-netlify-status.yml` | features/netlify | ✅ `netlify status` shows your site |
| 11 | `11-netlify-deploy-smoke.yml` | features/netlify | ✅ UAT deploy + curl smoke test |
| 12 | `12-netlify-uat-prod-manual.yml` | features/netlify → MR → main | ✅ UAT auto, prod waits for ▶ |
| 13 | `13-aws-s3-final.yml` | features/aws → MR → main | ✅ S3 sync + smoke test, site live |

## One-time setup (before recording)

**GitLab**
1. *New project → Import project → Repository by URL* → `https://gitlab.com/anhlab1/exercise4.git`, visibility **Public**.
2. In the new project delete `.gitlab-ci.yml` (it is the professor's finished Netlify pipeline with **his** site ID). `.gitlab-ci-start.yml` and `.gitlab-ci.-v1.yml` can stay — they don't run.
3. Make sure shared runners work on your account (a pipeline that stays *pending* or asks for verification = account not validated).
4. Web IDE → Settings → search "whitespace" → *Render Whitespace: all* (PDF p.3).

**Netlify** (before Part 2)
1. Run `npm ci && npm run build` locally on a copy of the repo (or download the `build/` artifact from step 5) and drag the `build` folder into *Deploys* → manual deploy.
2. *Site configuration* → change the site name. Write down **site name** and **site ID**.
3. *User settings → Applications → Personal access tokens* → new token.

**GitLab CI/CD variables** (*Settings → CI/CD → Variables → Add variable*)

| Key | Value | Masked | Protected |
|---|---|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify PAT | ✅ | ❌ — steps 10–11 run on an unprotected feature branch |
| `AWS_ACCESS_KEY_ID` | from the IAM CSV | optional | ❌ |
| `AWS_SECRET_ACCESS_KEY` | from the IAM CSV | ✅ | ❌ |

Non-secret values (`NETLIFY_SITE_ID`, `NETLIFY_SITE_NAME`, `AWS_S3_BUCKET`, `AWS_DEFAULT_REGION`)
are in the YAML — replace every `REPLACE-WITH-…` placeholder.

**AWS** (before Part 3; PDF pp.28–34)
1. IAM user `gitlab` → attach `AmazonS3FullAccess` (or `aws/iam-s3-deploy-policy.json`) → access key for *CLI* → download CSV.
2. S3 → general-purpose bucket, unique name, **us-east-1**, untick *Block all public access*.
3. *Permissions → Bucket policy* → paste `aws/s3-bucket-policy.json` with your bucket name.
4. *Properties → Static website hosting* → enable, index document `index.html`.
5. Delete the access key after grading.

## Fixes compared with the PDF

| Where | Problem in the PDF / upstream repo | Fix used here |
|---|---|---|
| Upstream repo | Already contains the finished `.gitlab-ci.yml` with the professor's Netlify site | Delete it before step 1 |
| p.21 | YAML is broken: `variables:` mis-indented, `script` without colon, `ppm` typo | `10-netlify-status.yml` |
| p.24 | `apk add curl` on `node:23-slim` (Debian, no `apk`) | Deploy jobs use `node:22-alpine` |
| p.24 | Smoke test curls the professor's site | Uses `$NETLIFY_SITE_NAME` |
| p.24 | `echo $NETLIFY_AUTH_TOKEN` prints a secret | Removed |
| Netlify CLI | Current `netlify deploy` builds before deploying by default and needs Node ≥ 22.13 | `--no-build`, CLI pinned to `netlify-cli@27` |
| Upstream `netlify_prod` | Job-level `when: manual` next to `rules:` (mixing the two is not the documented form and older GitLab versions reject it) | `when: manual` inside the rule |
| p.15 | "Allowed to push and merge: No one" can also block merging | Set **push** to *No one*, keep **merge** for *Maintainers* |
| Part 3 | Separate fork | Same project, extra `deploy_aws` stage + `aws_smoke_test` job |

## Gotchas while recording

- Fast-forward merge needs the feature branch up to date with `main`: create each feature branch **after** the previous MR is merged, or click *Rebase* on the MR.
- With *Pipelines must succeed*, the MR's merge button stays disabled until the branch pipeline is green — that is the point to show.
- On `features/netlify` with step 12, the deploy jobs vanish from the pipeline (rules = main only). After the merge, the `main` pipeline shows `netlify_uat` running and `netlify_prod` waiting with a ▶ button (pipeline status *blocked*).
- The S3 website endpoint is `http://` only (no https), and in us-east-1 its format is `BUCKET.s3-website-us-east-1.amazonaws.com`.
