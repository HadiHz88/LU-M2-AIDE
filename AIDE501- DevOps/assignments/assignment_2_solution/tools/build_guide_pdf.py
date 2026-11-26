"""Build WORKING-GUIDE.pdf: the click-by-click guide for doing and recording Assignment 2.

Usage: python tools/build_guide_pdf.py <assignment_2_solution dir>      (needs reportlab)
The pipeline listings are read from pipelines/*.yml, so the PDF always matches the files.
"""
import sys, pathlib
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                XPreformatted, PageBreak, KeepTogether, CondPageBreak)

SOL = pathlib.Path(sys.argv[1])
OUT = SOL / "WORKING-GUIDE.pdf"

INK = colors.HexColor("#1b2230"); MUTED = colors.HexColor("#5d6676"); LINE = colors.HexColor("#dde1e8")
ACCENT = colors.HexColor("#3b5bdb"); CODEBG = colors.HexColor("#f2f4f8"); WARN = colors.HexColor("#b35c00")
TAGCOL = {"GO": "#3b5bdb", "CLICK": "#6b4fc9", "TYPE": "#1f7a8c", "PASTE": "#1f7a8c",
          "SHOW": "#1f8a4c", "SAY": "#5d6676", "CHECK": "#1f8a4c", "NOTE": "#b35c00", "OFF-CAM": "#c92a2a"}

base = dict(fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK)
st = {
 "title": ParagraphStyle("title", **{**base, "fontName": "Helvetica-Bold", "fontSize": 22, "leading": 27}),
 "sub": ParagraphStyle("sub", **{**base, "fontSize": 11, "leading": 15, "textColor": MUTED}),
 "h1": ParagraphStyle("h1", **{**base, "fontName": "Helvetica-Bold", "fontSize": 15, "leading": 19, "spaceBefore": 6, "spaceAfter": 6, "textColor": ACCENT}),
 "h2": ParagraphStyle("h2", **{**base, "fontName": "Helvetica-Bold", "fontSize": 11.5, "leading": 15, "spaceBefore": 10, "spaceAfter": 4}),
 "body": ParagraphStyle("body", **{**base, "spaceAfter": 4}),
 "small": ParagraphStyle("small", **{**base, "fontSize": 8.5, "leading": 11.5, "textColor": MUTED}),
 "cell": ParagraphStyle("cell", **{**base, "fontSize": 9, "leading": 12.5}),
 "tag": ParagraphStyle("tag", **{**base, "fontName": "Helvetica-Bold", "fontSize": 7.5, "leading": 12.5, "textColor": colors.white, "alignment": 1}),
 "code": ParagraphStyle("code", fontName="Courier", fontSize=7.6, leading=9.6, textColor=INK),
 "meta": ParagraphStyle("meta", **{**base, "fontSize": 8.5, "leading": 12, "textColor": MUTED}),
}

def c(s):  # inline code; real URLs become clickable links
    f = f'<font name="Courier" size="8.8" color="#1f3d99">{escape(s)}</font>'
    if s.startswith("http") and "<" not in s:
        return f'<link href="{escape(s)}">{f}</link>'
    return f

def P(t, s="body"): return Paragraph(t, st[s])

