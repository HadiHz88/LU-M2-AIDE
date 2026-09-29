// Reusable report building blocks in the approved house style (see PLAN.md "Style decisions").
// Also runs build-time checks: number provenance, citation completeness, informal-language lint.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType, PageNumber, SimpleField,
  VerticalAlign, TableLayoutType, TableOfContents,
} = require("docx");
const cfg = require("./config");

const C = cfg.colors;
const R = cfg.report;
const cm = (v) => Math.round(v * 566.93);
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = cm(R.margin_cm), TEXT_W = PAGE_W - 2 * MARGIN;
const pt = (v) => v * 2;
const LINE = Math.round(240 * R.line_spacing);

// Build state, reset before each pass of a multi-pass build.
// corpus: every body string (for the checks) · outline: headings for the TOC · captions: for the lists.
let corpus = [];
let outline = [];
let captions = { Figure: [], Table: [] };
const seq = { Table: 0, Figure: 0 };
function reset() {
  corpus = []; outline = []; captions = { Figure: [], Table: [] }; seq.Table = 0; seq.Figure = 0;
}

// ---------- inline markup: *italic*, **bold** ----------
function runs(text, base = {}) {
  corpus.push(text);
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(new TextRun({ text: tok.slice(2, -2), ...base, bold: true }));
    else out.push(new TextRun({ text: tok.slice(1, -1), ...base, italics: true }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const run = (text, o = {}) => new TextRun({ text, ...o });
const para = (children, o = {}) => new Paragraph({ children, ...o });

const body = (text) => para(runs(text), { alignment: AlignmentType.JUSTIFIED, spacing: { line: LINE, after: 120 } });
// RULES.md §4: every top-level section starts on a new page (project.toml: report.section_page_break).
const h1 = (text, o = {}) => (
  outline.push({ title: text, level: 1 }),
  para([run(text)], { heading: HeadingLevel.HEADING_1, pageBreakBefore: R.section_page_break, ...o })
);
const h2 = (text) => (outline.push({ title: text, level: 2 }), para([run(text)], { heading: HeadingLevel.HEADING_2 }));

function bullets(items) {
  return items.map((t) =>
    para(runs(t), { numbering: { reference: "bullets", level: 0 }, alignment: AlignmentType.LEFT, spacing: { line: LINE, after: 60 } })
  );
}

// ---------- captions & notes ----------
function caption(label, text, align) {
  seq[label] += 1;
  corpus.push(text);
  captions[label].push(`${label} ${seq[label]}. ${text}`);
  return new Paragraph({
    style: "Caption",
    alignment: align,
    keepNext: label === "Table",
    children: [run(`${label} `), new SimpleField(`SEQ ${label} \\* ARABIC`, String(seq[label])), run(". "), run(text, { bold: false })],
  });
}
const note = (text, alignment = AlignmentType.LEFT) =>
  para([run("Note. ", { italics: true, size: pt(10), color: C.muted }), ...runs(text, { size: pt(10), color: C.muted })], {
    alignment, spacing: { before: 60, after: 240, line: 240 },
  });

// ---------- tables ----------
const border = { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" };
const cellBorders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

/**
 * @param {string[]} head
 * @param {(string|{text:string,bold?:boolean})[][]} rows
 * @param {number[]} weights  relative column widths
 * @param {number} [leftCols=1] how many leading columns are left-aligned
 */
function dataTable(head, rows, weights, leftCols = 1) {
  const tot = weights.reduce((a, b) => a + b, 0);
  const W = weights.map((w) => Math.round((w / tot) * TEXT_W));
  W[W.length - 1] += TEXT_W - W.reduce((a, b) => a + b, 0);
  const cell = (c, w, i, o = {}) => {
    const v = typeof c === "string" ? { text: c } : c;
    return new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: cellBorders,
      shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        para(runs(v.text, { bold: o.head || v.bold, color: o.head ? C.white : C.text, size: pt(10) }), {
          alignment: i < leftCols ? AlignmentType.LEFT : AlignmentType.CENTER,
          spacing: { line: 240, after: 0 },
          keepNext: true, // keeps the whole table on one page together with its Note line
        }),
      ],
    });
  };
  return new Table({
    width: { size: TEXT_W, type: WidthType.DXA },
    columnWidths: W,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(h, W[i], i, { head: true, fill: C.primary })) }),
      ...rows.map((r, ri) =>
        new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, W[i], i, { fill: ri % 2 ? C.light : undefined })) })
      ),
    ],
  });
}

