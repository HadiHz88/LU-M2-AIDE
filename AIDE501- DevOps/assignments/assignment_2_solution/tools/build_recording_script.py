"""Regenerate recording-script.html from pipelines/*.yml.  Usage: python tools/build_recording_script.py <assignment_2_solution dir>"""
import html, re, sys, pathlib

SOL = pathlib.Path(sys.argv[1])
OUT = SOL / "recording-script.html"

def yml(name):
    t = (SOL / "pipelines" / name).read_text()
    e = html.escape(t)
    e = re.sub(r"(REPLACE-WITH-[A-Z-]+)", r'<mark>\1</mark>', e)
    return name, e

# status chips: passed, failed, manual, blocked, skipped, none
PARTS = [
 ("ci", "Part 1", "GitLab CI", "Build a pipeline from one failing job to parallel tests with JUnit reports, then force changes through merge requests.", [
  dict(t="Show the project", br=None, chip=None, wait=None,
       do=["Open your new project (imported from <code>anhlab1/exercise4</code>, your namespace, Public).",
           "Show the files: <code>src/</code>, <code>package.json</code>, <code>vite.config.js</code>. No <code>.gitlab-ci.yml</code> yet."],
       say="This is my own GitLab project, created from the lab files. It's a small React app built with Vite. There's no pipeline yet, so let's create one."),
  dict(t="First pipeline, on alpine", br="main", chip=("failed", "failed on purpose"), wait="~30 s",
       do=["<em>Edit → Web IDE</em>. Settings → search “whitespace” → <em>Render Whitespace: all</em>.",
           "New file <code>.gitlab-ci.yml</code>, paste step 01, commit to <code>main</code>: “first pipeline run”.",
           "Go to project → click the red status → open the <code>test_npm</code> job log."],
       say="The job failed with <q>node: not found</q>. The alpine image is a minimal Linux without Node or npm, so the job needs a different image.",
       y="01-first-job-fails.yml"),
  dict(t="Fix it with node:22", br="main", chip=("passed", "passed"), wait="~40 s",
       do=["Replace the file with step 02, commit “node 22”.", "Open the job: show the printed versions and the duration."],
       say="With the official node image, both commands work. Note the job time: the image is around 370 MB.",
       y="02-node22.yml"),
  dict(t="Smaller image", br="main", chip=("passed", "passed"), wait="~30 s",
       do=["Step 03, commit “slim image”.", "Compare the duration with the previous run."],
       say="node:23-slim is about 75 MB, so the image pulls faster. Small images suit simple builds; if a build needs extra tools we would have to install them.",
       y="03-slim-image.yml"),
  dict(t="Stages and a real build", br="main", chip=("passed", "passed"), wait="~1 min",
       do=["Step 04, commit “adding stages”.", "In the log, show the first <code>ls -la</code>, then <code>npm ci</code>, <code>npm run build</code>, and the second <code>ls -la</code> with the new <code>build/</code> folder."],
       say="Now the pipeline has build and test stages. npm ci installs the exact versions from package-lock.json, which makes the build reproducible.",
       y="04-stages.yml"),
  dict(t="Keep the build as an artifact", br="main", chip=("passed", "passed"), wait="~1 min",
       do=["Step 05, commit “artifacts”.", "Job page → right panel → <em>Browse</em> → open <code>build/</code>."],
       say="Each job runs in a fresh container, so files disappear when it ends. Declaring build/ as an artifact stores it and passes it to later stages.",
       y="05-artifacts.yml"),
  dict(t="Test the artifact", br="main", chip=("passed", "passed"), wait="~1 min",
       do=["Step 06, commit “test artifact”.", "Show the pipeline graph: <code>build_website</code> → <code>test_artifact</code>."],
       say="The test job receives build/ from the previous stage and checks that index.html exists.",
       y="06-test-artifact.yml"),
  dict(t="Unit tests, sequential", br="main", chip=("passed", "passed"), wait="~2 min",
       do=["Step 07, commit “unit tests”.", "Graph shows three stages in a row. Note the total pipeline time."],
       say="I added the unit tests in a third stage. Right now everything runs one stage after the other.",
       y="07-unit-tests-sequential.yml"),
  dict(t="Parallel tests and the JUnit report", br="main", chip=("passed", "passed"), wait="~1.5 min",
       do=["Step 08, commit “parallel tests + junit”.", "Graph: two jobs side by side in <em>test</em>. Compare the total time.", "Open the pipeline's <em>Tests</em> tab and drill into the suite."],
       say="Both test jobs share the test stage, so they run in parallel and the pipeline is faster. Vitest writes a JUnit XML file and GitLab shows it in the Tests tab: pass or fail, duration and errors per test.",
       y="08-parallel-junit.yml"),
  dict(t="Merge-request rules and branch protection", br=None, chip=None, wait=None,
       do=["<em>Settings → Merge requests</em>: Merge method <em>Fast-forward merge</em>; squash <em>Encourage</em>; tick <em>Pipelines must succeed</em> and <em>All threads must be resolved</em>. Save.",
           "<em>Settings → Repository → Protected branches</em>, <code>main</code>: <em>Allowed to push and merge</em> → <strong>No one</strong>; keep <em>Allowed to merge</em> → Maintainers."],
       say="Fast-forward keeps the history linear. A merge request can only be merged if its pipeline passes. Nobody can push to main directly any more, so every change goes through a merge request."),
  dict(t="Code review through a merge request", br="features/improve-docs", chip=("passed", "passed → merged"), wait="~1.5 min",
       do=["Web IDE: add a first line <code># Learn GitLab CI/CD pipeline</code> to <code>.gitlab-ci.yml</code> → Commit.",
           "GitLab refuses <code>main</code> and offers a new branch: name it <code>features/improve-docs</code>.",
           "<em>Create MR</em>, add a description, create it. Show the merge button disabled while the pipeline runs, then <em>Merge</em>."],
       say="The direct commit to main is blocked, so the change goes on a feature branch and a merge request. Once the pipeline is green, the merge is allowed. In a team, someone else would review and approve first."),
 ]),
 ("cd", "Part 2", "Continuous Delivery", "Deploy the build to Netlify, first by hand, then from the pipeline: UAT with a smoke test, production behind a manual approval.", [
  dict(t="Manual deployment", br=None, chip=None, wait=None,
       do=["In GitLab, open the latest <code>build_website</code> job → <em>Download artifacts</em>, unzip.",
           "Netlify → <em>Deploys</em> → drag the <code>build</code> folder in.",
           "<em>Site configuration</em> → <em>Change site name</em>. Open the site. Note the <strong>site name</strong> and <strong>site ID</strong>."],
       say="This is a manual deployment: I uploaded the build folder myself. It works, but it's easy to miss a step. Next, the pipeline does it."),
  dict(t="Install the Netlify CLI in .pre", br="features/netlify", chip=("passed", "passed"), wait="~1.5 min",
       do=["Web IDE: paste step 09 → Commit → new branch <code>features/netlify</code> (main is protected).",
           "Pipeline graph: a new <em>.pre</em> column runs first. Open it: <code>netlify --version</code>, and note how long the install takes."],
       say="The pipeline installs the Netlify CLI in its own job. .pre is a built-in stage that always runs first.",
       y="09-netlify-cli-pre.yml"),
  dict(t="Token and site ID", br="features/netlify", chip=("passed", "passed"), wait="~1.5 min",
       do=["<strong>Off camera:</strong> Netlify → User settings → Applications → <em>New access token</em>; copy it.",
           "GitLab <em>Settings → CI/CD → Variables → Add variable</em>: <code>NETLIFY_AUTH_TOKEN</code>, <em>Masked</em>, <strong>not</strong> Protected. Show the variable list (value hidden).",
           "Web IDE on <code>features/netlify</code>: step 10 with your site ID → commit.",
           "Job log: <code>netlify status</code> shows your account and site; the site ID is echoed."],
       say="The CLI looks for two environment variables by exact name. The site ID isn't secret, so it's in the YAML. The token is a masked project variable, so it never appears in the code or the logs. netlify status confirms the pipeline can reach the site.",
       y="10-netlify-status.yml"),
  dict(t="Deploy to UAT with a smoke test", br="features/netlify", chip=("passed", "passed"), wait="~2 min",
       do=["Step 11 with site ID and site name → commit.",
           "Job log: the deploy URL, then the <code>curl … | grep 'GitLab'</code> line printing the page title.",
           "Open <code>https://uat--&lt;site-name&gt;.netlify.app</code>."],
       say="The deploy job runs after the build and uploads build/ to a UAT alias. The smoke test downloads the page and looks for the word GitLab; if it's missing, grep fails and so does the job.",
       y="11-netlify-deploy-smoke.yml"),
  dict(t="UAT, then production after approval", br="features/netlify → main", chip=("blocked", "manual ▶ → passed"), wait="~3 min",
       do=["Step 12 → commit. On the branch pipeline the deploy jobs are gone (rules: main only).",
           "Create the merge request → wait for green → <em>Merge</em>.",
           "Main pipeline: <code>netlify_uat</code> runs automatically; <code>netlify_prod</code> waits with a ▶ button.",
           "Click ▶. Show the prod log and open <code>https://&lt;site-name&gt;.netlify.app</code>."],
       say="Deployments now happen only on main, after a merge. UAT deploys automatically. Production needs a person to approve, so it waits until I press play.",
       y="12-netlify-uat-prod-manual.yml"),
 ]),
 ("aws", "Part 3", "Deploy to AWS", "Sync the same build to an S3 bucket configured as a public static website.", [
  dict(t="IAM user and access key", br=None, chip=None, wait=None,
       do=["AWS console → IAM → Users → <code>gitlab</code> → attach <code>AmazonS3FullAccess</code> (or the policy in <code>aws/iam-s3-deploy-policy.json</code>).",
           "<em>Create access key</em> → Command Line Interface → download the CSV. <strong>Don't show the secret on camera.</strong>"],
       say="The pipeline needs its own AWS identity. This IAM user can only use S3, and its access key goes into GitLab as a secret."),
  dict(t="S3 bucket as a static website", br=None, chip=None, wait=None,
       do=["S3 → Create bucket: general purpose, unique name, <code>us-east-1</code>, untick <em>Block all public access</em>, acknowledge.",
           "Permissions → Bucket policy → paste <code>aws/s3-bucket-policy.json</code> with your bucket name.",
           "Properties → Static website hosting → Enable, index document <code>index.html</code>. Copy the endpoint URL."],
       say="The bucket is public read-only, so anyone can view the site but only our IAM user can write to it. Static website hosting serves index.html at this endpoint."),
  dict(t="AWS keys as CI/CD variables", br=None, chip=None, wait=None,
       do=["GitLab → <em>Settings → CI/CD → Variables</em>: <code>AWS_ACCESS_KEY_ID</code> and <code>AWS_SECRET_ACCESS_KEY</code> (Masked).",
           "Show the variable list with the three secrets."],
       say="The AWS CLI reads these exact variable names, so the job needs no login step."),
  dict(t="Deploy to S3 from the pipeline", br="features/aws → main", chip=("passed", "passed"), wait="~3 min",
       do=["Web IDE: step 13 with your bucket name → commit → new branch <code>features/aws</code> → MR → <em>Merge</em>.",
           "Main pipeline: open <code>aws_s3</code>: the bucket listing before and after <code>aws s3 sync</code>.",
           "<code>aws_smoke_test</code> is green. Open <code>http://&lt;bucket&gt;.s3-website-us-east-1.amazonaws.com</code>."],
       say="The aws_s3 job uses Amazon's CLI image and syncs the build folder to the bucket. The listing shows the bucket before and after the upload, and the smoke test checks the live site. The same build now runs on Netlify and on AWS.",
       y="13-aws-s3-final.yml"),
  dict(t="Wrap-up", br=None, chip=None, wait=None,
       do=["Show the final pipeline graph on main and the project's pipeline list."],
       say="To recap: a CI pipeline with build, tests and reports; merge requests protecting main; continuous delivery to Netlify with UAT and a manual production gate; and a deployment to AWS S3."),
 ]),
]

