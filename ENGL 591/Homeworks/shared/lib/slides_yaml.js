// slides.yaml → .pptx. One YAML document (separated by ---) per slide; `layout` picks the design.
// Every text field accepts **bold**, citations ([@key], @key, @key[§3]) and plain numbers (checked against facts.md).
//
//   title          kicker, title (string or list of lines), subtitle
//   rows-callout   title, rows: [{head, sub}], callout: {label, items: []}, source
//   steps          title, steps: [{head, big | arabic: {text, segmented, gloss}, sub}], footnote, source
//   table-callout  title, table: {data, columns: [{key, label, align}], highlight: {column, match}}, callout, footnote, source
//   chart-stats    title, chart: {data, category, series: [{key, label, role}], y}, stats: [{big, sub}], source
//   two-columns    title, columns: [{head, marker: number | alert, items: []}], source
//   closing        kicker, title, points: [], callout: {label, text}          (dark slide)
//   questions      title, references: [bib keys], note
// Every slide: notes (speaker notes; also exported to out/script.md with timings).
const K = require("./pptx_kit");
const cfg = require("./config");
const { apa } = require("./bib");
const { assertTexts } = require("./checks");

const { W, H, M, C, S, text, notes, card, badge } = K;

async function renderDeck({ docs, data, bib, meta, factsPath }) {
  const pres = K.createDeck(meta.slides.title);
  const seen = []; // every string placed on a slide, for the checks
  const tx = (s) => { const r = bib.resolve(String(s ?? "")); seen.push(r); return r; };
  // **bold** → pptx runs
  const rich = (s, base = {}) => {
    const out = [];
    tx(s).split(/(\*\*[^*]+\*\*)/).filter(Boolean).forEach((part) => {
      const b = part.startsWith("**");
      out.push({ text: b ? part.slice(2, -2) : part, options: { ...base, ...(b ? { bold: true } : {}) } });
    });
    return out;
  };
  const rows = (spec) => {
    const d = data[spec.data];
    if (!d) throw new Error(`slides.yaml: data "${spec.data}" not found in data.yaml`);
    return d;
  };
  const source = (s, v) => v && text(s, `Source: ${tx(v)}`, { x: M, y: H - 0.72, w: W - 2 * M, h: 0.25, fontSize: 10, italic: true, color: C.muted });
  const bulletList = (items, o = {}) =>
    items.map((it, i) => ({ text: tx(it), options: { breakLine: i < items.length - 1, bullet: o.code ? { code: o.code } : true } }));

  const layouts = {
    title(d) {
      const s = K.titleSlide(pres, {
        kicker: tx(d.kicker ?? `${cfg.course.code}  ·  PRESENTATION`),
        titleLines: (Array.isArray(d.title) ? d.title : [d.title]).map(tx),
        subtitle: tx(d.subtitle ?? ""),
      });
      return s;
    },

    "rows-callout"(d) {
      const s = K.content(pres, tx(d.title));
      const top = 1.3, gap = 0.15, rowH = Math.min(1.05, (3.35 - gap * (d.rows.length - 1)) / d.rows.length);
      d.rows.forEach((r, i) => {
        const y = top + i * (rowH + gap);
        card(pres, s, { x: M, y, w: 5.2, h: rowH });
        badge(pres, s, i + 1, M + 0.25, y + (rowH - 0.42) / 2);
        text(s, tx(r.head), { x: M + 0.9, y: y + 0.17, w: 4.1, h: 0.35, fontSize: 17, bold: true, color: C.primary_dark });
        text(s, rich(r.sub), { x: M + 0.9, y: y + 0.52, w: 4.1, h: 0.45, fontSize: 13 });
      });
      if (d.callout) {
        const ox = 6.0, ow = W - M - ox, oh = d.rows.length * rowH + (d.rows.length - 1) * gap;
        card(pres, s, { x: ox, y: top, w: ow, h: oh, fill: C.primary_dark });
        text(s, tx(d.callout.label), { x: ox + 0.3, y: top + 0.3, w: ow - 0.6, h: 0.3, fontSize: 11, bold: true, color: C.accent, charSpacing: 1.5 });
        text(s, bulletList(d.callout.items, { code: "25B8" }), { x: ox + 0.3, y: top + 0.85, w: ow - 0.6, h: oh - 1.0, fontSize: 17, color: C.white, paraSpaceAfter: 20 });
      }
      source(s, d.source);
      return s;
    },

    steps(d) {
      const s = K.content(pres, tx(d.title));
      const top = 1.35, cardH = 2.75, gapX = 0.3, n = d.steps.length;
      const cardW = (W - 2 * M - gapX * (n - 1)) / n;
      d.steps.forEach((st, i) => {
        const x = M + i * (cardW + gapX);
        card(pres, s, { x, y: top, w: cardW, h: cardH });
        badge(pres, s, i + 1, x + 0.2, top + 0.2);
        text(s, tx(st.head), { x: x + 0.72, y: top + 0.2, w: cardW - 0.9, h: 0.42, valign: "middle", fontSize: 16, bold: true, color: C.primary_dark });
        if (st.arabic) {
          const a = st.arabic;
          text(s, [
            { text: a.text, options: { fontSize: 24, bold: true, color: C.primary, breakLine: true, rtlMode: true, lang: "ar-SA" } },
            { text: a.segmented, options: { fontSize: 20, color: C.primary, rtlMode: true, lang: "ar-SA" } },
          ], { x: x + 0.2, y: top + 0.8, w: cardW - 0.4, h: 1.0, align: "center", valign: "middle", fontFace: S.arabic_font });
          if (a.gloss) text(s, tx(a.gloss), { x: x + 0.1, y: top + 1.72, w: cardW - 0.2, h: 0.28, align: "center", fontSize: 10, italic: true, color: C.muted });
        } else {
          text(s, tx(st.big), { x: x + 0.2, y: top + 0.85, w: cardW - 0.4, h: 0.85, align: "center", valign: "middle", fontFace: S.title_font, fontSize: 34, bold: true, color: C.primary });
        }
        text(s, rich(st.sub), { x: x + 0.15, y: top + 2.05, w: cardW - 0.3, h: 0.62, align: "center", fontSize: 12 });
        if (i < n - 1) text(s, "›", { x: x + cardW, y: top + cardH / 2 - 0.25, w: gapX, h: 0.5, align: "center", valign: "middle", fontSize: 28, bold: true, color: C.accent });
      });
      if (d.footnote) text(s, rich(d.footnote, { color: C.text }).map((r) => (r.options.bold ? { ...r, options: { ...r.options, color: C.primary_dark } } : r)),
        { x: M, y: top + cardH + 0.2, w: W - 2 * M, h: 0.35, fontSize: 15 });
      source(s, d.source);
      return s;
    },

    "table-callout"(d) {
      const s = K.content(pres, tx(d.title));
      const t = d.table, cols = t.columns;
      const head = cols.map((c) => ({ text: tx(c.label), options: { bold: true, color: C.white, fill: { color: C.primary }, fontSize: 13, fontFace: S.font, valign: "middle" } }));
      const hl = t.highlight ? new RegExp(t.highlight.match) : null;
      const body = rows(t).map((r, i) => cols.map((c, j) => {
        const v = r[c.key];
        const str = typeof v === "number" ? (Number.isInteger(v) && v >= 1000 ? v.toLocaleString("en-US") : String(v)) : tx(v);
        const o = { fontSize: 13, fontFace: S.font, color: C.text, valign: "middle", fill: { color: i % 2 ? C.light : C.white }, align: c.align };
        if (j === 0) o.bold = true;
        if (hl && c.key === t.highlight.column && hl.test(str)) Object.assign(o, { bold: true, color: C.primary_dark });
        return { text: str, options: o };
      }));
      const tw = d.callout ? 6.0 : W - 2 * M;
      const colW = t.widths ? t.widths.map((w) => (w / t.widths.reduce((a, b) => a + b, 0)) * tw) : cols.map(() => tw / cols.length);
      s.addTable([head, ...body], { x: M, y: 1.3, w: tw, colW, rowH: 0.42, border: { type: "solid", pt: 0.5, color: "D1D5DB" }, margin: [0.04, 0.1, 0.04, 0.1] });
      if (d.callout) {
        const ex = 6.7, ew = W - M - ex;
        card(pres, s, { x: ex, y: 1.3, w: ew, h: 2.52 });
        text(s, tx(d.callout.label), { x: ex + 0.25, y: 1.5, w: ew - 0.5, h: 0.3, fontSize: 11, bold: true, color: C.primary, charSpacing: 1.5 });
        text(s, bulletList(d.callout.items), { x: ex + 0.25, y: 1.9, w: ew - 0.5, h: 1.8, fontSize: 14, paraSpaceAfter: 10 });
      }
      if (d.footnote) text(s, rich(d.footnote), { x: M, y: 4.0, w: W - 2 * M, h: 0.35, fontSize: 14, italic: true, color: C.primary_dark });
      source(s, d.source);
      return s;
    },

    "chart-stats"(d) {
      const s = K.content(pres, tx(d.title));
      const ch = d.chart, rs = rows(ch);
      const labels = rs.map((r) => String(r[ch.category]));
      s.addChart(pres.charts.BAR, ch.series.map((se) => ({ name: tx(se.label), labels, values: rs.map((r) => r[se.key]) })), {
        x: M - 0.1, y: 1.1, w: d.stats ? 5.9 : W - 2 * M, h: 3.65,
        barDir: "col", barGrouping: "clustered", barGapWidthPct: 70,
        chartColors: ch.series.map((se) => C.chart[se.role || "subject"]),
        showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelColor: C.text, dataLabelFormatCode: ch.format || "0.0",
        showLegend: ch.series.length > 1, legendPos: "t", legendFontSize: 12, legendColor: C.text, legendFontFace: S.font,
        valAxisMinVal: ch.y?.min ?? 0, valAxisMaxVal: ch.y?.max ?? 100, valAxisMajorUnit: ch.y?.step ?? 25,
        valAxisLabelColor: C.chart.axis_text, valAxisLabelFontSize: 10,
        showValAxisTitle: !!ch.y?.label, valAxisTitle: ch.y?.label ?? "", valAxisTitleColor: C.chart.axis_text, valAxisTitleFontSize: 10,
        catAxisLabelColor: C.text, catAxisLabelFontSize: 11, catAxisLabelFontFace: S.font,
        valGridLine: { color: C.chart.grid, size: 0.5 }, catGridLine: { style: "none" }, catAxisLineShow: true, valAxisLineShow: false,
      });
      const sx = 6.55, sw = W - M - sx, sh = 1.6;
      (d.stats || []).forEach((st, i) => {
        const y = 1.3 + i * (sh + 0.25);
        card(pres, s, { x: sx, y, w: sw, h: sh });
        text(s, tx(st.big), { x: sx + 0.25, y: y + 0.15, w: sw - 0.5, h: 0.75, valign: "middle", fontFace: S.title_font, fontSize: 36, bold: true, color: C.primary });
        text(s, rich(st.sub), { x: sx + 0.25, y: y + 0.9, w: sw - 0.5, h: 0.6, fontSize: 13 });
      });
      source(s, d.source);
      return s;
    },

    "two-columns"(d) {
      const s = K.content(pres, tx(d.title));
      const top = 1.3, n = d.columns.length, cw = (W - 2 * M - 0.3 * (n - 1)) / n, chH = 3.1;
      d.columns.forEach((c, i) => {
        const x = M + i * (cw + 0.3);
        card(pres, s, { x, y: top, w: cw, h: chH });
        text(s, tx(c.head), { x: x + 0.3, y: top + 0.25, w: cw - 0.6, h: 0.4, fontSize: 18, bold: true, color: C.primary_dark });
        c.items.forEach((it, j) => {
          const y = top + 0.85 + j * 0.53;
          badge(pres, s, c.marker === "alert" ? "!" : j + 1, x + 0.3, y, 0.34);
          text(s, rich(it), { x: x + 0.8, y, w: cw - 1.05, h: 0.34, valign: "middle", fontSize: 14 });
        });
      });
      source(s, d.source);
      return s;
    },

    closing(d) {
      const s = K.dark(pres);
      text(s, tx(d.kicker ?? "CONCLUSION"), { x: M, y: 0.55, w: 5, h: 0.3, fontSize: 12, bold: true, color: C.accent, charSpacing: 2 });
      text(s, tx(d.title), { x: M, y: 0.9, w: 8.5, h: 1.2, fontFace: S.title_font, fontSize: 32, bold: true, color: C.white });
      (d.points || []).forEach((p, i) => {
        const y = 2.3 + i * 0.52;
        badge(pres, s, i + 1, M, y, 0.36);
        text(s, rich(p), { x: M + 0.55, y, w: 5.2, h: 0.36, valign: "middle", fontSize: 16, color: C.white });
      });
      if (d.callout) {
        const nx = 6.2, nw = W - M - nx;
        card(pres, s, { x: nx, y: 2.25, w: nw, h: 1.6, fill: C.white });
        text(s, tx(d.callout.label), { x: nx + 0.25, y: 2.42, w: nw - 0.5, h: 0.3, fontSize: 11, bold: true, color: C.primary, charSpacing: 1.5 });
        text(s, rich(d.callout.text), { x: nx + 0.25, y: 2.8, w: nw - 0.5, h: 0.95, fontSize: 14, color: C.text });
      }
      text(s, cfg.footer, { x: M, y: H - 0.38, w: 6, h: 0.25, fontSize: 9, color: "CADCFC" });
      text(s, String(pres.slides.length), { x: W - M - 0.5, y: H - 0.38, w: 0.5, h: 0.25, fontSize: 9, color: "CADCFC", align: "right" });
      return s;
    },

    questions(d) {
      const s = K.content(pres, tx(d.title ?? "Thank you. Questions?"));
      if (d.references?.length) {
        text(s, "KEY REFERENCES", { x: M, y: 1.3, w: 5, h: 0.3, fontSize: 11, bold: true, color: C.primary, charSpacing: 1.5 });
        const refs = d.references.map((k, i) => {
          const parts = apa(bib.get(k)).map(([t, it]) => ({ text: t, options: { italic: !!it } }));
          if (i < d.references.length - 1) parts[parts.length - 1].options.breakLine = true;
          return parts;
        }).flat();
        text(s, refs, { x: M, y: 1.7, w: W - 2 * M, h: 2.2, fontSize: 11, paraSpaceAfter: 8 });
      }
      if (d.note) {
        card(pres, s, { x: M, y: 3.95, w: W - 2 * M, h: 0.6 });
        text(s, rich(d.note), { x: M + 0.25, y: 3.95, w: W - 2 * M - 0.5, h: 0.6, valign: "middle", fontSize: 13, color: C.primary_dark });
      }
      return s;
    },
  };

  docs.forEach((d, i) => {
    const fn = layouts[d.layout];
    if (!fn) throw new Error(`slides.yaml slide ${i + 1}: unknown layout "${d.layout}" (known: ${Object.keys(layouts).join(", ")})`);
    const s = fn(d);
    if (d.notes) notes(pres, s, d.label || (Array.isArray(d.title) ? d.title.join(" ") : tx(d.title ?? d.layout)), tx(d.notes.trim()));
  });

  assertTexts(seen, factsPath);
  return pres;
}

module.exports = { renderDeck };