// ---------- figures ----------
function figure(pngPath, widthPx, heightPx, displayWidthPx = 500) {
  const h = Math.round((displayWidthPx * heightPx) / widthPx);
  return para([new ImageRun({ type: "png", data: fs.readFileSync(pngPath), transformation: { width: displayWidthPx, height: h } })], {
    alignment: AlignmentType.CENTER, spacing: { before: 120 }, keepNext: true,
  });
}

// ---------- references ----------
function referenceList(refs) {
  return refs.map((r) =>
    para(r.parts.map(([t, it]) => run(t, { italics: !!it })), {
      // References are single-spaced with space between entries (body text keeps 1.5 spacing)
      alignment: AlignmentType.LEFT, indent: { left: 720, hanging: 720 }, spacing: { line: 240, after: 160 },
    })
  );
}

// ---------- cover ----------
function logo(key, px) {
  const file = cfg.logo(key);
  const type = path.extname(file).slice(1).toLowerCase().replace("jpeg", "jpg");
  return new ImageRun({ type, data: fs.readFileSync(file), transformation: { width: px, height: px } });
}
const centered = (text, o = {}, spacing = { after: 0 }) => para([run(text, o)], { alignment: AlignmentType.CENTER, spacing });

function cover({ label, title, subtitle }) {
  const cols = [1900, TEXT_W - 3800, 1900];
  const cell = (children, w, align) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA }, borders: noBorders, verticalAlign: VerticalAlign.CENTER,
      children: children.map((c) => (c instanceof Paragraph ? c : para([c], { alignment: align }))),
    });
  const logoRow = new Table({
    width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED,
    borders: { ...noBorders, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [
      new TableRow({
        children: [
          cell([logo("left", 84)], cols[0], AlignmentType.LEFT),
          cell([
            centered(cfg.institution.university, { bold: true, size: pt(14), color: C.text }),
            centered(`${cfg.institution.faculty} – ${cfg.institution.branch}`, { size: pt(12), color: C.text }),
          ], cols[1]),
          cell([logo("right", 84)], cols[2], AlignmentType.RIGHT),
        ],
      }),
    ],
  });
  const rule = new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.primary, space: 1 } }, spacing: { after: 480 } });
  const lv = (l, v) =>
    para([run(`${l}: `, { color: C.muted, size: pt(12) }), run(v, { bold: true, size: pt(12), color: C.text })], {
      alignment: AlignmentType.CENTER, spacing: { after: 80 },
    });
  return [
    logoRow, rule,
    centered(cfg.program.full, { size: pt(13), color: C.text }, { after: 60 }),
    centered(`${cfg.course.code} – ${cfg.course.title}`, { size: pt(12), color: C.muted }, { after: 1500 }),
    centered(label, { bold: true, size: pt(11), color: C.primary, characterSpacing: 40 }, { after: 200 }),
    centered(title, { bold: true, size: pt(24), color: C.primary }, { after: 120 }),
    centered(subtitle, { italics: true, size: pt(15), color: C.text }, { after: 1700 }),
    lv("Prepared by", cfg.author.name),
    lv(cfg.people.instructor_role, cfg.people.instructor),
    lv(cfg.people.coordinator_role, cfg.people.coordinator),
    para([], { spacing: { after: 900 } }),
    centered(`Academic Year ${cfg.document.academic_year}  ·  ${cfg.date}`, { size: pt(11), color: C.muted }),
  ];
}

// ---------- front matter: Contents, List of Figures, List of Tables (RULES.md §4) ----------
// Put K.CONTENTS in `children` where the block belongs (after the abstract). buildDocument swaps it for real
// TOC fields whose cached entries carry page numbers from the previous layout pass (see paginate.js).
const CONTENTS = Symbol("contents");
const FRONT_TITLES = ["Contents", "List of Figures", "List of Tables"];
const PLACEHOLDER_PAGE = 88; // same width as a real 1–2 digit page number, so pass 1 lays out like pass 2

