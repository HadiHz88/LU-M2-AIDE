// Report building blocks in IEEE conference format (project.toml: [report] format = "ieee").
// Same interface as docx_kit.js, so report_md.js renders either. Layout follows the IEEE conference template (A4):
//   margins top 19 mm, bottom 43 mm, left/right 14.32 mm; two columns 88.9 mm wide, 4.22 mm apart;
//   Times New Roman 10 pt body; title 24 pt; "I. INTRODUCTION" headings in small caps; "A. Subsection" in italics;
//   bold 9 pt abstract and index terms; "Fig. 1." captions below figures, "TABLE I" captions above tables;
//   8 pt tables and references, numbered [1] in order of citation; no running header, no page numbers.
// The house-style rules that do not apply to an IEEE paper (cover, contents, a new page per section) are left out;
// the content checks (number provenance, citations, informal wording) still run.
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, Footer,
  AlignmentType, WidthType, BorderStyle, VerticalAlign, TableLayoutType, SectionType, TabStopType, PageNumber,
} = require("docx");
const cfg = require("./config");

const mm = (v) => Math.round(v * 56.693);
const PAGE_W = 11906, PAGE_H = 16838;
const MARGIN = { top: mm(19), bottom: mm(43), left: mm(14.32), right: mm(14.32) };
const GAP = mm(4.22);
const COL_W = Math.floor((PAGE_W - MARGIN.left - MARGIN.right - GAP) / 2); // ≈ 88.6 mm
const TEXT_W = COL_W; // tables and figures are one column wide
const COL_PX = Math.floor((COL_W / 1440) * 96); // image width unit used by docx (96 px per inch)
const pt = (v) => Math.round(v * 2);
const FONT = "Times New Roman";
const INK = "000000";

let corpus = [];
const seq = { Table: 0, Figure: 0, Equation: 0 };
function reset() { corpus = []; seq.Table = 0; seq.Figure = 0; seq.Equation = 0; }

const roman = (n) => {
  const t = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let s = "";
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
};

// ---------- inline markup: **bold**, *italic*, _{subscript}, ^{superscript} (for symbols in text and equations) ----------
function runs(text, base = {}, { math = true } = {}) {
  corpus.push(text);
  const out = [];
  const re = math ? /(\*\*[^*]+\*\*|\*[^*]+\*|_\{[^}]+\}|\^\{[^}]+\})/g : /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(new TextRun({ text: tok.slice(2, -2), ...base, bold: true }));
    else if (tok.startsWith("*")) out.push(new TextRun({ text: tok.slice(1, -1), ...base, italics: true }));
    else if (tok.startsWith("_")) out.push(...runs(tok.slice(2, -1), { ...base, subScript: true }, { math }));
    else out.push(...runs(tok.slice(2, -1), { ...base, superScript: true }, { math }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const run = (text, o = {}) => new TextRun({ text, ...o });
const para = (children, o = {}) => new Paragraph({ children, ...o });

const BODY = { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 200 }, spacing: { line: 240, before: 0, after: 0 } };
// { continued: true }: the text goes on after an equation ("where …"), so it is not indented.
const body = (text, { continued = false } = {}) => para(runs(text), { ...BODY, indent: { firstLine: continued ? 0 : 200 } });

// Headings: labels arrive already numbered from report_md ("I. Introduction", "A. Data").
const h1 = (label) => para([run(label, { smallCaps: true })], {
  alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 80, line: 240 },
});
const h2 = (label) => para([run(label, { italics: true })], {
  alignment: AlignmentType.LEFT, keepNext: true, spacing: { before: 100, after: 60, line: 240 },
});

function bullets(items) {
  return items.map((t, i) => para(runs(t), {
    numbering: { reference: "bullets", level: 0 }, alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 240, before: i ? 0 : 40, after: i === items.length - 1 ? 40 : 0 },
  }));
}

// ---------- abstract and index terms (bold 9 pt, run-in bold-italic label) ----------
const runIn = (label, text) => para([run(label, { bold: true, italics: true, size: pt(9) }), run("—", { bold: true, size: pt(9) }),
  ...runs(text, { bold: true, size: pt(9) })], { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 200 }, spacing: { line: 240, after: 60 } });
