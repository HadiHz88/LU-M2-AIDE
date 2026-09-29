// Static chart renderer for reports: SVG -> PNG via sharp.
// Slides use native pptxgenjs charts instead; this is for .docx figures, which must be images.
// Mark specs follow the dataviz skill: bars <= 24px (x scale), 4px rounded data-end, square baseline,
// 2px surface gap between adjacent bars, hairline solid grid, text in text tokens (never series color).
const sharp = require("sharp");
const cfg = require("./config");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Grouped column chart.
 * @param {object} o
 * @param {string[]} o.categories         x-axis groups
 * @param {{name:string,color:string,values:number[]}[]} o.series   color = hex without '#'
 * @param {[number, number]} o.yDomain    e.g. [0, 100]
 * @param {number[]} o.yTicks
 * @param {string} o.yLabel
 * @param {string} o.outPath              .png
 * @param {number} [o.scale=2]            2 = print-quality
 */
async function groupedColumns(o) {
  const s = o.scale ?? 2;
  const W = 800, H = 350;
  const m = { top: 48, right: 16, bottom: 36, left: 56 };
  const pw = W - m.left - m.right, ph = H - m.top - m.bottom;
  const [y0, y1] = o.yDomain;
  const y = (v) => m.top + ph - ((v - y0) / (y1 - y0)) * ph;
  const band = pw / o.categories.length;
  const barW = 24, gap = 2, r = 4;
  const groupW = o.series.length * barW + (o.series.length - 1) * gap;
  const text = cfg.colors.text, muted = cfg.colors.chart.axis_text, grid = cfg.colors.chart.grid;
  const font = "Arial, Helvetica, sans-serif";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * s}" height="${H * s}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;

  // Legend (top-left, always present for >= 2 series)
  let lx = m.left;
  for (const se of o.series) {
    svg += `<rect x="${lx}" y="14" width="12" height="12" rx="2" fill="#${se.color}"/>`;
    svg += `<text x="${lx + 18}" y="24.5" font-family="${font}" font-size="13" fill="#${text}">${esc(se.name)}</text>`;
    lx += 18 + se.name.length * 7.4 + 24;
  }

  // Grid + y ticks
  for (const t of o.yTicks) {
    svg += `<line x1="${m.left}" x2="${W - m.right}" y1="${y(t)}" y2="${y(t)}" stroke="#${grid}" stroke-width="1"/>`;
    svg += `<text x="${m.left - 8}" y="${y(t) + 4}" text-anchor="end" font-family="${font}" font-size="12" fill="#${muted}">${t}</text>`;
  }
  svg += `<text transform="translate(16 ${m.top + ph / 2}) rotate(-90)" text-anchor="middle" font-family="${font}" font-size="12" fill="#${muted}">${esc(o.yLabel)}</text>`;

  // Bars: path with rounded top corners, square at the baseline
  o.categories.forEach((cat, i) => {
    const gx = m.left + i * band + (band - groupW) / 2;
    o.series.forEach((se, j) => {
      const v = se.values[i];
      const x = gx + j * (barW + gap);
      const top = y(v), base = y(y0);
      svg += `<path d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z" fill="#${se.color}"/>`;
      // Value on the cap, in text ink
      svg += `<text x="${x + barW / 2}" y="${top - 6}" text-anchor="middle" font-family="${font}" font-size="11" fill="#${text}">${v.toFixed(1)}</text>`;
    });
    svg += `<text x="${m.left + i * band + band / 2}" y="${H - m.bottom + 22}" text-anchor="middle" font-family="${font}" font-size="13" fill="#${text}">${esc(cat)}</text>`;
  });
  // Baseline
  svg += `<line x1="${m.left}" x2="${W - m.right}" y1="${y(y0)}" y2="${y(y0)}" stroke="#${muted}" stroke-width="1"/>`;
  svg += `</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(o.outPath);
  return { widthPx: W * s, heightPx: H * s };
}

/**
 * Horizontal process diagram: numbered rounded boxes joined by arrows (report figures).
 * @param {{title:string, lines:string[]}[]} steps   lines = up to 3 short detail lines
 * @param {string} outPath
 */
async function flow(steps, outPath, scale = 2) {
  const W = 800, boxH = 160, top = 12, H = boxH + 2 * top;
  const gap = 26, n = steps.length;
  const boxW = (W - 2 * 8 - gap * (n - 1)) / n;
  const font = "Arial, Helvetica, sans-serif";
  const C = cfg.colors;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
  steps.forEach((st, i) => {
    const x = 8 + i * (boxW + gap);
    svg += `<rect x="${x}" y="${top}" width="${boxW}" height="${boxH}" rx="10" fill="#${C.light}"/>`;
    svg += `<circle cx="${x + 22}" cy="${top + 24}" r="13" fill="#${C.accent}"/>`;
    svg += `<text x="${x + 22}" y="${top + 29}" text-anchor="middle" font-family="${font}" font-size="14" font-weight="bold" fill="#${C.primary_dark}">${i + 1}</text>`;
    svg += `<text x="${x + boxW / 2}" y="${top + 70}" text-anchor="middle" font-family="${font}" font-size="17" font-weight="bold" fill="#${C.primary}">${esc(st.title)}</text>`;
    st.lines.forEach((l, j) => {
      svg += `<text x="${x + boxW / 2}" y="${top + 98 + j * 19}" text-anchor="middle" font-family="${font}" font-size="14" fill="#${C.text}">${esc(l)}</text>`;
    });
    if (i < n - 1) {
      const ax = x + boxW + 5, ay = top + boxH / 2;
      svg += `<path d="M${ax},${ay} H${ax + gap - 12}" stroke="#${C.accent}" stroke-width="2.5"/>`;
      svg += `<path d="M${ax + gap - 14},${ay - 6} L${ax + gap - 6},${ay} L${ax + gap - 14},${ay + 6} Z" fill="#${C.accent}"/>`;
    }
  });
  svg += `</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  return { widthPx: W * scale, heightPx: H * scale };
}

module.exports = { groupedColumns, flow };
