// Reusable slide building blocks in the approved house style (see PLAN.md "Style decisions").
// Canvas: LAYOUT_16x9 = 10" x 5.625", 0.5" margins.
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const cfg = require("./config");

const C = cfg.colors;
const S = cfg.slides;
const W = 10, H = 5.625, M = 0.5;
const WPM = 130; // speaking rate used for timing estimates

function createDeck(title) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = cfg.author.name;
  pres.title = title;
  pres._script = []; // collected speaker notes for the rehearsal script
  return pres;
}

const img = (key) => {
  const file = cfg.logo(key);
  const mime = /\.png$/i.test(file) ? "image/png" : "image/jpeg";
  return `${mime};base64,` + fs.readFileSync(file).toString("base64");
};

// Text box with house defaults (isTextBox for accessibility, margin 0 for alignment)
function text(slide, content, o) {
  slide.addText(content, { margin: 0, isTextBox: true, fontFace: S.font, color: C.text, valign: "top", ...o });
}

function notes(pres, slide, title, script) {
  slide.addNotes(script);
  pres._script.push({ title, script });
}

// Content slide: white background, one-line assertion title, footer + number
function content(pres, title) {
  if (title.length > 50) throw new Error(`Slide title too long (${title.length} chars): "${title}"`);
  const s = pres.addSlide();
  const n = pres.slides.length;
  s.background = { color: C.white };
  text(s, title, { x: M, y: 0.35, w: W - 2 * M, h: 0.6, fontFace: S.title_font, fontSize: S.title_size_pt, bold: true, color: C.primary_dark });
  text(s, cfg.footer, { x: M, y: H - 0.38, w: 6, h: 0.25, fontSize: 9, color: C.muted });
  text(s, String(n), { x: W - M - 0.5, y: H - 0.38, w: 0.5, h: 0.25, fontSize: 9, color: C.muted, align: "right" });
  return s;
}

// Dark slide (title / conclusion "sandwich")
function dark(pres) {
  const s = pres.addSlide();
  s.background = { color: C.primary_dark };
  return s;
}

function logoTile(pres, s) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: W - M - 2.0, y: M, w: 2.0, h: 0.95, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.white } });
  s.addImage({ data: img("left"), x: W - M - 1.85, y: M + 0.15, w: 0.65, h: 0.65 });
  s.addImage({ data: img("right"), x: W - M - 0.8, y: M + 0.15, w: 0.65, h: 0.65 });
}

function titleSlide(pres, { kicker, titleLines, subtitle }) {
  const s = dark(pres);
  logoTile(pres, s);
  text(s, kicker, { x: M, y: 1.55, w: 7, h: 0.3, fontSize: 12, bold: true, color: C.accent, charSpacing: 2 });
  text(s, titleLines.map((t, i) => ({ text: t, options: { breakLine: i < titleLines.length - 1 } })), {
    x: M, y: 1.9, w: 8.2, h: 1.3, fontFace: S.title_font, fontSize: 38, bold: true, color: C.white, lineSpacingMultiple: 0.95,
  });
  text(s, subtitle, { x: M, y: 3.3, w: 8, h: 0.45, fontSize: 20, italic: true, color: "CADCFC" });
  text(s, [
    { text: cfg.author.name, options: { fontSize: 18, bold: true, color: C.white, breakLine: true } },
    { text: `${cfg.people.instructor_role}: ${cfg.people.instructor}   ·   ${cfg.people.coordinator_role}: ${cfg.people.coordinator}`, options: { fontSize: 12, color: "CADCFC", breakLine: true } },
    { text: `${cfg.program.full}  ·  ${cfg.institution.full}  ·  ${cfg.date}`, options: { fontSize: 12, color: "CADCFC" } },
  ], { x: M, y: 4.15, w: W - 2 * M, h: 1.0, paraSpaceAfter: 4 });
  return s;
}

function source(slide, t) {
  text(slide, `Source: ${t}`, { x: M, y: H - 0.72, w: W - 2 * M, h: 0.25, fontSize: 10, italic: true, color: C.muted });
}

function card(pres, slide, { x, y, w, h, fill = C.light }) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: fill } });
}

// Motif: gold numbered badge
function badge(pres, slide, label, x, y, d = 0.42) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: C.accent }, line: { color: C.accent } });
  text(slide, String(label), { x, y, w: d, h: d, align: "center", valign: "middle", fontSize: d > 0.38 ? 15 : 12, bold: true, color: C.primary_dark });
}

// Rehearsal script (markdown) with timing estimates, from the collected notes
function scriptMarkdown(pres, heading) {
  let total = 0;
  const rows = pres._script.map((e, i) => {
    const words = e.script.split(/\s+/).filter(Boolean).length;
    const sec = Math.round((words / WPM) * 60);
    total += sec;
    return { n: i + 1, ...e, words, sec };
  });
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  let md = `# ${heading}\n\nGenerated from the deck's speaker notes. Estimated at ${WPM} words/min: **${mmss(total)} total**.\n\n`;
  md += "| # | Slide | Words | Time | Cumulative |\n|---|---|---|---|---|\n";
  let cum = 0;
  for (const r of rows) { cum += r.sec; md += `| ${r.n} | ${r.title} | ${r.words} | ${mmss(r.sec)} | ${mmss(cum)} |\n`; }
  md += "\nDelivery reminders (Ch. 4): speak slowly, face the audience, do not read the slides, and point at the chart when citing numbers.\n";
  for (const r of rows) md += `\n## ${r.n}. ${r.title}  _(~${mmss(r.sec)})_\n\n${r.script}\n`;
  return md;
}

module.exports = { W, H, M, C, S, createDeck, text, notes, content, dark, titleSlide, source, card, badge, scriptMarkdown };
