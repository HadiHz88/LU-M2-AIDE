"""Build recording-script.html: the web version of the working guide (published as the artifact).

Usage: python tools/build_recording_script.py <assignment_2_solution dir>
Text comes from tools/guide_content.py (shared with WORKING-GUIDE.pdf); pipelines from pipelines/*.yml.
"""
import html, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import guide_content

SOL = pathlib.Path(sys.argv[1])
OUT = SOL / "recording-script.html"
ARTIFACT_URL = "https://claude.ai/artifact/Gxkgk8z6WTmzfhjEx94Jet"

esc = html.escape
TAGCLASS = {"GO": "go", "CLICK": "click", "TYPE": "type", "PASTE": "type", "SHOW": "show",
            "SAY": "say", "CHECK": "show", "NOTE": "note", "OFF-CAM": "off"}


def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:40]


def code_html(text, sid):
    body = re.sub(r"(REPLACE-WITH-[A-Z-]+)", r"<mark>\1</mark>", esc(text))
    return (f'<div class="codewrap"><button class="copy" type="button" data-target="{sid}">Copy</button>'
            f'<pre id="{sid}"><code>{body}</code></pre></div>')


class Web:
    header = []          # blocks before the first h1
    sections = []        # [{"id","title","items":[html...],"steps":[(id,label)]}]
    n_code = 0

    @staticmethod
    def c(s):
        code = f"<code>{esc(s)}</code>"
        if s.startswith("http") and "<" not in s and ARTIFACT_URL not in s:
            return f'<a href="{esc(s)}" target="_blank" rel="noopener">{code}</a>'
        return code

    @classmethod
    def _out(cls, h):
        (cls.sections[-1]["items"] if cls.sections else cls.header).append(h)

    @classmethod
    def add(cls, *blocks):
        for b in blocks:
            kind = b[0]
            if kind in ("break", "space"):
                continue
            if kind == "h1":
                title = re.sub(r"^\d+\.\s*", "", b[1])
                cls.sections.append({"id": slug(title), "title": title, "items": [], "steps": []})
            elif kind == "title":
                cls._out(f"<h1>{b[1]}</h1>")
            elif kind == "sub":
                cls._out(f'<p class="lead">{b[1]}</p>' if cls.header else f'<span class="eyebrow">{b[1]}</span>')
            elif kind == "small":
                cls._out(f'<p class="small">{b[1]}</p>')
            elif kind == "codefile":
                cls.n_code += 1
                cls._out(f'<div class="filelabel">{esc(b[1])}</div>' + code_html((SOL / b[1]).read_text().rstrip(), f"code-f{cls.n_code}"))
            else:
                cls._out(f"<p>{b[1]}</p>")

    @classmethod
    def table(cls, rows, widths):
        head = "".join(f"<th>{x}</th>" for x in rows[0])
        body = "".join("<tr>" + "".join(f"<td>{x}</td>" for x in r) + "</tr>" for r in rows[1:])
        cls._out(f'<div class="tablewrap"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>')

    @classmethod
    def step(cls, num, title, where, lines, yml=None, expect=None):
        sid = "s-" + num.lower().replace(".", "-")
        meta = []
        if where:
            meta.append(f'<span class="branch">branch {esc(where)}</span>')
        if expect:
            k = "failed" if "fail" in expect else "manual" if "manual" in expect else "passed"
            meta.append(f'<span class="chip chip-{k}"><i></i>{esc(expect)}</span>')
        rows = []
        for tag, text in lines:
            cl = TAGCLASS[tag]
            rows.append(f'<li class="act act-{cl}"><span class="tag tag-{cl}">{tag}</span><div>{text}</div></li>')
        ymlh = ""
        if yml:
            cls.n_code += 1
            ymlh = (f'<details class="yml"><summary>Pipeline to paste as <code>.gitlab-ci.yml</code> '
                    f'<span class="muted">pipelines/{esc(yml)}</span></summary>'
                    + code_html((SOL / "pipelines" / yml).read_text().rstrip(), f"code-{sid}") + "</details>")
        cls.sections[-1]["steps"].append((sid, f"{num} {title}"))
        cls._out(f'''<article class="step" id="{sid}">
<header class="shead"><input type="checkbox" class="tick" id="chk-{sid}" data-key="{sid}" aria-label="Mark step {esc(num)} done">
<span class="snum">{esc(num)}</span><h3>{title}</h3></header>
{('<div class="meta">' + "".join(meta) + "</div>") if meta else ""}
<ol class="acts">{"".join(rows)}</ol>{ymlh}</article>''')


guide_content.build(Web)

