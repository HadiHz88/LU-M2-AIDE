# Handoff — AIDE501 Assignment 2 (GitLab CI/CD Lab)

Context for a new session (another machine, new Claude session). Read this first, then
`README.md` and `WORKING-GUIDE.pdf` in this folder.

## What is asked

- **Course:** AIDE501 DevOps (LU, M2 AIDE).
- **Assignment PDF:** [`../Assignment 2.pdf`](../Assignment%202.pdf). Its title is "GitLab CICD Lab", 40 pages.
- **Lab repository** that the PDF builds on: <https://gitlab.com/anhlab1/exercise4>. It holds a React + Vite app, Vitest tests and a JUnit reporter.
- **Deliverable**, in the professor's words: *"a short video showing the successful run of the three main parts of the assignments as shown in the table of contents"*:
  1. **GitLab CI** (PDF pp. 2–16): pipeline creation, stages, artifacts, test stage, JUnit reports, code review and merge requests.
  2. **Continuous Delivery (CD)** (pp. 17–27): Netlify manual deployment, then automated deployment. Covers environment variables, secrets, UAT deployment with a smoke test, before_script, and a manual approval before production.
  3. **Deploy to a public cloud environment** (pp. 27–35): an AWS IAM user, an S3 static-website bucket, and the `aws s3 sync` command run from the pipeline.
- **Professor's clarification** after classmates found the PDF's fork steps confusing. Original message, in Arabic:
  > لازم نعمل project جديد ونشغل ال assignment يلي النا ونستفيد فقط من الملفات يلي على gitlab بدون ما نرجع نعمل pull request او push او merge

  It means: create a **new project of your own** and run your own assignment there. Use only the *files* from the GitLab lab repo. Don't open a pull request, push or merge back to it.
- **Format:** the user has done a recorded-video assignment like this before (Assignment 1), so the same approach applies here.

## What was decided

| Decision | Detail |
|---|---|
| Project creation | *Import project → Repository by URL* from `anhlab1/exercise4`, Public. No fork. Delete the imported `.gitlab-ci.yml`, which is the professor's finished pipeline with his Netlify site ID. |
| Merge requests | Merge requests **inside the user's own project** stay: the Part 1 code review and the Part 2 merge to main for the UAT/production release. Only upstream MRs are forbidden. |
| One project | Parts 1–3 all happen in one GitLab project. The PDF's second fork for AWS is dropped; AWS becomes an extra `deploy_aws` stage. |
| Security section | *Embedding Security* (PDF pp. 35–40: Docker-in-Docker, Trivy, GitLab templates) is **not** part of the deliverable, so it is skipped. |
| Accounts | The user says the GitLab, Netlify and AWS accounts are ready. |
| Region | AWS `us-east-1`, so the website endpoint is `BUCKET.s3-website-us-east-1.amazonaws.com`. |

### Fixes compared with the PDF and the upstream repo

- **p. 21 YAML is broken:** `variables:` is mis-indented, `script` has no colon, and `ppm` should be `npm`. Fixed in `pipelines/10-netlify-status.yml`.
- **p. 24 runs `apk add curl` on `node:23-slim`:** that image is Debian-based, so `apk` doesn't exist. The deploy jobs use `node:22-alpine` instead.
- **The smoke test pointed at the professor's site.** It now uses `$NETLIFY_SITE_NAME`.
- **Netlify CLI changes:**
  - Current versions build before deploying by default, so every deploy command has `--no-build`.
  - The CLI needs Node 22.13 or later, and it's pinned to `netlify-cli@27`. Checked against `netlify deploy --help` from version 27.20.1.
- **Upstream `netlify_prod` mixes a job-level `when: manual` with `rules:`.** In our files `when: manual` sits inside the rule.
- **Branch protection:** set only *Allowed to push and merge* on `main` to *No one*. Keep *Allowed to merge* for Maintainers.
- **`NETLIFY_AUTH_TOKEN` must not be Protected:** the Netlify steps run on the unprotected `features/netlify` branch.
- **`echo $NETLIFY_AUTH_TOKEN` was removed.** It printed a secret.

## What was provided (all in this folder, committed and pushed)

| Path | What |
|---|---|
| `pipelines/01…13-*.yml` | The `.gitlab-ci.yml` at every recording step: 01 fails on alpine on purpose, through to 13, the final pipeline with Netlify UAT/prod and AWS S3. |
| `.gitlab-ci.yml` | The final pipeline, a copy of step 13. |
| `aws/s3-bucket-policy.json` | Public-read bucket policy (replace the bucket name). |
| `aws/iam-s3-deploy-policy.json` | Optional least-privilege policy for the `gitlab` IAM user. |
| `README.md` | Overview, step table, setup, variables table, list of fixes, gotchas. |
| `WORKING-GUIDE.pdf` | 20-page click-by-click guide: links, what is provided, a values sheet, and every step tagged GO / CLICK / TYPE / PASTE / SHOW / SAY / OFF-CAM with the full YAML. Also has troubleshooting and cleanup. |
| `recording-script.html` | 21-scene recording script with narration and copy buttons. Also published at <https://claude.ai/artifact/Gxkgk8z6WTmzfhjEx94Jet>; the link is private to the user's claude.ai account. |
| `tools/build_guide_pdf.py` | Regenerates `WORKING-GUIDE.pdf` from `pipelines/*.yml`. Needs Python 3.10+ and `reportlab`. |
| `tools/build_recording_script.py` | Regenerates `recording-script.html` from `pipelines/*.yml`. |

To regenerate after editing a pipeline file, run these from this folder:

```bash
python3 -m venv .venv && .venv/bin/pip install reportlab
.venv/bin/python tools/build_guide_pdf.py "$PWD"
.venv/bin/python tools/build_recording_script.py "$PWD"
```

## Status and what's left

- [x] Solution files written. YAML and JSON parse, and every job has a valid stage, script and `needs`. This was a local check only.
- [ ] **No pipeline has run on GitLab yet.** The first real run happens while recording, so expect small fixes. The likely ones are in `WORKING-GUIDE.pdf` §9 (Troubleshooting).
- [ ] The user does the lab and records the video, following `WORKING-GUIDE.pdf` or the recording script. Expect about 2 hours of recording and a 12–15 minute video.
- [ ] Fill in the `REPLACE-WITH-…` placeholders (Netlify site ID and name, bucket name) in the pasted YAML.
- [ ] After grading: delete the IAM access key, revoke the Netlify token, and optionally delete the bucket and the Netlify project.

If a pipeline fails during recording, fix the matching `pipelines/NN-*.yml`, then regenerate the PDF and the recording script with `tools/` so all three stay in sync.