const abstract = (text, first) => (first ? runIn("Abstract", text) : para(runs(text, { bold: true, size: pt(9) }), {
  alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 200 }, spacing: { line: 240, after: 60 },
}));
const indexTerms = (terms) => runIn("Index Terms", terms.join(", "));

// ---------- captions & notes ----------
// Figure: "Fig. 1. Text." below the figure. Table: "TABLE I" and the title in small caps, centred, above the table.
function caption(label, text) {
  seq[label] += 1;
  corpus.push(text);
  if (label === "Table") {
    return [
      para([run(`TABLE ${roman(seq.Table)}`, { size: pt(8) })], { alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 0, line: 240 } }),
      para(runs(text, { size: pt(8), smallCaps: true }), { alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 80, line: 240 } }),
    ];
  }
  return [para([run(`Fig. ${seq.Figure}. `, { size: pt(8) }), ...runs(text, { size: pt(8) })], {
    alignment: AlignmentType.JUSTIFIED, spacing: { before: 60, after: 160, line: 240 },
  })];
}
const note = (text) => para(runs(text, { size: pt(7.5) }), { alignment: AlignmentType.JUSTIFIED, keepLines: true, spacing: { before: 40, after: 160, line: 228 } });

// ---------- tables: rules above and below the header and below the last row, no vertical lines ----------
const rule = { style: BorderStyle.SINGLE, size: 6, color: INK };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
// A short table is kept in one piece with its caption (and its note, when it has one); a long one (> 12 rows) may
// continue in the next column, with its header row repeated, so that it does not leave a half-empty column behind it.
function dataTable(head, rows, weights, leftCols = 1, hasNote = false) {
  const together = rows.length <= 12;
  const tot = weights.reduce((a, b) => a + b, 0);
  const W = weights.map((w) => Math.round((w / tot) * TEXT_W));
  W[W.length - 1] += TEXT_W - W.reduce((a, b) => a + b, 0);
  const cell = (c, w, i, borders, o = {}) => { // o.last: last row, kept with the next block only if that is the note
    const v = typeof c === "string" ? { text: c } : c;
    return new TableCell({
      width: { size: w, type: WidthType.DXA }, borders,
      margins: { top: 20, bottom: 20, left: 50, right: 50 }, verticalAlign: VerticalAlign.CENTER,
      children: [para(runs(v.text, { size: pt(8), bold: o.head || v.bold }), {
        alignment: i < leftCols ? AlignmentType.LEFT : AlignmentType.CENTER, spacing: { line: 220, after: 0 },
        keepNext: o.head || (o.last ? hasNote : together),
      })],
    });
  };
  const headB = { top: rule, bottom: rule, left: none, right: none };
  const bodyB = (last) => ({ top: none, bottom: last ? rule : none, left: none, right: none });
  return new Table({
    width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED,
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(h, W[i], i, headB, { head: true })) }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        // A {group: "Depth"} row is a label across all columns, in italics, above the rows of that group.
        children: r.group != null
          ? [new TableCell({
            columnSpan: W.length, width: { size: TEXT_W, type: WidthType.DXA }, borders: bodyB(ri === rows.length - 1),
            margins: { top: 40, bottom: 10, left: 50, right: 50 },
            children: [para(runs(r.group, { size: pt(8), italics: true }), { spacing: { line: 220, after: 0 }, keepNext: true })], // a group label stays with its first row
          })]
          : r.map((c, i) => cell(c, W[i], i, bodyB(ri === rows.length - 1), { last: ri === rows.length - 1 })),
      })),
    ],
  });
}

// ---------- figures: one column wide by default ----------
function figure(pngPath, widthPx, heightPx, display) {
  const w = !display || display > COL_PX ? COL_PX : display <= 1 ? Math.round(display * COL_PX) : display;
  return para([new ImageRun({ type: "png", data: fs.readFileSync(pngPath), transformation: { width: w, height: Math.round((w * heightPx) / widthPx) } })], {
    alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 }, keepNext: true,
  });
}