nav = "".join(
    f'<li><a href="#{s["id"]}">{esc(s["title"])}</a>'
    + (("<ol>" + "".join(f'<li><a href="#{i}">{esc(l)}</a></li>' for i, l in s["steps"]) + "</ol>") if s["steps"] else "")
    + "</li>" for s in Web.sections)
main = "".join(f'<section class="sec" id="{s["id"]}"><h2>{esc(s["title"])}</h2>{"".join(s["items"])}</section>' for s in Web.sections)
n_steps = sum(len(s["steps"]) for s in Web.sections)

CSS = """
/* Layout: sticky section rail on the left, guide sections on the right; each step is a card of tagged actions. */
:root {
  --bg: #f6f7f9; --surface: #ffffff; --fg: #1b2230; --muted: #5d6676; --line: #dde1e8;
  --accent: #3b5bdb; --accent-soft: #e7ecfd; --code-bg: #f0f2f6; --mark: #fff1b8;
  --ok: #1f8a4c; --ok-soft: #e3f5ea; --bad: #c92a2a; --bad-soft: #fde8e8; --man: #6b4fc9; --man-soft: #eee9fb;
  --t-go: #3b5bdb; --t-click: #6b4fc9; --t-type: #1f7a8c; --t-show: #1f8a4c; --t-say: #5d6676; --t-note: #b35c00; --t-off: #c92a2a;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #12151c; --surface: #1a1f29; --fg: #e4e8f0; --muted: #98a1b2; --line: #2c3340;
  --accent: #8ea4ff; --accent-soft: #232c4a; --code-bg: #141821; --mark: #5a4a12;
  --ok: #5fd08f; --ok-soft: #173826; --bad: #ff8a8a; --bad-soft: #3d1c1c; --man: #b9a6ff; --man-soft: #2b2447;
  --t-go: #6f8bff; --t-click: #9b82f0; --t-type: #3fb0c6; --t-show: #3fbf74; --t-say: #8a93a5; --t-note: #e08a2c; --t-off: #f06464; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #12151c; --surface: #1a1f29; --fg: #e4e8f0; --muted: #98a1b2; --line: #2c3340;
  --accent: #8ea4ff; --accent-soft: #232c4a; --code-bg: #141821; --mark: #5a4a12;
  --ok: #5fd08f; --ok-soft: #173826; --bad: #ff8a8a; --bad-soft: #3d1c1c; --man: #b9a6ff; --man-soft: #2b2447;
  --t-go: #6f8bff; --t-click: #9b82f0; --t-type: #3fb0c6; --t-show: #3fbf74; --t-say: #8a93a5; --t-note: #e08a2c; --t-off: #f06464; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.55 var(--sans); }
a { color: var(--accent); }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; grid-template-columns: 240px minmax(0,1fr); gap: 40px; }
.intro { grid-column: 1 / -1; display: grid; gap: 12px; max-width: 780px; }
.eyebrow { font: 500 12px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
h1 { margin: 0; font-size: clamp(26px, 4vw, 36px); line-height: 1.15; font-weight: 600; text-wrap: balance; }
.lead { margin: 0; color: var(--muted); max-width: 65ch; }
.facts { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 13px; color: var(--muted); }
.facts b { color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; }
.intro .tablewrap { max-width: 520px; }
nav { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 16px); align-self: start; max-height: calc(100vh - 32px); overflow: auto; font-size: 13px; }
nav > ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
nav > ol > li > a { font-weight: 600; color: var(--fg); text-decoration: none; }
nav ol ol { list-style: none; margin: 6px 0 0; padding: 0 0 0 12px; border-left: 2px solid var(--line); display: grid; gap: 4px; }
nav ol ol a { color: var(--muted); text-decoration: none; display: block; }
nav ol ol a.done { text-decoration: line-through; opacity: .6; }
nav a:hover, nav a:focus-visible { color: var(--accent); }
main { display: grid; gap: 48px; min-width: 0; }
.sec { display: grid; gap: 14px; scroll-margin-top: 16px; min-width: 0; }
.sec > h2 { margin: 0; padding-bottom: 6px; border-bottom: 2px solid var(--fg); font-size: 22px; font-weight: 600; }
.sec > p { margin: 0; max-width: 72ch; }
.small { font-size: 13px; color: var(--muted); }
.tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; vertical-align: top; padding: 8px 12px; border-bottom: 1px solid var(--line); }
th { background: var(--code-bg); font-weight: 600; font-size: 13px; }
tr:last-child td { border-bottom: 0; }
.step { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; display: grid; gap: 10px; scroll-margin-top: 16px; min-width: 0; }
.step.is-done { opacity: .55; }
.shead { display: flex; align-items: center; gap: 10px; }
.shead h3 { margin: 0; font-size: 16px; font-weight: 600; }
.snum { font: 500 12px/1 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; min-width: 2.4em; }
.tick { width: 18px; height: 18px; accent-color: var(--accent); margin: 0; cursor: pointer; flex: none; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.branch { font: 500 12px/1 var(--mono); padding: 5px 8px; border-radius: 6px; background: var(--accent-soft); color: var(--accent); }
.chip { display: inline-flex; align-items: center; gap: 6px; font: 500 12px/1 var(--sans); padding: 4px 10px 4px 8px; border-radius: 999px; }
.chip i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.chip-passed { background: var(--ok-soft); color: var(--ok); }
.chip-failed { background: var(--bad-soft); color: var(--bad); }
.chip-manual { background: var(--man-soft); color: var(--man); }
.acts { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.act { display: grid; grid-template-columns: 64px minmax(0,1fr); gap: 10px; align-items: start; }
.tag { font: 600 10.5px/1 var(--mono); letter-spacing: .04em; text-align: center; padding: 4px 0; border-radius: 4px; color: #fff; margin-top: 2px; }
.tag-go { background: var(--t-go); } .tag-click { background: var(--t-click); } .tag-type { background: var(--t-type); }
.tag-show { background: var(--t-show); } .tag-say { background: var(--t-say); } .tag-note { background: var(--t-note); } .tag-off { background: var(--t-off); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .tag { color: #10131a; } }
:root[data-theme="dark"] .tag { color: #10131a; }
.act-say > div { font-style: italic; color: var(--muted); }
.act-off > div, .act-note > div { font-weight: 500; }
code { font: 13px/1.4 var(--mono); background: var(--code-bg); padding: 1px 5px; border-radius: 4px; overflow-wrap: anywhere; }
a code { color: var(--accent); }
.yml { border-top: 1px dashed var(--line); padding-top: 8px; }
.yml summary { cursor: pointer; font-size: 13px; font-weight: 500; color: var(--accent); }
.muted { color: var(--muted); font: 12px var(--mono); margin-left: 6px; }
.filelabel { font: 500 12px var(--mono); color: var(--muted); margin-bottom: -8px; }
.codewrap { position: relative; margin-top: 8px; min-width: 0; }
.codewrap pre { margin: 0; background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; overflow-x: auto; max-height: 520px; }
.codewrap pre code { background: none; padding: 0; white-space: pre; overflow-wrap: normal; }
mark { background: var(--mark); color: inherit; border-radius: 3px; padding: 0 2px; }
.copy { position: absolute; top: 8px; right: 8px; font: 500 12px/1 var(--sans); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); cursor: pointer; }
.copy:hover { border-color: var(--accent); color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 860px) {
  .wrap { grid-template-columns: minmax(0,1fr); gap: 28px; }
  nav { position: static; max-height: none; }
  nav ol ol { display: none; }
  nav > ol { display: flex; flex-wrap: wrap; gap: 8px 18px; }
  .act { grid-template-columns: 56px minmax(0,1fr); }
}
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
"""

