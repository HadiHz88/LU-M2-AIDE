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

// Speaker notes. `e` = {title, screen, script, cues: [], key, next}. The PowerPoint notes (presenter view) get the
// cues, the spoken text and the transition; the full entry also feeds the presenter guide (script.md / Script docx).
function notes(pres, slide, e) {
  const spoken = [e.script, e.next].filter(Boolean).join(" ");
  const parts = [];
  if (e.cues?.length) parts.push(e.cues.map((c) => `[DO] ${c}`).join("\n"));
  parts.push(spoken);
  if (e.key) parts.push(`[KEY POINT] ${e.key}`);
  slide.addNotes(parts.join("\n\n"));
  pres._script.push({ ...e, spoken });
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

// Title slide: same white background as the content slides (one consistent design), logos top right
function titleSlide(pres, { kicker, titleLines, subtitle }) {
  const s = pres.addSlide();
  s.background = { color: C.white };
  s.addImage({ data: img("left"), x: W - M - 1.75, y: M, w: 0.75, h: 0.75 });
  s.addImage({ data: img("right"), x: W - M - 0.75, y: M, w: 0.75, h: 0.75 });
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 1.45, w: 0.8, h: 0.07, fill: { color: C.accent }, line: { color: C.accent } });
  text(s, kicker, { x: M, y: 1.65, w: 7, h: 0.3, fontSize: 12, bold: true, color: C.primary, charSpacing: 2 });
  text(s, titleLines.map((t, i) => ({ text: t, options: { breakLine: i < titleLines.length - 1 } })), {
    x: M, y: 2.0, w: 8.2, h: 1.3, fontFace: S.title_font, fontSize: 38, bold: true, color: C.primary_dark, lineSpacingMultiple: 0.95,
  });
  text(s, subtitle, { x: M, y: 3.35, w: 8, h: 0.45, fontSize: 20, italic: true, color: C.primary });
  s.addShape(pres.shapes.LINE, { x: M, y: 4.0, w: W - 2 * M, h: 0, line: { color: C.rule, width: 0.75 } });
  text(s, [
    { text: cfg.author.name, options: { fontSize: 18, bold: true, color: C.primary_dark, breakLine: true } },
    { text: `${cfg.people.instructor_role}: ${cfg.people.instructor}   ·   ${cfg.people.coordinator_role}: ${cfg.people.coordinator}`, options: { fontSize: 12, color: C.muted, breakLine: true } },
    { text: `${cfg.program.full}  ·  ${cfg.institution.full}  ·  ${cfg.date}`, options: { fontSize: 12, color: C.muted } },
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

// Presenter guide: per-slide timing (from the spoken words at WPM) plus what to show, do and say
function scriptRows(pres) {
  let cum = 0;
  return pres._script.map((e, i) => {
    const words = e.spoken.split(/\s+/).filter(Boolean).length;
    const sec = Math.round((words / WPM) * 60);
    cum += sec;
    return { n: i + 1, ...e, words, sec, cum };
  });
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const DELIVERY = [
  "Speak slowly and clearly; do not read the slides (Ch. 4, slide 11).",
  "Face the audience and keep eye contact; glance at the screen only to point.",
  "About 1 minute per slide (Ch. 4, slide 5). Pauses and pointing add about a minute to the speaking time in the table.",
  "Questions: repeat the question to gain thinking time; if unsure, say \u201cThat is a good point; I will look into that\u201d (Ch. 4, slide 12).",
];

function scriptMarkdown(pres, heading, qa) {
  const rows = scriptRows(pres);
  const total = rows.length ? rows[rows.length - 1].cum : 0;
  let md = `# ${heading}\n\nGenerated from slides.yaml (\`notes\`, \`cues\`, \`key\`, \`next\`). Speaking time at ${WPM} words/min: **${mmss(total)}**; plan for about ${mmss(total + 60)} with pauses.\n\n`;
  md += "| # | Slide | Words | Time | Cumulative |\n|---|---|---|---|---|\n";
  for (const r of rows) md += `| ${r.n} | ${r.title} | ${r.words} | ${mmss(r.sec)} | ${mmss(r.cum)} |\n`;
  md += "\n**Delivery (Ch. 4):**\n" + DELIVERY.map((d) => `- ${d}`).join("\n") + "\n";
  for (const r of rows) {
    md += `\n## ${r.n}. ${r.title}  _(~${mmss(r.sec)}, at ${mmss(r.cum)})_\n\n`;
    if (r.screen) md += `**On screen:** ${r.screen}\n\n`;
    if (r.cues?.length) md += "**Do:**\n" + r.cues.map((c) => `- ${c}`).join("\n") + "\n\n";
    md += `**Say:**\n\n> ${r.script}\n`;
    if (r.next) md += `>\n> *Transition:* ${r.next}\n`;
    if (r.key) md += `\n**Key point:** ${r.key}\n`;
  }
  if (qa) md += `\n---\n\n${qa.trim()}\n`;
  return md;
}

module.exports = { W, H, M, C, S, createDeck, text, notes, content, titleSlide, source, card, badge, scriptRows, scriptMarkdown, mmss, DELIVERY, WPM };