def table(rows, widths, header=True):
    data = [[P(x, "cell") if isinstance(x, str) else x for x in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
             ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if header: style.append(("BACKGROUND", (0, 0), (-1, 0), CODEBG))
    t.setStyle(TableStyle(style)); return t

def actions(lines):
    rows = []
    for tag, text in lines:
        tg = Table([[P(tag, "tag")]], colWidths=[17 * mm])
        tg.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(TAGCOL[tag])),
                                ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                                ("LEFTPADDING", (0, 0), (-1, -1), 1), ("RIGHTPADDING", (0, 0), (-1, -1), 1)]))
        rows.append([tg, P(text, "cell")])
    t = Table(rows, colWidths=[19 * mm, 155 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    return t

def code_block(name):
    lines = (SOL / "pipelines" / name).read_text().rstrip().split("\n")
    chunks = [lines[i:i + 30] for i in range(0, len(lines), 30)]  # one row per chunk so the table can split across pages
    label = P(f'<b>pipelines/{name}</b> - select all in the Web IDE editor (Cmd+A), delete, paste this:', "small")
    rows = [[XPreformatted(escape("\n".join(ch)), st["code"])] for ch in chunks]
    story.append(CondPageBreak(45 * mm))
    story.append(label); story.append(Spacer(1, 3))
    t = Table(rows, colWidths=[174 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CODEBG), ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                           ("LEFTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, 0), 6),
                           ("BOTTOMPADDING", (0, -1), (-1, -1), 6)]))
    return t

story = []
def step(num, title, where, lines, yml=None, expect=None):
    head = [CondPageBreak(60 * mm), P(f"Step {num} &nbsp; {title}", "h2")]
    if where: head.append(P(f"Branch: {c(where)}" + (f" &nbsp;|&nbsp; Expected: <b>{expect}</b>" if expect else ""), "meta"))
    elif expect: head.append(P(f"Expected: <b>{expect}</b>", "meta"))
    story.extend(head); story.append(Spacer(1, 3)); story.append(actions(lines))
    if yml: story.append(Spacer(1, 5)); story.append(code_block(yml))  # code_block appends its own label first

COMMIT_MAIN = ("CLICK", "Left bar <b>Source Control</b> icon (3rd icon) -> type the commit message in the box -> "
               "<b>Commit and push to 'main'</b>. Then click <b>Go to project</b> in the bottom-right notification.")
def commit_branch(branch, first=False):
    if first:
        return ("CLICK", f"Source Control -> message -> <b>Commit and push to 'main'</b>. GitLab answers that main is protected "
                f"and offers a new branch: choose <b>Yes, commit to a new branch</b>, type {c(branch)}, press Enter.")
    return ("CLICK", f"Source Control -> message -> <b>Commit and push to '{escape(branch)}'</b> (the Web IDE is already on that branch).")
OPEN_PIPE = ("GO", "Project left sidebar -> <b>Build -> Pipelines</b> -> click the newest pipeline's status badge to open its graph.")

# ------------------------------------------------------------------ cover
story += [P("AIDE501 - Assignment 2", "sub"), P("GitLab CI/CD Lab: working guide", "title"), Spacer(1, 4),
          P("Click-by-click instructions for doing and recording the three graded parts: <b>GitLab CI</b>, "
            "<b>Continuous Delivery (Netlify)</b> and <b>Deploy to a public cloud (AWS S3)</b>. "
            "Every pipeline you type is printed in full. Tags on each line say what kind of action it is.", "sub"),
          Spacer(1, 8)]
story.append(table([["Tag", "Meaning"],
    ["GO", "Navigate to a page / menu."], ["CLICK", "Press a button or menu item."], ["TYPE / PASTE", "Enter exactly this text."],
    ["SHOW", "Point at this on camera (hover, scroll, zoom in)."], ["SAY", "Suggested narration."],
    ["CHECK", "Verify before moving on."], ["OFF-CAM", "Pause the recording: secrets on screen."], ["NOTE", "Pitfall or explanation."]],
    [30 * mm, 144 * mm]))

story += [P("1. What is asked", "h1"),
  P("Deliverable: <b>one short video</b> showing a successful run of the three main parts of the lab PDF "
    f"({c('AIDE501- DevOps/assignments/Assignment 2.pdf')}, 40 pages): GitLab CI (pp. 2-16), Continuous Delivery (pp. 17-27), "
    "Deploy to a public cloud environment (pp. 27-35). The <i>Embedding Security</i> section (pp. 35-40) is not required."),
  P("Professor's clarification: create <b>a new project of your own</b> and use only the files from the lab repository. "
    "<b>No fork, no pull/merge request or push back to the lab repository.</b> Merge requests inside your own project are part of the lab and are fine."),
  P("Decision: everything happens in <b>one</b> GitLab project (the PDF makes a second fork for AWS; not needed)."),
  P("2. Links", "h1")]
story.append(table([["What", "Where"],
  ["Lab repository (source files only)", c("https://gitlab.com/anhlab1/exercise4")],
  ["GitLab: import a project", c("https://gitlab.com/projects/new#import_project")],
  ["Netlify dashboard", c("https://app.netlify.com")],
  ["Netlify personal access tokens", c("https://app.netlify.com/user/applications#personal-access-tokens")],
  ["Netlify CLI docs", c("https://docs.netlify.com/cli/get-started/")],
  ["GitLab predefined CI variables", c("https://docs.gitlab.com/ci/variables/predefined_variables/")],
  ["AWS IAM users", c("https://console.aws.amazon.com/iam/home#/users")],
  ["AWS S3 (us-east-1)", c("https://s3.console.aws.amazon.com/s3/home?region=us-east-1")],
  ["AWS CLI environment variables", c("https://docs.aws.amazon.com/sdkref/latest/guide/settings-reference.html#EVarSettings")],
  ["Recording script (web, copy buttons)", c("https://claude.ai/artifact/Gxkgk8z6WTmzfhjEx94Jet")],
  ["Your UAT site / prod site", c("https://uat--<site-name>.netlify.app") + " / " + c("https://<site-name>.netlify.app")],
  ["Your S3 website", c("http://<bucket>.s3-website-us-east-1.amazonaws.com")]],
  [55 * mm, 119 * mm]))

story += [P("3. What is already provided (repo folder assignment_2_solution/)", "h1")]
story.append(table([["File", "Use it for"],
  [c("pipelines/01 ... 13-*.yml"), "The exact .gitlab-ci.yml content at every step. Printed in full below."],
  [c(".gitlab-ci.yml"), "Final pipeline (= step 13)."],
  [c("aws/s3-bucket-policy.json"), "Bucket policy to paste in S3 (replace the bucket name)."],
  [c("aws/iam-s3-deploy-policy.json"), "Optional least-privilege policy instead of AmazonS3FullAccess."],
  [c("recording-script.html"), "Scene list with narration; same as the web artifact."],
  [c("README.md"), "Overview, variables table, list of fixes to the PDF."],
  [c("HANDOFF.md"), "Context for a new session."],
  [c("tools/"), "Generators for this PDF and the recording script."]],
  [62 * mm, 112 * mm]))

story += [P("4. Values you will collect (write them here)", "h1")]
story.append(table([["Name", "Where it comes from", "Goes into", "Value"],
  ["Netlify site name", "Netlify -> project configuration", c("NETLIFY_SITE_NAME") + " in YAML", ""],
  ["Netlify site/project ID", "Netlify -> project configuration", c("NETLIFY_SITE_ID") + " in YAML", ""],
  ["Netlify token", "Netlify -> user settings -> Applications", "GitLab variable " + c("NETLIFY_AUTH_TOKEN"), "(secret, don't write)"],
  ["S3 bucket name", "you choose, globally unique", c("AWS_S3_BUCKET") + " in YAML + bucket policy", ""],
  ["AWS access key ID", "IAM CSV", "GitLab variable " + c("AWS_ACCESS_KEY_ID"), "(secret)"],
  ["AWS secret key", "IAM CSV", "GitLab variable " + c("AWS_SECRET_ACCESS_KEY"), "(secret)"]],
  [32 * mm, 50 * mm, 52 * mm, 40 * mm]))
story.append(Spacer(1, 4))
story.append(P(f"In every YAML below, replace each {c('REPLACE-WITH-...')} placeholder with these values before committing.", "small"))

# ------------------------------------------------------------------ setup
story += [PageBreak(), P("5. Setup (before recording)", "h1")]
step("S1", "Create your own project from the lab files", None, [
  ("GO", c("https://gitlab.com/projects/new#import_project") + " -> <b>Repository by URL</b>."),
  ("TYPE", f"Git repository URL: {c('https://gitlab.com/anhlab1/exercise4.git')} (no username/password)."),
  ("TYPE", f"Project name e.g. {c('gitlab-cicd-lab')}; namespace: your user; Visibility: <b>Public</b>."),
  ("CLICK", "<b>Create project</b>. Wait for the import to finish."),
  ("NOTE", "Do not use the Fork button: the professor asked for a new project with no link to the lab repository.")])
step("S2", "Remove the professor's finished pipeline", "main", [
  ("GO", f"Project -> click {c('.gitlab-ci.yml')} in the file list -> <b>Delete</b> (or open it in the Web IDE, right-click -> Delete)."),
  ("TYPE", f"Commit message {c('remove lab pipeline')} -> commit to {c('main')}."),
  ("NOTE", f"It contains the professor's Netlify site ID. {c('.gitlab-ci-start.yml')} and {c('.gitlab-ci.-v1.yml')} can stay: only {c('.gitlab-ci.yml')} runs.")])
step("S3", "Make sure runners work", None, [
  ("GO", "Build -> Pipelines. If a pipeline ran from the import or deletion, it should not be stuck in <i>pending</i>."),
  ("CHECK", "If GitLab asks you to <b>verify your account</b> (phone or card) for shared runners, do it now; otherwise no job will start."),
  ("GO", "Settings -> CI/CD -> Runners (expand): <b>Enable instance runners for this project</b> must be on.")])
step("S4", "Web IDE whitespace setting (PDF p.3)", None, [
  ("GO", "Project page -> <b>Code</b> (or <b>Edit</b>) dropdown -> <b>Web IDE</b>. Shortcut: press <b>.</b> on the project page."),
  ("CLICK", "Gear icon bottom-left -> <b>Settings</b> -> search " + c("whitespace") + " -> <b>Editor: Render Whitespace</b> = <b>all</b>."),
  ("NOTE", "YAML indentation must be spaces. Visible whitespace helps you spot a tab or a wrong indent.")])
step("S5", "Prepare accounts", None, [
  ("CHECK", "Netlify: signed in at app.netlify.com in a browser tab."),
  ("CHECK", "AWS: signed in to the console, region selector (top right) on <b>US East (N. Virginia) us-east-1</b>."),
  ("CHECK", "Screen recorder ready: macOS <b>Cmd+Shift+5</b> -> Record Selected Portion / Entire Screen -> Options -> microphone. Pause/stop from the menu bar.")])

# ------------------------------------------------------------------ part 1
story += [PageBreak(), P("6. Part 1 - GitLab CI (PDF pp. 2-16)", "h1"),
          P("All of Part 1 until step 1.10 commits directly to <b>main</b>. Start recording.")]
step("1.1", "Show the project", None, [
  ("SHOW", f"Project page: your namespace, Public badge, files {c('src/')}, {c('package.json')}, {c('vite.config.js')}; no {c('.gitlab-ci.yml')}."),
  ("SAY", "This is my own GitLab project created from the lab files: a small React app built with Vite. There is no pipeline yet.")])
step("1.2", "First pipeline on alpine", "main", [
  ("GO", "Open the Web IDE (press <b>.</b>)."),
  ("CLICK", f"Explorer -> <b>New File</b> icon -> name {c('.gitlab-ci.yml')} -> Enter."),
  ("PASTE", "The YAML below."), ("TYPE", f"Commit message: {c('first pipeline run')}"), COMMIT_MAIN,
  OPEN_PIPE, ("CLICK", f"Click the failed job {c('test_npm')}."),
  ("SHOW", f"The log line {c('node: not found')} and the red <b>failed</b> status."),
  ("SAY", "The job failed: alpine is a minimal Linux image without Node or npm.")],
  "01-first-job-fails.yml", "failed (on purpose)")
step("1.3", "Fix with node:22", "main", [
  ("GO", "Back in the Web IDE (browser tab still open, or press . again)."), ("PASTE", "Replace the whole file with the YAML below."),
  ("TYPE", f"Commit message: {c('node 22')}"), COMMIT_MAIN, OPEN_PIPE,
  ("SHOW", "Job log: the printed node and npm versions; the job <b>duration</b> at the top of the job page.")],
  "02-node22.yml", "passed")
step("1.4", "Smaller image", "main", [
  ("PASTE", "YAML below."), ("TYPE", f"Commit message: {c('slim image')}"), COMMIT_MAIN, OPEN_PIPE,
  ("SHOW", "Compare the duration with step 1.3 (Build -> Pipelines list shows both)."),
  ("SAY", "node:23-slim is about 75 MB instead of 370 MB, so it pulls faster.")],
  "03-slim-image.yml", "passed")
step("1.5", "Stages and a real build", "main", [
  ("PASTE", "YAML below."), ("TYPE", f"Commit message: {c('adding stages')}"), COMMIT_MAIN, OPEN_PIPE,
  ("CLICK", f"Job {c('build_website')}."),
  ("SHOW", f"First {c('ls -la')}, then {c('npm ci')}, {c('npm run build')}, second {c('ls -la')} now listing {c('build')}."),
  ("SAY", "npm ci installs the exact versions from package-lock.json, so the build is reproducible.")],
  "04-stages.yml", "passed")
step("1.6", "Keep build/ as an artifact", "main", [
  ("PASTE", "YAML below."), ("TYPE", f"Commit message: {c('artifacts')}"), COMMIT_MAIN, OPEN_PIPE,
  ("CLICK", f"Job {c('build_website')} -> right panel <b>Job artifacts</b> -> <b>Browse</b> -> open {c('build/')}."),
  ("SHOW", f"{c('index.html')} and {c('assets/')} inside the artifact."),
  ("NOTE", "Later (step 2.1) you will click <b>Download</b> on this same panel to get the build folder for Netlify.")],
  "05-artifacts.yml", "passed")
step("1.7", "Test the artifact", "main", [
  ("PASTE", "YAML below."), ("TYPE", f"Commit message: {c('test artifact')}"), COMMIT_MAIN, OPEN_PIPE,
  ("SHOW", f"Graph: {c('build_website')} -> {c('test_artifact')}; open test_artifact and show {c('test -f build/index.html')} succeeded.")],
  "06-test-artifact.yml", "passed")
step("1.8", "Unit tests, sequential", "main", [
  ("PASTE", "YAML below."), ("TYPE", f"Commit message: {c('unit tests')}"), COMMIT_MAIN, OPEN_PIPE,
  ("SHOW", "Three stages in a row: build -> test -> unit. Note the total duration on the pipeline page.")],
  "07-unit-tests-sequential.yml", "passed")
step("1.9", "Parallel tests + JUnit report", "main", [
  ("PASTE", "YAML below."), ("TYPE", f"Commit message: {c('parallel tests and junit')}"), COMMIT_MAIN, OPEN_PIPE,
  ("SHOW", "Two jobs side by side in the <b>test</b> column; shorter total duration than 1.8."),
  ("CLICK", "Pipeline page -> <b>Tests</b> tab -> click the suite -> show each test with status and time."),
  ("SAY", "Vitest writes reports/junit.xml (configured in vite.config.js); GitLab reads it and shows the Tests tab.")],
  "08-parallel-junit.yml", "passed")
step("1.10", "Merge-request rules and branch protection", None, [
  ("GO", "Settings -> <b>Merge requests</b>."),
  ("CLICK", "Merge method: <b>Fast-forward merge</b>. Squash commits when merging: <b>Encourage</b>."),
  ("CLICK", "Merge checks: tick <b>Pipelines must succeed</b> and <b>All threads must be resolved</b>. -> <b>Save changes</b>."),
  ("GO", "Settings -> <b>Repository</b> -> <b>Protected branches</b> -> Expand."),
  ("CLICK", f"Row {c('main')}: <b>Allowed to merge</b> = Maintainers; <b>Allowed to push and merge</b> = <b>No one</b>; force push off."),
  ("NOTE", "Do not set <i>Allowed to merge</i> to No one, or you cannot merge your own merge requests."),
  ("SAY", "Nobody can push to main directly any more; every change needs a merge request with a green pipeline.")])
step("1.11", "Code review through a merge request", "features/improve-docs", [
  ("GO", "Web IDE on main."),
  ("TYPE", f"Add this as the very first line of {c('.gitlab-ci.yml')}: {c('# Learn GitLab CI/CD pipeline')}"),
  ("TYPE", f"Commit message: {c('improve docs')}"), commit_branch("features/improve-docs", first=True),
  ("CLICK", "Notification -> <b>Create MR</b> (or project -> Merge requests -> New)."),
  ("TYPE", f"Description: {c('Adds a header comment to the pipeline.')} -> <b>Create merge request</b>."),
  ("SHOW", "Merge button disabled while the pipeline runs; then green -> <b>Merge</b>."),
  ("SHOW", "Repository -> Commits on main: linear history.")], None, "passed, merged")

# ------------------------------------------------------------------ part 2
story += [PageBreak(), P("7. Part 2 - Continuous Delivery with Netlify (PDF pp. 17-27)", "h1"),
          P(f"From now on main is protected. Work on branch {c('features/netlify')}, then merge.")]
step("2.1", "Manual deployment", None, [
  ("GO", "GitLab: Build -> Pipelines -> latest main pipeline -> job build_website -> Job artifacts -> <b>Download</b>."),
  ("CLICK", f"Unzip {c('artifacts.zip')} in Finder -> you get a {c('build')} folder."),
  ("GO", "Netlify: <b>Add new project</b> -> <b>Deploy manually</b> (drag-and-drop area)."),
  ("CLICK", f"Drag the {c('build')} folder onto the drop area. Wait for <i>Published</i>."),
  ("GO", "Project configuration -> General -> Project details -> <b>Change project name</b>."),
  ("TYPE", f"A unique name, e.g. {c('hadi-gitlab-lab')}. Save. Open the site URL."),
  ("SHOW", "Project details: <b>Project name</b> and <b>Project ID</b>. Copy both into section 4."),
  ("SAY", "That was a manual deployment. It works, but it's error-prone. Now the pipeline will do it.")])
step("2.2", "Install the Netlify CLI in .pre", "features/netlify", [
  ("GO", "Web IDE (on main)."), ("PASTE", "YAML below."), ("TYPE", f"Commit message: {c('netlify cli')}"), commit_branch("features/netlify", first=True), OPEN_PIPE,
  ("SHOW", f"A <b>.pre</b> column runs first; job {c('netlify_deploy')} prints the CLI version. Note the install time.")],
  "09-netlify-cli-pre.yml", "passed")
step("2.3", "Netlify token as a secret variable", None, [
  ("OFF-CAM", c("https://app.netlify.com/user/applications#personal-access-tokens") + " -> <b>New access token</b> -> description " + c("gitlab-ci") + ", expiration 30 days -> Generate -> copy."),
  ("GO", "GitLab: Settings -> <b>CI/CD</b> -> <b>Variables</b> -> Expand -> <b>Add variable</b>."),
  ("TYPE", f"Key {c('NETLIFY_AUTH_TOKEN')}; Value = the token."),
  ("CLICK", "Visibility: <b>Masked</b>. Flags: <b>untick Protect variable</b>, untick Expand variable reference. -> <b>Add variable</b>."),
  ("NOTE", "A protected variable is only given to protected branches. features/netlify is not protected, so the Netlify jobs would see an empty token."),
  ("SHOW", "Resume recording: the variables list with the value hidden.")])
step("2.4", "Site ID + netlify status", "features/netlify", [
  ("GO", f"Web IDE. Bottom-left branch name must read {c('features/netlify')} (click it to switch if not)."),
  ("PASTE", f"YAML below, with your site ID in place of {c('REPLACE-WITH-YOUR-SITE-ID')}."),
  ("TYPE", f"Commit message: {c('netlify variables')}"), commit_branch("features/netlify"), OPEN_PIPE,
  ("SHOW", f"Job netlify_deploy: {c('netlify status')} prints your account email and site; the site ID is echoed."),
  ("SAY", "The CLI finds NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID by their exact names.")],
  "10-netlify-status.yml", "passed")
step("2.5", "Deploy to UAT + smoke test", "features/netlify", [
  ("PASTE", "YAML below; replace site ID and site name."), ("TYPE", f"Commit message: {c('deploy to uat with smoke test')}"), commit_branch("features/netlify"), OPEN_PIPE,
  ("SHOW", f"Job netlify_deploy (now in the <b>deploy</b> stage): the deploy URL, then the curl line printing {c('<title>Learn GitLab CI/CD</title>')}."),
  ("GO", f"Open {c('https://uat--<site-name>.netlify.app')} in a new tab."),
  ("SAY", "If the page doesn't contain the word GitLab, grep fails and the job fails: that's the smoke test.")],
  "11-netlify-deploy-smoke.yml", "passed")
step("2.6", "UAT on main, production after manual approval", "features/netlify -> main", [
  ("PASTE", "YAML below; replace site ID and site name."), ("TYPE", f"Commit message: {c('uat and prod with manual approval')}"), commit_branch("features/netlify"),
  ("SHOW", "Branch pipeline: only build and test jobs. The deploy jobs are gone because their rules allow main only."),
  ("CLICK", f"Code -> <b>Merge requests</b> -> <b>New merge request</b> -> source {c('features/netlify')}, target {c('main')} -> Compare -> <b>Create merge request</b>."),
  ("CLICK", "Wait for green -> <b>Merge</b> (if it says the branch must be rebased: click <b>Rebase</b> first)."),
  OPEN_PIPE,
  ("SHOW", f"Main pipeline: {c('netlify_uat')} runs and passes; {c('netlify_prod')} shows a <b>play</b> button; pipeline status <i>blocked</i>."),
  ("CLICK", "Press the <b>play</b> button on netlify_prod (Run job)."),
  ("SHOW", f"Prod log, then open {c('https://<site-name>.netlify.app')}."),
  ("SAY", "UAT deploys automatically after a merge; production waits for a human approval.")],
  "12-netlify-uat-prod-manual.yml", "UAT passed, prod manual -> passed")

# ------------------------------------------------------------------ part 3
story += [PageBreak(), P("8. Part 3 - Deploy to AWS S3 (PDF pp. 27-35)", "h1")]
step("3.1", "IAM user and access key", None, [
  ("GO", c("https://console.aws.amazon.com/iam/home#/users") + " -> <b>Create user</b>."),
  ("TYPE", f"User name {c('gitlab')}; leave console access unticked -> Next."),
  ("CLICK", "<b>Attach policies directly</b> -> search " + c("AmazonS3FullAccess") + " -> tick -> Next -> <b>Create user</b>."),
  ("NOTE", f"Optional least privilege: instead create an inline policy from {c('aws/iam-s3-deploy-policy.json')} with your bucket name."),
  ("CLICK", "Open user gitlab -> <b>Security credentials</b> -> <b>Create access key</b> -> <b>Command Line Interface (CLI)</b> -> tick the confirmation -> Next -> Create."),
  ("OFF-CAM", "<b>Download .csv file</b>. Don't show the secret access key on camera.")])
step("3.2", "S3 bucket as a static website", None, [
  ("GO", c("https://s3.console.aws.amazon.com/s3/home?region=us-east-1") + " -> <b>Create bucket</b>."),
  ("TYPE", f"Bucket type <b>General purpose</b>; name e.g. {c('hadi-gitlab-lab-2026')} (globally unique, lowercase); region us-east-1."),
  ("CLICK", "Object Ownership: leave <b>ACLs disabled</b>. Untick <b>Block all public access</b> and tick the acknowledgement. -> <b>Create bucket</b>."),
  ("CLICK", "Open the bucket -> <b>Permissions</b> -> Bucket policy -> <b>Edit</b>."),
  ("PASTE", f"Contents of {c('aws/s3-bucket-policy.json')} with your bucket name in the Resource ARN -> <b>Save changes</b>."),
  ("CLICK", "<b>Properties</b> -> Static website hosting -> <b>Edit</b> -> Enable -> Host a static website -> Index document " + c("index.html") + " -> Save."),
  ("SHOW", f"Copy the <b>Bucket website endpoint</b> (bottom of Properties): {c('http://<bucket>.s3-website-us-east-1.amazonaws.com')}.")])
story.append(Spacer(1, 4))
pol = (SOL / "aws" / "s3-bucket-policy.json").read_text().rstrip()
pt = Table([[XPreformatted(escape(pol), st["code"])]], colWidths=[174 * mm])
pt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CODEBG), ("BOX", (0, 0), (-1, -1), 0.5, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 6)]))
story.append(pt)
step("3.3", "AWS keys as GitLab variables", None, [
  ("GO", "GitLab: Settings -> CI/CD -> Variables -> Add variable (twice)."),
  ("TYPE", f"{c('AWS_ACCESS_KEY_ID')} = Access key ID from the CSV; {c('AWS_SECRET_ACCESS_KEY')} = Secret access key."),
  ("CLICK", "Visibility <b>Masked</b> (at least for the secret). Protect variable unticked is fine (the AWS job only runs on main anyway)."),
  ("SHOW", "Variables list with the three secrets, values hidden.")])