// ---------- equations: centred, number at the right margin of the column ----------
function equation(text) {
  seq.Equation += 1;
  return para([run("\t"), ...runs(text, {}, { math: true }), run(`\t(${seq.Equation})`)], {
    tabStops: [{ type: TabStopType.CENTER, position: Math.round(COL_W / 2) }, { type: TabStopType.RIGHT, position: COL_W }],
    spacing: { before: 80, after: 80, line: 240 },
  });
}

// ---------- references: 8 pt, "[n]" hanging ----------
function referenceList(refs) {
  return refs.map((r) => para([run(`[${r.n}]\t`, { size: pt(8) }), ...r.parts.map(([t, it]) => run(t, { italics: !!it, size: pt(8) }))], {
    alignment: AlignmentType.JUSTIFIED, indent: { left: 360, hanging: 360 }, tabStops: [{ type: TabStopType.LEFT, position: 360 }],
    spacing: { line: 220, after: 40 },
  }));
}

// ---------- title block (one column, above the two-column body) ----------
const COLUMNS = Symbol("columns"); // where the one-column title block ends and the two columns start
function titleBlock({ title, authors }) {
  const out = [para([run(title, { size: pt(24) })], { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200, line: 264 } })];
  for (const a of authors || [{ name: cfg.author.name, affiliation: [cfg.institution.faculty + ", " + cfg.institution.branch, cfg.institution.university] }]) {
    out.push(para([run(a.name, { size: pt(11) })], { alignment: AlignmentType.CENTER, spacing: { after: 20, line: 240 } }));
    (a.affiliation || []).forEach((l, i) => out.push(para([run(l, { size: pt(10), italics: i === 0 })], { alignment: AlignmentType.CENTER, spacing: { after: 0, line: 240 } })));
    if (a.email) out.push(para([run(a.email, { size: pt(10) })], { alignment: AlignmentType.CENTER, spacing: { after: 0, line: 240 } }));
  }
  out.push(para([], { spacing: { after: 240 } }));
  out.push(COLUMNS);
  return out;
}

// ---------- document ----------
function buildDocument({ title, children, pageNumbers = false }) {
  const at = children.indexOf(COLUMNS);
  if (at < 0) throw new Error("ieee_kit: the title block (K.titleBlock) is missing");
  const page = { size: { width: PAGE_W, height: PAGE_H }, margin: MARGIN };
  const footers = pageNumbers ? { default: new Footer({ children: [para([new TextRun({ children: [PageNumber.CURRENT], size: pt(8) })], { alignment: AlignmentType.CENTER })] }) } : undefined;
  return new Document({
    creator: cfg.author.name,
    title,
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 180 } } } }],
      }],
    },
    styles: { default: { document: { run: { font: FONT, size: pt(10), color: INK }, paragraph: { spacing: { line: 240 } } } } },
    sections: [
      { properties: { page }, footers, children: children.slice(0, at) },
      { properties: { page, type: SectionType.CONTINUOUS, column: { count: 2, space: GAP, equalWidth: true } }, footers, children: children.slice(at + 1) },
      // An empty continuous section at the end balances the two columns of the last page, as in IEEE papers.
      { properties: { page, type: SectionType.CONTINUOUS }, footers, children: [para([], { spacing: { before: 0, after: 0, line: 20 } })] },
    ],
  });
}

// ---------- checks ----------
const { assertTexts } = require("./checks");
function runChecks({ factsPath, extra = [] }) {
  assertTexts([...corpus, ...extra], factsPath);
  return { words: corpus.join(" ").split(/\s+/).filter(Boolean).length };
}

module.exports = {
  Packer, AlignmentType, TEXT_W, COL_PX, COLUMNS, reset, roman,
  runs, run, para, body, h1, h2, bullets, abstract, indexTerms, caption, note, dataTable, figure, equation,
  referenceList, titleBlock, buildDocument, runChecks,
};