function frontTitle(text, first) {
  return para([run(text, { font: R.heading_font, size: pt(16), bold: true, color: C.primary })], {
    pageBreakBefore: first, spacing: { before: first ? 0 : 360, after: 160, line: 240 }, keepNext: true,
  });
}

function contentsBlock(pages) {
  const pg = (t) => pages[t] ?? PLACEHOLDER_PAGE;
  const out = [
    frontTitle("Contents", true),
    new TableOfContents("Contents", {
      hyperlink: true, headingStyleRange: "1-2",
      cachedEntries: outline.map((e) => ({ title: e.title, level: e.level, page: pg(e.title) })),
    }),
  ];
  for (const [label, heading] of [["Figure", "List of Figures"], ["Table", "List of Tables"]]) {
    if (!captions[label].length) continue; // a list only exists if the report has that kind of item
    out.push(
      frontTitle(heading, false),
      new TableOfContents(heading, {
        hyperlink: true, captionLabelIncludingNumbers: label,
        cachedEntries: captions[label].map((t) => ({ title: t, level: 1, page: pg(t) })),
      })
    );
  }
  return out; // the next Heading 1 starts a new page (section_page_break)
}

// Texts whose pages must be looked up for the contents block
const pageNeedles = () => [...outline.map((e) => e.title), ...captions.Figure, ...captions.Table];

// ---------- document ----------
function buildDocument({ title, runningTitle, children, pages = {} }) {
  const at = children.indexOf(CONTENTS);
  if (at < 0) throw new Error("RULES.md §4: every report must include K.CONTENTS (Contents + lists of figures/tables)");
  children = [...children.slice(0, at), ...contentsBlock(pages), ...children.slice(at + 1)];
  return new Document({
    creator: cfg.author.name,
    title,
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }],
      }],
    },
    styles: {
      default: { document: { run: { font: R.font, size: pt(R.font_size_pt), color: C.text }, paragraph: { spacing: { line: LINE } } } },
      paragraphStyles: [
        { id: "Caption", name: "caption", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: pt(11), bold: true, color: C.text }, paragraph: { spacing: { before: 120, after: 120, line: 240 } } },
        { id: "TOC1", name: "toc 1", basedOn: "Normal", next: "Normal",
          run: { size: pt(12) }, paragraph: { spacing: { before: 60, after: 60, line: 276 } } },
        { id: "TOC2", name: "toc 2", basedOn: "Normal", next: "Normal",
          run: { size: pt(12) }, paragraph: { indent: { left: 440 }, spacing: { before: 0, after: 40, line: 276 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: R.heading_font, size: pt(16), bold: true, color: C.primary },
          paragraph: { spacing: { before: R.section_page_break ? 0 : 360, after: 160, line: 240 }, keepNext: true, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { font: R.heading_font, size: pt(13), bold: true, color: C.primary },
          paragraph: { spacing: { before: 200, after: 120, line: 240 }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        titlePage: true,
        page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
      },
      headers: {
        first: new Header({ children: [para([])] }),
        default: new Header({ children: [para([run(runningTitle, { size: pt(9), color: C.muted, italics: true })], { alignment: AlignmentType.RIGHT })] }),
      },
      footers: {
        first: new Footer({ children: [para([])] }),
        default: new Footer({ children: [para([new TextRun({ children: [PageNumber.CURRENT], size: pt(10), color: C.muted })], { alignment: AlignmentType.CENTER })] }),
      },
      children,
    }],
  });
}

// ---------- checks ----------
const { assertTexts } = require("./checks");
/** Throws on any failed check (see checks.js). Returns the body word count. */
function runChecks({ factsPath, extra = [] }) {
  assertTexts([...corpus, ...extra], factsPath);
  return { words: corpus.join(" ").split(/\s+/).filter(Boolean).length };
}

module.exports = {
  Packer, AlignmentType, TEXT_W, CONTENTS, FRONT_TITLES, reset, pageNeedles,
  runs, run, para, body, h1, h2, bullets, caption, note, dataTable, figure, referenceList, cover, buildDocument, runChecks,
};
