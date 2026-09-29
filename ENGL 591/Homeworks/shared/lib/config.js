// Loads the three configuration layers every build needs:
//   shared/style.toml            house style (same for everyone)
//   profile.toml                 the student's own details (git-ignored; copy from profile.example.toml)
//   <project>/sources/project.toml   one project's title, deliverables and options (via loadProject)
const fs = require("fs");
const path = require("path");
const { parse } = require("smol-toml");

const HOMEWORKS = path.resolve(__dirname, "..", "..");
const readToml = (p) => parse(fs.readFileSync(p, "utf8"));

const profilePath = path.join(HOMEWORKS, "profile.toml");
if (!fs.existsSync(profilePath)) {
  throw new Error(
    "Missing profile.toml. Create it once with:\n  cp profile.example.toml profile.toml\nthen edit your name and course details."
  );
}
const style = readToml(path.join(HOMEWORKS, "shared", "style.toml"));
const profile = readToml(profilePath);

// pptxgenjs wants hex without '#'; docx accepts either, so strip everywhere.
const stripColors = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "string" ? v.replace(/^#/, "") : stripColors(v)]));

const date =
  profile.document.date === "auto"
    ? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : profile.document.date;

const cfg = {
  ...style,
  ...profile,
  HOMEWORKS,
  date,
  colors: stripColors(style.colors),
  logo: (side) => path.join(HOMEWORKS, profile.logos[side]),
  footer: style.slides.footer
    .replace("{author}", profile.author.name)
    .replace("{course}", profile.course.code)
    .replace("{institution_short}", profile.institution.short),
  // Deliverable filename per RULES.md §7, e.g. HadiHijazi_ENGL591_MiniReport_Report_v1.docx
  filename: (project, kind, version, ext) =>
    `${profile.author.name.replace(/\s+/g, "")}_${profile.course.code.replace(/\s+/g, "")}_${project}_${kind}_v${version}.${ext}`,
};

/** Resolve a project folder (e.g. "mini") and read its sources/project.toml. */
cfg.loadProject = (name) => {
  const dir = path.join(HOMEWORKS, name);
  const sources = path.join(dir, "sources");
  const metaPath = path.join(sources, "project.toml");
  if (!fs.existsSync(metaPath)) throw new Error(`No project at ${dir} (missing sources/project.toml)`);
  return { name, dir, sources, out: path.join(dir, "out"), meta: readToml(metaPath) };
};

module.exports = cfg;