CHIP_LABEL = {"passed": "passed", "failed": "failed", "blocked": "manual"}

def scene_html(pid, i, s):
    sid = f"{pid}-{i}"
    head = f'<span class="snum">{i}</span><h3>{s["t"]}</h3>'
    meta = []
    if s["br"]:
        meta.append(f'<span class="branch" title="branch">⎇ {html.escape(s["br"])}</span>')
    if s["chip"]:
        k, label = s["chip"]
        meta.append(f'<span class="chip chip-{k}"><i></i>{label}</span>')
    if s["wait"]:
        meta.append(f'<span class="wait">pipeline {s["wait"]}</span>')
    do = "".join(f"<li>{d}</li>" for d in s["do"])
    yhtml = ""
    if s.get("y"):
        name, body = yml(s["y"])
        yhtml = f'''<details class="yml"><summary><span>.gitlab-ci.yml</span><code>pipelines/{name}</code></summary>
<div class="codewrap"><button class="copy" type="button" data-target="code-{sid}">Copy</button><pre id="code-{sid}"><code>{body}</code></pre></div></details>'''
    return f'''<article class="scene" id="{sid}">
<header class="shead"><label class="done"><input type="checkbox" id="chk-{sid}" data-key="{sid}"><span class="sr">Mark scene {i} recorded</span></label>{head}</header>
<div class="meta">{"".join(meta)}</div>
<div class="cols"><div class="col"><div class="lbl">Do</div><ol class="do">{do}</ol></div>
<div class="col"><div class="lbl">Say</div><blockquote class="say">{s["say"]}</blockquote></div></div>
{yhtml}</article>'''

