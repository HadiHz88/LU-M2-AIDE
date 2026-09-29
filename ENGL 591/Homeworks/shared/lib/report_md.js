// report.md → .docx
//
// Syntax (see templates/project/sources/report.md for a commented example):
//   # Heading {#id}             numbered section (1, 2, …); starts a new page
//   # Abstract {.unnumbered}    unnumbered section
//   ## Subheading {#id}         numbered subsection (2.1, 2.2, …)
//   paragraphs, - bullets, **bold**, *italic*, <!-- comments -->
//   [@key] / @key               citations from references.bib (see bib.js)
//   [[table:id]] [[figure:id]] [[section:id]]   cross-references → "Table 2", "Figure 1", "Section 3.1"
//   ::: contents :::            Contents + List of Figures + List of Tables
//   ::: references :::          reference list (cited entries only, APA order)
//   ::: table <id> … :::        YAML body: caption, data | rows, columns, widths, bold, note
//   ::: figure <id> … :::       YAML body: type (grouped-columns | flow | image), caption, note, width, …
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const cfg = require("./config");
const K = require("./docx_kit");
const { groupedColumns, flow } = require("./charts");

// ---------- parse ----------
function parse(src) {
  src = src.replace(/<!--[\s\S]*?-->/g, "");
  const lines = src.split("\n");
  const blocks = [];
  let para = [], list = null;
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    if (list) blocks.push({ type: "bullets", items: list });
    para = []; list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { flush(); continue; }
    let m;
    if ((m = /^(#{1,2})\s+(.+?)\s*(?:\{([^}]*)\})?\s*$/.exec(t))) {
      flush();
      const attrs = m[3] || "";
      blocks.push({
        type: m[1].length === 1 ? "h1" : "h2", title: m[2],
        id: (/#([\w-]+)/.exec(attrs) || [])[1], numbered: !/\.unnumbered/.test(attrs),
      });
      continue;
    }
    if ((m = /^:::\s*(\w+)\s*([\w-]+)?\s*(:::)?\s*$/.exec(t))) {
      flush();
      let body = "";
      if (!m[3]) {
        const buf = [];
        while (++i < lines.length && !/^:::\s*$/.test(lines[i].trim())) buf.push(lines[i]);
        if (i >= lines.length) throw new Error(`report.md: unclosed ::: ${m[1]} ${m[2] || ""}`);
        body = buf.join("\n");
      }
      blocks.push({ type: "directive", name: m[1], id: m[2], spec: body.trim() ? YAML.parse(body) : {} });
      continue;
    }
    if ((m = /^[-*]\s+(.*)$/.exec(t))) {
      if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; }
      (list ||= []).push(m[1]);
      continue;
    }
    if (list && /^\s{2,}/.test(line)) { list[list.length - 1] += " " + t; continue; } // bullet continuation
    if (list) flush();
    para.push(t);
  }
  flush();
  return blocks;
}

// ---------- numbering & cross-references ----------
function number(blocks) {
  const refs = {};
  let s1 = 0, s2 = 0, nt = 0, nf = 0;
  for (const b of blocks) {
    if (b.type === "h1" && b.numbered) { s1++; s2 = 0; b.label = `${s1}  ${b.title}`; if (b.id) refs[`section:${b.id}`] = `Section ${s1}`; }
    else if (b.type === "h1") b.label = b.title;
    else if (b.type === "h2") { s2++; b.label = `${s1}.${s2}  ${b.title}`; if (b.id) refs[`section:${b.id}`] = `Section ${s1}.${s2}`; }
    else if (b.type === "directive" && b.name === "table") { nt++; if (b.id) refs[`table:${b.id}`] = `Table ${nt}`; }
    else if (b.type === "directive" && b.name === "figure") { nf++; if (b.id) refs[`figure:${b.id}`] = `Figure ${nf}`; }
  }
  return refs;
}

// ---------- render ----------
const fmtCell = (v, col) => {
  if (typeof v === "number") {
    if (col.decimals != null) return v.toFixed(col.decimals);
    return Number.isInteger(v) && Math.abs(v) >= 1000 ? v.toLocaleString("en-US") : String(v);
  }
  return v == null ? "" : String(v);
};

/**
 * @param {object} o
 * @param {string} o.src      report.md contents
 * @param {object} o.data     parsed data.yaml
 * @param {import('./bib').Bibliography} o.bib
 * @param {object} o.meta     project.toml
 * @param {string} o.sources  sources dir (for image paths)
 * @param {string} o.figDir   where rendered figure PNGs go
 */
async function render({ src, data, bib, meta, sources, figDir }) {
  const blocks = parse(src);
  const xrefs = number(blocks);
  const text = (s) =>
    bib.resolve(String(s).replace(/\[\[(\w+:[\w-]+)\]\]/g, (_, k) => {
      if (!xrefs[k]) throw new Error(`report.md: unknown cross-reference [[${k}]]`);
      return xrefs[k];
    }));
  const rows = (spec) => {
    if (spec.rows) return spec.rows;
    const d = data[spec.data];
    if (!d) throw new Error(`report.md: data "${spec.data}" not found in data.yaml`);
    return d;
  };

  fs.mkdirSync(figDir, { recursive: true });
  const REFS = Symbol("refs");
  const children = [...K.cover({ label: meta.report.label, title: meta.report.title, subtitle: meta.report.subtitle })];

  for (const b of blocks) {
    if (b.type === "h1") children.push(K.h1(b.label));
    else if (b.type === "h2") children.push(K.h2(b.label));
    else if (b.type === "p") children.push(K.body(text(b.text)));
    else if (b.type === "bullets") children.push(...K.bullets(b.items.map(text)));
    else if (b.name === "contents") children.push(K.CONTENTS);
    else if (b.name === "references") children.push(REFS);
    else if (b.name === "pagebreak") children.push(K.para([], { pageBreakBefore: true }));
    else if (b.name === "table") {
      const s = b.spec;
      const cols = s.columns.map((c) => (typeof c === "string" ? { key: c, label: c } : c));
      const body = rows(s).map((r) => {
        const cells = Array.isArray(r) ? r : cols.map((c) => r[c.key]);
        const nums = cells.map((v, i) => (typeof v === "number" && cols[i].compare !== false ? v : -Infinity));
        const best = s.bold === "row-max" ? Math.max(...nums) : null;
        return cells.map((v, i) => ({ text: text(fmtCell(v, cols[i])), bold: best != null && nums[i] === best && best > -Infinity }));
      });
      children.push(K.caption("Table", text(s.caption), K.AlignmentType.LEFT));
      children.push(K.dataTable(cols.map((c) => c.label), body, s.widths || cols.map(() => 1), s.left_cols ?? 1));
      if (s.note) children.push(K.note(text(s.note)));
    } else if (b.name === "figure") {
      const s = b.spec;
      const png = path.join(figDir, `${b.id || "figure"}.png`);
      let dim;
      if (s.type === "grouped-columns") {
        const d = rows(s);
        dim = await groupedColumns({
          categories: d.map((r) => r[s.category]),
          series: s.series.map((se) => ({ name: se.label, color: cfg.colors.chart[se.role || "subject"], values: d.map((r) => r[se.key]) })),
          yDomain: [s.y?.min ?? 0, s.y?.max ?? 100], yTicks: s.y?.ticks ?? [0, 25, 50, 75, 100], yLabel: s.y?.label ?? "",
          outPath: png,
        });
      } else if (s.type === "flow") {
        dim = await flow(s.steps.map((st) => ({ title: st.title, lines: st.lines })), png);
      } else if (s.type === "image") {
        fs.copyFileSync(path.join(sources, s.path), png);
        const sharp = require("sharp");
        const m = await sharp(png).metadata();
        dim = { widthPx: m.width, heightPx: m.height };
      } else throw new Error(`report.md: figure ${b.id}: unknown type "${s.type}"`);
      children.push(K.figure(png, dim.widthPx, dim.heightPx, s.width || 500));
      children.push(K.caption("Figure", text(s.caption), K.AlignmentType.CENTER));
      if (s.note) children.push(K.note(text(s.note), K.AlignmentType.CENTER));
    } else throw new Error(`report.md: unknown directive ::: ${b.name}`);
  }
  // The reference list can only be built once every citation has been resolved.
  const at = children.indexOf(REFS);
  if (at >= 0) children.splice(at, 1, ...K.referenceList(bib.list()));
  return children;
}

module.exports = { parse, render };