JS = """
(function () {
  var KEY = "a2-guide-done"; var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { state = {}; }
  function paint(id) {
    var on = !!state[id];
    var el = document.getElementById(id); if (el) el.classList.toggle("is-done", on);
    var a = document.querySelector('nav a[href="#' + id + '"]'); if (a) a.classList.toggle("done", on);
  }
  document.querySelectorAll(".tick").forEach(function (box) {
    var id = box.dataset.key; box.checked = !!state[id]; paint(id);
    box.addEventListener("change", function () {
      state[id] = box.checked; paint(id);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    });
  });
  document.querySelectorAll(".copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var pre = document.getElementById(btn.dataset.target); var text = pre.textContent;
      function selectIt() { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Selected, press Cmd+C"; }
      var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject();
      p.then(function () { btn.textContent = "Copied"; }, selectIt);
      setTimeout(function () { btn.textContent = "Copy"; }, 2200);
    });
  });
})();
"""

page = f'''<title>GitLab CI/CD Recording Script</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>{CSS}</style>
<div class="wrap">
  <header class="intro">{"".join(Web.header)}
    <div class="facts"><span><b>3</b> graded parts</span><span><b>{n_steps}</b> steps incl. setup</span><span>Video <b>12-15 min</b> after cutting pipeline waits</span><span>Recording session <b>~2 h</b></span><span>Same content as <code>WORKING-GUIDE.pdf</code></span></div>
  </header>
  <nav aria-label="Guide sections"><ol>{nav}</ol></nav>
  <main>{main}</main>
</div>
<script>{JS}</script>
'''
OUT.write_text(page)
print("steps", n_steps, "bytes", len(page), OUT)