parts_html = []
toc = []
for pid, plabel, ptitle, pdesc, scenes in PARTS:
    toc.append(f'<li><a href="#{pid}"><span>{plabel}</span>{ptitle}</a><ol>' + "".join(f'<li><a href="#{pid}-{i}">{s["t"]}</a></li>' for i, s in enumerate(scenes, 1)) + "</ol></li>")
    parts_html.append(f'<section class="part" id="{pid}"><div class="phead"><span class="plabel">{plabel}</span><h2>{ptitle}</h2><p>{pdesc}</p></div>' + "".join(scene_html(pid, i, s) for i, s in enumerate(scenes, 1)) + "</section>")

page = f'''<title>GitLab CI/CD Recording Script</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
/* Layout: sticky stage rail on the left (like a pipeline graph), scenes as a vertical run log on the right. */
:root {{
  --bg: #f6f7f9; --surface: #ffffff; --fg: #1b2230; --muted: #5d6676; --line: #dde1e8;
  --accent: #3b5bdb; --accent-soft: #e7ecfd; --code-bg: #f0f2f6; --mark: #fff1b8;
  --ok: #1f8a4c; --ok-soft: #e3f5ea; --bad: #c92a2a; --bad-soft: #fde8e8; --man: #6b4fc9; --man-soft: #eee9fb;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #12151c; --surface: #1a1f29; --fg: #e4e8f0; --muted: #98a1b2; --line: #2c3340;
  --accent: #8ea4ff; --accent-soft: #232c4a; --code-bg: #141821; --mark: #5a4a12;
  --ok: #5fd08f; --ok-soft: #173826; --bad: #ff8a8a; --bad-soft: #3d1c1c; --man: #b9a6ff; --man-soft: #2b2447; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #12151c; --surface: #1a1f29; --fg: #e4e8f0; --muted: #98a1b2; --line: #2c3340;
  --accent: #8ea4ff; --accent-soft: #232c4a; --code-bg: #141821; --mark: #5a4a12;
  --ok: #5fd08f; --ok-soft: #173826; --bad: #ff8a8a; --bad-soft: #3d1c1c; --man: #b9a6ff; --man-soft: #2b2447; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--fg); font: 15px/1.55 var(--sans); }}
.wrap {{ max-width: 1180px; margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; grid-template-columns: 240px minmax(0,1fr); gap: 40px; }}
.intro {{ grid-column: 1 / -1; display: grid; gap: 14px; max-width: 760px; }}
.eyebrow {{ font: 500 12px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }}
h1 {{ margin: 0; font-size: clamp(26px, 4vw, 36px); line-height: 1.15; font-weight: 600; text-wrap: balance; }}
.intro p {{ margin: 0; color: var(--muted); max-width: 65ch; }}
.facts {{ display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 13px; color: var(--muted); }}
.facts b {{ color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; }}
.prep {{ grid-column: 1 / -1; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; display: grid; gap: 10px; }}
.prep h2 {{ margin: 0; font-size: 15px; font-weight: 600; }}
.prep ul {{ margin: 0; padding-left: 20px; display: grid; gap: 4px; columns: 2; column-gap: 32px; }}
.prep li {{ break-inside: avoid; }}
nav {{ position: sticky; top: calc(env(safe-area-inset-top, 0px) + 16px); align-self: start; max-height: calc(100vh - 32px); overflow: auto; font-size: 13px; }}
nav > ol {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 18px; position: relative; }}
nav > ol > li > a {{ display: grid; gap: 2px; font-weight: 600; color: var(--fg); text-decoration: none; }}
nav > ol > li > a span {{ font: 500 11px/1 var(--mono); color: var(--accent); letter-spacing: .06em; text-transform: uppercase; }}
nav ol ol {{ list-style: none; margin: 8px 0 0; padding: 0 0 0 12px; border-left: 2px solid var(--line); display: grid; gap: 5px; }}
nav ol ol a {{ color: var(--muted); text-decoration: none; display: block; }}
nav ol ol a.done {{ text-decoration: line-through; opacity: .6; }}
nav a:hover, nav a:focus-visible {{ color: var(--accent); }}
main {{ display: grid; gap: 56px; min-width: 0; }}
.part {{ display: grid; gap: 16px; scroll-margin-top: 16px; }}
.phead {{ display: grid; gap: 6px; padding-bottom: 6px; border-bottom: 2px solid var(--fg); }}
.plabel {{ font: 500 12px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }}
.phead h2 {{ margin: 0; font-size: 24px; font-weight: 600; }}
.phead p {{ margin: 0; color: var(--muted); max-width: 65ch; }}
.scene {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; display: grid; gap: 10px; scroll-margin-top: 16px; }}
.scene.is-done {{ opacity: .55; }}
.shead {{ display: flex; align-items: center; gap: 10px; }}
.shead h3 {{ margin: 0; font-size: 16px; font-weight: 600; }}
.snum {{ font: 500 12px/1 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; min-width: 1.6em; }}
.done {{ display: inline-flex; }}
.done input {{ width: 18px; height: 18px; accent-color: var(--accent); margin: 0; cursor: pointer; }}
.sr {{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }}
.meta {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }}
.meta:empty {{ display: none; }}
.branch {{ font: 500 12px/1 var(--mono); padding: 5px 8px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); }}
.chip {{ display: inline-flex; align-items: center; gap: 6px; font: 500 12px/1 var(--sans); padding: 4px 10px 4px 8px; border-radius: 999px; }}
.chip i {{ width: 8px; height: 8px; border-radius: 50%; background: currentColor; }}
.chip-passed {{ background: var(--ok-soft); color: var(--ok); }}
.chip-failed {{ background: var(--bad-soft); color: var(--bad); }}
.chip-blocked {{ background: var(--man-soft); color: var(--man); }}
.wait {{ font: 12px/1 var(--mono); color: var(--muted); }}
.cols {{ display: grid; grid-template-columns: minmax(0,1.15fr) minmax(0,1fr); gap: 20px; }}
.col {{ min-width: 0; display: grid; gap: 6px; align-content: start; }}
.lbl {{ font: 500 11px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }}
.do {{ margin: 0; padding-left: 20px; display: grid; gap: 5px; }}
.say {{ margin: 0; padding: 10px 14px; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 8px 8px 0; font-style: italic; }}
code {{ font: 13px/1.4 var(--mono); background: var(--code-bg); padding: 1px 5px; border-radius: 4px; overflow-wrap: anywhere; }}
.yml {{ border-top: 1px dashed var(--line); padding-top: 8px; }}
.yml summary {{ cursor: pointer; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: 13px; font-weight: 500; color: var(--accent); }}
.yml summary code {{ color: var(--muted); }}
.codewrap {{ position: relative; margin-top: 8px; }}
.codewrap pre {{ margin: 0; background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; overflow-x: auto; max-height: 460px; }}
.codewrap pre code {{ background: none; padding: 0; white-space: pre; overflow-wrap: normal; }}
mark {{ background: var(--mark); color: inherit; border-radius: 3px; padding: 0 2px; }}
.copy {{ position: absolute; top: 8px; right: 8px; font: 500 12px/1 var(--sans); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); cursor: pointer; }}
.copy:hover {{ border-color: var(--accent); color: var(--accent); }}
:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
@media (max-width: 860px) {{
  .wrap {{ grid-template-columns: minmax(0,1fr); gap: 28px; }}
  nav {{ position: static; max-height: none; }}
  nav ol ol {{ display: none; }}
  nav > ol {{ display: flex; flex-wrap: wrap; gap: 12px 20px; }}
  .cols {{ grid-template-columns: minmax(0,1fr); }}
  .prep ul {{ columns: 1; }}
}}
@media (prefers-reduced-motion: no-preference) {{ html {{ scroll-behavior: smooth; }} }}
</style>
<div class="wrap">
  <header class="intro">
    <span class="eyebrow">AIDE501 · Assignment 2</span>
    <h1>GitLab CI/CD recording script</h1>
    <p>Scene-by-scene script for the video. Each scene says what to do on screen, what to say, and what result to show. The pipeline for each step is attached and can be copied straight into the Web IDE as <code>.gitlab-ci.yml</code>. Highlighted values must be replaced with your own.</p>
    <div class="facts"><span><b>3</b> parts</span><span><b>21</b> scenes</span><span>Video <b>12–15 min</b> after cutting pipeline waits</span><span>Recording session <b>~2 h</b></span></div>
  </header>
  <section class="prep" aria-labelledby="prep-h">
    <h2 id="prep-h">Before you press record</h2>
    <ul>
      <li>New project via <em>Import project → Repository by URL</em> from <code>anhlab1/exercise4</code>, Public. No fork.</li>
      <li>Delete the imported <code>.gitlab-ci.yml</code> (it is the professor's finished pipeline).</li>
      <li>Shared runners work on your account (a test pipeline doesn't stay <em>pending</em>).</li>
      <li>Netlify account open in a tab; AWS console signed in.</li>
      <li>Keep secrets off camera: tokens and secret keys go in while paused.</li>
      <li>Pause the recording (or cut later) while pipelines run.</li>
    </ul>
  </section>
  <nav aria-label="Scenes"><ol>{"".join(toc)}</ol></nav>
  <main>{"".join(parts_html)}</main>
</div>
<script>
(function () {{
  var KEY = "a2-recorded";
  var state = {{}};
  try {{ state = JSON.parse(localStorage.getItem(KEY) || "{{}}"); }} catch (e) {{ state = {{}}; }}
  function paint(id) {{
    var on = !!state[id];
    var art = document.getElementById(id); if (art) art.classList.toggle("is-done", on);
    var link = document.querySelector('nav a[href="#' + id + '"]'); if (link) link.classList.toggle("done", on);
  }}
  document.querySelectorAll(".done input").forEach(function (box) {{
    var id = box.dataset.key; box.checked = !!state[id]; paint(id);
    box.addEventListener("change", function () {{
      state[id] = box.checked; paint(id);
      try {{ localStorage.setItem(KEY, JSON.stringify(state)); }} catch (e) {{}}
    }});
  }});
  document.querySelectorAll(".copy").forEach(function (btn) {{
    btn.addEventListener("click", function () {{
      var pre = document.getElementById(btn.dataset.target);
      var text = pre.textContent;
      function selectIt() {{ var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected, press ⌘C"; }}
      var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject();
      p.then(function () {{ btn.textContent = "Copied"; }}, selectIt);
      setTimeout(function () {{ btn.textContent = "Copy"; }}, 2200);
    }});
  }});
}})();
</script>
'''
OUT.write_text(page)
n = sum(len(p[4]) for p in PARTS)
print("scenes", n, "bytes", len(page), OUT)
