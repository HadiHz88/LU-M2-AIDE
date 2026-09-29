#!/usr/bin/env node
// Build a project's deliverables from its sources/ folder.
//
//   node shared/bin/build.js <project> [report|slides|all]      (run from Homeworks/)
//
// Reads  <project>/sources/{project.toml, report.md, slides.yaml, data.yaml, references.bib, facts.md}
// Writes <project>/out/{<Name>_<Course>_<label>_Report_v<N>.docx, …_Slides_v<N>.pptx, script.md, figures/}
// Fails (non-zero exit, no output written) if any check fails: unsourced numbers, unknown citations,
// unknown cross-references, informal wording, over-long slide titles, unstable contents page numbers.
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const cfg = require("../lib/config");
const { Bibliography } = require("../lib/bib");

const [, , name, what = "all"] = process.argv;
if (!name) {
  console.error("usage: node shared/bin/build.js <project> [report|slides|all]");
  process.exit(2);
}

function loadSources(project) {
  const s = project.sources;
  const read = (f) => fs.readFileSync(path.join(s, f), "utf8");
  const exists = (f) => fs.existsSync(path.join(s, f));
  const factsPath = path.join(s, project.meta.facts || "facts.md");
  if (!fs.existsSync(factsPath)) throw new Error(`missing ${factsPath}: every project needs a facts file`);
  const data = exists("data.yaml") ? YAML.parse(read("data.yaml")) || {} : {};
  // Manual citations bypass the bibliography, so they are refused in favour of [@key].
  for (const f of ["report.md", "slides.yaml"].filter(exists)) {
    const m = read(f).replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*#.*$/gm, "").match(/[A-Z][\w-]+ et al\.,? \(?\d{4}/);
    if (m) throw new Error(`${f}: write citations as [@key] or @key, not "${m[0]}…"`);
  }
  // Decimal numbers in data.yaml are checked against facts.md like prose numbers.
  const dataNumbers = [];
  (function walk(v) {
    if (typeof v === "number" && !Number.isInteger(v)) dataNumbers.push(v.toFixed(1).replace(/\.0$/, ".0"));
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  })(data);
  return { data, factsPath, dataNumbers, read, exists };
}

async function buildReport(project, src) {
  const K = require("../lib/docx_kit");
  const { render } = require("../lib/report_md");
  const { pageMap } = require("../lib/paginate");
  const meta = project.meta;

  const make = async (pages) => {
    K.reset();
    const bib = new Bibliography(path.join(project.sources, "references.bib"));
    const children = await render({
      src: src.read("report.md"), data: src.data, bib, meta, sources: project.sources,
      figDir: path.join(project.out, "figures"),
    });
    const { words } = K.runChecks({ factsPath: src.factsPath, extra: src.dataNumbers.map(String) });
    const doc = K.buildDocument({ title: `${meta.report.title}: ${meta.report.subtitle}`, runningTitle: meta.report.running_title, children, pages });
    return { buf: await K.Packer.toBuffer(doc), words, uncited: bib.uncited() };
  };

  // Two-pass build: lay out once to learn each heading/caption page, then rebuild with real numbers.
  let pages = {}, res;
  for (let pass = 1; ; pass++) {
    res = await make(pages);
    const found = pageMap(res.buf, K.pageNeedles(), K.FRONT_TITLES).pages;
    const stable = Object.keys(found).every((k) => found[k] === pages[k]);
    pages = found;
    if (stable) break;
    if (pass === 3) throw new Error("contents: page numbers did not stabilise after 3 passes");
  }
  const out = path.join(project.out, cfg.filename(meta.file_label, "Report", meta.version, "docx"));
  fs.writeFileSync(out, res.buf);
  const last = Math.max(...Object.values(pages));
  console.log(`report  ✓ ${path.relative(cfg.HOMEWORKS, out)}  (~${res.words} words, ${last}+ pages, contents verified)`);
  if (res.uncited.length) console.log(`        note: references.bib entries not cited (left out of the list): ${res.uncited.join(", ")}`);
}

async function buildSlides(project, src) {
  const { renderDeck } = require("../lib/slides_yaml");
  const K = require("../lib/pptx_kit");
  const bib = new Bibliography(path.join(project.sources, "references.bib"));
  const pres = await renderDeck({ docs: YAML.parseAllDocuments(src.read("slides.yaml")).map((d) => d.toJS()), data: src.data, bib, meta: project.meta, factsPath: src.factsPath });
  const out = path.join(project.out, cfg.filename(project.meta.file_label, "Slides", project.meta.version, "pptx"));
  await pres.writeFile({ fileName: out });
  fs.writeFileSync(path.join(project.out, "script.md"), K.scriptMarkdown(pres, `${project.meta.slides.title}: Speaker Script`));
  console.log(`slides  ✓ ${path.relative(cfg.HOMEWORKS, out)}  (${pres.slides.length} slides, script.md written)`);
}

(async () => {
  const project = cfg.loadProject(name);
  fs.mkdirSync(project.out, { recursive: true });
  const src = loadSources(project);
  const want = (k) => (what === "all" ? (project.meta.deliverables || ["report", "slides"]).includes(k) : what === k);
  if (want("report")) await buildReport(project, src);
  if (want("slides")) await buildSlides(project, src);
})().catch((e) => {
  console.error("✗ " + e.message);
  process.exit(1);
});