step("3.4", "Deploy to S3 from the pipeline", "features/aws -> main", [
  ("GO", f"Web IDE on {c('main')} (switch branch bottom-left; main now contains the Netlify pipeline)."),
  ("PASTE", "YAML below; replace site ID, site name and bucket name."),
  ("TYPE", f"Commit message: {c('deploy to aws s3')}"), commit_branch("features/aws", first=True),
  ("CLICK", "Create MR -> wait for green -> <b>Merge</b>."), OPEN_PIPE,
  ("SHOW", f"Job {c('aws_s3')}: {c('aws --version')}, bucket listing BEFORE (empty), {c('upload:')} lines from {c('aws s3 sync')}, listing AFTER."),
  ("SHOW", f"Job {c('aws_smoke_test')} passed (grep found GitLab)."),
  ("GO", "Open the bucket website endpoint in a new tab: the app is live."),
  ("NOTE", "netlify_prod again waits for play on this pipeline. You can press it or leave it; aws_s3 doesn't wait for it (needs: build_website)."),
  ("SAY", "The same build is now deployed to Netlify and to AWS S3 from one pipeline.")],
  "13-aws-s3-final.yml", "passed")
step("3.5", "Wrap-up shot", None, [
  ("SHOW", "Build -> Pipelines list (all green history) and the final main pipeline graph."),
  ("SAY", "Recap: CI with build, tests and reports; merge requests protecting main; CD to Netlify with UAT and a manual production gate; deployment to AWS S3. Stop recording.")])

