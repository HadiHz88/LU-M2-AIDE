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
//   ::: equation <id> … :::     YAML body: text (IEEE format only; *italic*, _{sub}, ^{sup}); [[equation:id]] → (1)
//
// project.toml [report] format = "ieee" renders an IEEE conference paper instead (see ieee_kit.js): a title block with
// [[report]] authors, Abstract and Index Terms (report.keywords), sections "I. Introduction", subsections "A. …",
// cross-references "Section III-B", "Table II", "Fig. 3" ("Figure 3" at the start of a sentence), no contents block.
// Table rows may be {group: "Label"} (IEEE): a label row across the table.
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const cfg = require("./config");
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
function number(blocks, ieee = false) {
  const refs = {};
  const roman = require("./ieee_kit").roman;
  const letter = (n) => String.fromCharCode(64 + n);
  let s1 = 0, s2 = 0, nt = 0, nf = 0, ne = 0;
  for (const b of blocks) {
    if (b.type === "h1" && b.numbered) {
      s1++; s2 = 0;
      b.label = ieee ? `${roman(s1)}. ${b.title}` : `${s1}  ${b.title}`;
      if (b.id) refs[`section:${b.id}`] = `Section ${ieee ? roman(s1) : s1}`;
    } else if (b.type === "h1") b.label = b.title;
    else if (b.type === "h2") {
      s2++;
      b.label = ieee ? `${letter(s2)}. ${b.title}` : `${s1}.${s2}  ${b.title}`;
      if (b.id) refs[`section:${b.id}`] = ieee ? `Section ${roman(s1)}-${letter(s2)}` : `Section ${s1}.${s2}`;
    } else if (b.type === "directive" && b.name === "table") { nt++; if (b.id) refs[`table:${b.id}`] = ieee ? `Table ${roman(nt)}` : `Table ${nt}`; }
    else if (b.type === "directive" && b.name === "figure") { nf++; if (b.id) refs[`figure:${b.id}`] = ieee ? `Fig. ${nf}` : `Figure ${nf}`; }
    else if (b.type === "directive" && b.name === "equation") { ne++; if (b.id) refs[`equation:${b.id}`] = `(${ne})`; }
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
  const ieee = meta.report?.format === "ieee";
  const K = ieee ? require("./ieee_kit") : require("./docx_kit");
  const blocks = parse(src);
  const xrefs = number(blocks, ieee);
  const text = (s) =>
    bib.resolve(String(s).replace(/\[\[(\w+:[\w-]+)\]\]/g, (_, k, at, all) => {
      if (!xrefs[k]) throw new Error(`report.md: unknown cross-reference [[${k}]]`);
      // IEEE: "Fig. 3" inside a sentence, "Figure 3" when it opens one.
      if (ieee && k.startsWith("figure:") && /(^|[.!?](\*\*)?\s+)$/.test(all.slice(0, at))) return xrefs[k].replace("Fig.", "Figure");
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
  const children = ieee
    ? [...K.titleBlock({ title: meta.report.title, authors: meta.report.authors })]
    : [...K.cover({ label: meta.report.label, title: meta.report.title, subtitle: meta.report.subtitle })];

  let inAbstract = false, abstractParas = 0; // IEEE: "# Abstract {.unnumbered}" becomes the run-in bold abstract
  let prev = null;
  for (const b of blocks) {
    const afterEquation = prev?.name === "equation";
    prev = b;
    if (b.type === "h1" && ieee && /^abstract$/i.test(b.title)) { inAbstract = true; continue; }
    if (b.type === "h1" && inAbstract) {
      inAbstract = false;
      if (meta.report.keywords?.length) children.push(K.indexTerms(meta.report.keywords.map(text)));
    }
    if (b.type === "p" && inAbstract) { children.push(K.abstract(text(b.text), abstractParas++ === 0)); continue; }
    if (b.type === "h1") children.push(K.h1(b.label));
    else if (b.type === "h2") children.push(K.h2(b.label));
    else if (b.type === "p") children.push(ieee ? K.body(text(b.text), { continued: afterEquation && /^[a-z]/.test(b.text) }) : K.body(text(b.text)));
    else if (b.type === "bullets") children.push(...K.bullets(b.items.map(text)));
    else if (b.name === "contents") { if (!ieee) children.push(K.CONTENTS); } // an IEEE paper has no contents page
    else if (b.name === "equation") {
      if (!ieee) throw new Error("report.md: ::: equation is only available in the IEEE format");
      children.push(K.equation(text(b.spec.text)));
    }
    else if (b.name === "references") children.push(REFS);
    else if (b.name === "pagebreak") children.push(K.para([], { pageBreakBefore: true }));
    else if (b.name === "table") {
      const s = b.spec;
      const cols = s.columns.map((c) => (typeof c === "string" ? { key: c, label: c } : c));
      const body = rows(s).map((r) => {
        if (r && r.group != null) return { group: text(r.group) };
        const cells = Array.isArray(r) ? r : cols.map((c) => r[c.key]);
        const nums = cells.map((v, i) => (typeof v === "number" && cols[i].compare !== false ? v : -Infinity));
        const best = s.bold === "row-max" ? Math.max(...nums) : null;
        return cells.map((v, i) => ({ text: text(fmtCell(v, cols[i])), bold: best != null && nums[i] === best && best > -Infinity }));
      });
      children.push(...[].concat(K.caption("Table", text(s.caption), K.AlignmentType.LEFT)));
      children.push(K.dataTable(cols.map((c) => c.label), body, s.widths || cols.map(() => 1), s.left_cols ?? 1, !!s.note));
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
      children.push(K.figure(png, dim.widthPx, dim.heightPx, s.width || (ieee ? undefined : 500)));
      children.push(...[].concat(K.caption("Figure", text(s.caption), K.AlignmentType.CENTER)));
      if (s.note) children.push(K.note(text(s.note), K.AlignmentType.CENTER));
    } else throw new Error(`report.md: unknown directive ::: ${b.name}`);
  }
  // The reference list can only be built once every citation has been resolved.
  const at = children.indexOf(REFS);
  if (at >= 0) children.splice(at, 1, ...K.referenceList(bib.list()));
  return children;
}

module.exports = { parse, render };
