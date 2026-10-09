// Presenter guide → .docx (printable): timing table, delivery reminders, then per slide what is on screen, what to
// do, what to say, the transition and the key point. Optionally appends the Q&A preparation (sources/qa.md).
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, Footer, PageNumber, LevelFormat,
} = require("docx");
const cfg = require("./config");
const { scriptRows, mmss, DELIVERY, WPM } = require("./pptx_kit");

const C = cfg.colors;
const FONT = cfg.report.font;
const pt = (n) => Math.round(n * 2);
const cm = (n) => Math.round(n * 567);
const TEXT_W = 11906 - 2 * cm(2);

// **bold** / *italic* → runs
function runs(text, base = {}) {
  const out = [];
  String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).filter(Boolean).forEach((t) => {
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), ...base, bold: true }));
    else if (t.startsWith("*") && t.endsWith("*") && t.length > 2) out.push(new TextRun({ text: t.slice(1, -1), ...base, italics: true }));
    else out.push(new TextRun({ text: t, ...base }));
  });
  return out;
}
const p = (children, o = {}) => new Paragraph({ children, spacing: { after: 100, line: 276 }, ...o });
const label = (t) => new TextRun({ text: `${t}  `, bold: true, color: C.primary, size: pt(10.5), allCaps: true });
const bullet = (t, o = {}, po = {}) => p(runs(t, o), { numbering: { reference: "dash", level: 0 }, spacing: { after: 40, line: 264 }, ...po });

function timingTable(rows) {
  const cell = (t, o = {}) => new TableCell({
    children: [p([new TextRun({ text: String(t), size: pt(10.5), bold: !!o.head, color: o.head ? C.white : C.text })], { spacing: { after: 0 }, alignment: o.align })],
    shading: o.head ? { type: ShadingType.CLEAR, fill: C.primary, color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
  });
  const widths = [0.08, 0.5, 0.14, 0.14, 0.14].map((f) => Math.round(f * TEXT_W));
  const R = (cells) => new TableRow({ children: cells });
  return new Table({
    width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      R(["#", "Slide", "Words", "Time", "Ends at"].map((t) => cell(t, { head: true }))),
      ...rows.map((r) => R([cell(r.n), cell(r.title), cell(r.words, { align: AlignmentType.RIGHT }), cell(mmss(r.sec)), cell(mmss(r.cum))])),
    ],
  });
}

function slideBlock(r) {
  // Every paragraph except the last keeps with the next one, so a slide's block never splits across pages
  const K = { keepNext: true };
  const quote = { left: { style: BorderStyle.SINGLE, size: 18, color: C.primary, space: 10 } };
  const out = [
    p([new TextRun({ text: `${r.n}. ${r.title}`, bold: true, size: pt(15), color: C.primary_dark }),
       new TextRun({ text: `    ~${mmss(r.sec)}  ·  ends at ${mmss(r.cum)}`, size: pt(10.5), color: C.muted })],
      { ...K, spacing: { before: 320, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.rule, space: 4 } } }),
  ];
  if (r.screen) out.push(p([label("On screen"), ...runs(r.screen, { italics: true, color: C.muted })], K));
  if (r.cues?.length) {
    out.push(p([label("Do")], { ...K, spacing: { after: 40 } }));
    r.cues.forEach((c) => out.push(bullet(c, {}, K)));
  }
  out.push(p([label("Say")], { ...K, spacing: { before: 80, after: 40 } }));
  const last = !r.next && !r.key;
  out.push(p(runs(r.script, { size: pt(13) }), { ...(last ? {} : K), border: quote, indent: { left: 200 }, spacing: { after: r.next ? 60 : 120, line: 312 } }));
  if (r.next) out.push(p([new TextRun({ text: "Transition: ", italics: true, bold: true, size: pt(13), color: C.primary }), ...runs(r.next, { size: pt(13), italics: true })],
    { ...(r.key ? K : {}), border: quote, indent: { left: 200 }, spacing: { after: 120, line: 312 } }));
  if (r.key) out.push(p([label("Key point"), ...runs(r.key, { bold: true })], {
    shading: { type: ShadingType.CLEAR, fill: C.light, color: "auto" }, spacing: { before: 60, after: 120 },
  }));
  return out;
}

// qa.md (light Markdown: # title, **bold**, *italic*, numbered and dashed lists, --- rules) → paragraphs
function qaBlock(md) {
  const out = [];
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd().replace(/`([^`]+)`/g, "$1");
    if (!line.trim() || /^-{3,}$/.test(line.trim())) continue;
    let m;
    if ((m = line.match(/^#\s+(.*)/))) out.push(p([new TextRun({ text: m[1], bold: true, size: pt(16), color: C.primary })], { pageBreakBefore: true, spacing: { after: 160 } }));
    else if (/^\*\*\d+\./.test(line)) out.push(p(runs(line, { color: C.primary_dark }), { spacing: { before: 200, after: 60 }, keepNext: true }));
    else if ((m = line.match(/^\s*(?:-|\d+\.)\s+(.*)/))) out.push(bullet(m[1]));
    else out.push(p(runs(line)));
  }
  return out;
}

async function scriptDocx(pres, { title, qa }) {
  const rows = scriptRows(pres);
  const total = rows.length ? rows[rows.length - 1].cum : 0;
  const children = [
    p([new TextRun({ text: title, bold: true, size: pt(18), color: C.primary })], { spacing: { after: 60 } }),
    p([new TextRun({ text: `${cfg.author.name}  ·  ${cfg.course.code}  ·  ${cfg.date}`, size: pt(11), color: C.muted })], { spacing: { after: 200 } }),
    p([new TextRun({ text: `Speaking time at ${WPM} words/min: `, size: pt(11) }), new TextRun({ text: mmss(total), bold: true, size: pt(11) }),
       new TextRun({ text: `; plan for about ${mmss(total + 60)} with pauses and pointing. The same cues and text are in the PowerPoint speaker notes (Presenter View).`, size: pt(11) })]),
    timingTable(rows),
    p([label("Delivery (Ch. 4)")], { spacing: { before: 240, after: 40 } }),
    ...DELIVERY.map((d) => bullet(d)),
    ...rows.flatMap(slideBlock),
    ...(qa ? qaBlock(qa) : []),
  ];
  const doc = new Document({
    creator: cfg.author.name, title,
    styles: { default: { document: { run: { font: FONT, size: pt(12), color: C.text } } } },
    numbering: { config: [{ reference: "dash", levels: [{ level: 0, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: cm(2), bottom: cm(2), left: cm(2), right: cm(2) } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: pt(10), color: C.muted })] })] }) },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { scriptDocx };