# ------------------------------------------------------------------ troubleshooting
story += [PageBreak(), P("9. Troubleshooting", "h1")]
story.append(table([["Symptom", "Cause / fix"],
  ["Pipeline stays <i>pending</i> / asks to verify", "Account not validated for shared runners: verify on gitlab.com, or enable instance runners in Settings -> CI/CD -> Runners."],
  ["YAML error: <i>jobs config should contain...</i>, <i>mapping values are not allowed</i>", "Indentation. Paste the file again exactly; spaces only (whitespace rendering helps)."],
  [c("netlify status") + ": Not logged in", "NETLIFY_AUTH_TOKEN missing, misspelled, or marked Protected while on a feature branch."],
  [c("netlify deploy") + " starts building / " + c("vite: not found"), f"Missing {c('--no-build')}. Use the provided files."],
  [c("curl: (22) ... 404") + " or grep finds nothing", f"Wrong {c('NETLIFY_SITE_NAME')} (it's the part before .netlify.app)."],
  [c("apk: not found"), "apk only exists on alpine images; deploy jobs use node:22-alpine."],
  ["Merge button: <i>must be rebased</i>", "Fast-forward merge needs the branch up to date: click <b>Rebase</b> on the MR."],
  ["netlify_uat / netlify_prod missing", "Expected on feature branches (rules: main only). They appear on the main pipeline after merging."],
  ["Commit to main refused", "Expected after step 1.10. Commit to a new branch."],
  [c("InvalidAccessKeyId") + " / " + c("SignatureDoesNotMatch"), "AWS variables wrong (extra space, swapped)."],
  [c("AccessDenied") + " on " + c("aws s3 ls"), "IAM user lacks the S3 policy (or ListAllMyBuckets in the least-privilege policy)."],
  ["S3 site: 403 Forbidden", "Block public access still on, or bucket policy ARN has the wrong bucket name."],
  ["S3 site: 404", "Static website hosting not enabled, or index document not index.html, or the sync hasn't run."],
  ["Variable can't be masked", "Value must be 8+ characters on one line. Netlify tokens and AWS keys are fine."]],
  [62 * mm, 112 * mm]))
story += [P("10. After grading", "h1"),
  P("Delete the IAM access key (IAM -> gitlab -> Security credentials -> Actions -> Delete). Revoke the Netlify token. "
    "Optionally empty and delete the S3 bucket and the Netlify project.")]

def on_page(canv, doc):
    canv.saveState(); canv.setFont("Helvetica", 7.5); canv.setFillColor(MUTED)
    canv.drawString(18 * mm, 10 * mm, "AIDE501 Assignment 2 - GitLab CI/CD working guide")
    canv.drawRightString(A4[0] - 18 * mm, 10 * mm, f"{doc.page}"); canv.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                        title="AIDE501 Assignment 2 - GitLab CI/CD working guide", author="AIDE501")
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(OUT)
