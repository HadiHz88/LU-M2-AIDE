// Finds the page on which each heading/caption lands, by laying the .docx out with LibreOffice
// and reading the PDF text with poppler's pdftotext. Used to pre-fill TOC page numbers (two-pass build).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
const norm = (s) => s.replace(/\s+/g, " ").trim();

/**
 * @param {Buffer} docxBuffer
 * @param {string[]} needles      heading / caption texts to locate (matched at the start of a line)
 * @param {string[]} skipMarkers  lines that identify front-matter pages to ignore (e.g. "Contents")
 * @returns {{pages: Record<string, number>, pageCount: number}}
 */
function pageMap(docxBuffer, needles, skipMarkers) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paginate-"));
  const docx = path.join(dir, "doc.docx");
  fs.writeFileSync(docx, docxBuffer);
  execFileSync(SOFFICE, ["--headless", "--convert-to", "pdf", "--outdir", dir, docx], { stdio: "ignore" });
  const text = execFileSync("pdftotext", [path.join(dir, "doc.pdf"), "-"]).toString("utf8");
  fs.rmSync(dir, { recursive: true, force: true });

  const pageLines = text.split("\f").map((p) => p.split("\n").map(norm).filter(Boolean));
  const skip = new Set(
    pageLines.flatMap((lines, i) => (lines.some((l) => skipMarkers.includes(l)) ? [i] : []))
  );
  const pages = {};
  for (const n of needles) {
    const key = norm(n).slice(0, 45); // long captions wrap; match on their first ~45 chars
    const i = pageLines.findIndex((lines, idx) => !skip.has(idx) && lines.some((l) => l.startsWith(key)));
    if (i < 0) throw new Error(`paginate: could not find "${key}" in the laid-out document`);
    pages[n] = i + 1; // physical page = displayed page (cover counts as page 1, number hidden)
  }
  return { pages, pageCount: pageLines.filter((l) => l.length).length };
}

module.exports = { pageMap };
