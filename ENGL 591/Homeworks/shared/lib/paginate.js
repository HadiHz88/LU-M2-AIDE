// Finds the page on which each heading/caption lands, by laying the .docx out with LibreOffice
// and reading the PDF text with poppler's pdftotext. Used to pre-fill TOC page numbers (two-pass build).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SOFFICE = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
const norm = (s) => s.replace(/\s+/g, " ").trim();
// Keep the blank pages that odd-page section breaks insert (style.toml open_right); LibreOffice drops them by default,
// which would shift every later page number by one per blank page.
const PDF_KEEP_BLANKS = 'pdf:writer_pdf_Export:{"IsSkipEmptyPages":{"type":"boolean","value":"false"}}';

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
  execFileSync(SOFFICE, ["--headless", "--convert-to", PDF_KEEP_BLANKS, "--outdir", dir, docx], { stdio: "ignore" });
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
  // pdftotext ends every page with a form feed, so the last split element is empty; blank pages still count
  return { pages, pageCount: pageLines.length - (pageLines[pageLines.length - 1].length ? 0 : 1) };
}

/** Lay a .docx out with LibreOffice into `outDir`; returns the PDF path and its page count. */
function toPdf(docxPath, outDir) {
  execFileSync(SOFFICE, ["--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath], { stdio: "ignore" });
  const pdf = path.join(outDir, path.basename(docxPath).replace(/\.docx$/, ".pdf"));
  const pages = execFileSync("pdftotext", [pdf, "-"]).toString("utf8").split("\f").filter((p) => p.trim()).length;
  return { pdf, pages };
}

module.exports = { pageMap, toPdf };
