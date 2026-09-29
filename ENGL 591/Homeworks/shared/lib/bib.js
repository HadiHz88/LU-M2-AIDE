// Minimal BibTeX reader + APA 7 formatter + citation resolver.
//
// In any source text:
//   [@key]              → (Antoun et al., 2020)
//   [@key, Table 1]     → (Antoun et al., 2020, Table 1)
//   [@a; @b]            → (Antoun et al., 2020; Devlin et al., 2019)
//   @key                → Antoun et al. (2020)          (narrative)
//   @key[Table 1]       → Antoun et al. (2020, Table 1)
// Two authors: "Aly & Atiya" in parentheses, "Aly and Atiya" in narrative (APA 7).
// Titles are converted to sentence case; protect proper nouns with braces in the .bib: {A}rabic, {BERT}.
const fs = require("fs");

// ---------- parsing ----------
function parseBib(text) {
  const entries = {};
  let i = 0;
  while ((i = text.indexOf("@", i)) >= 0) {
    const m = /^@(\w+)\s*\{\s*([^,\s]+)\s*,/.exec(text.slice(i));
    if (!m) { i++; continue; }
    const type = m[1].toLowerCase(), key = m[2];
    let j = i + m[0].length, depth = 1;
    const start = j;
    while (j < text.length && depth > 0) { if (text[j] === "{") depth++; else if (text[j] === "}") depth--; j++; }
    entries[key] = { type, key, ...parseFields(text.slice(start, j - 1)) };
    i = j;
  }
  return entries;
}

function parseFields(body) {
  const f = {};
  const re = /(\w+)\s*=\s*/g;
  let m;
  while ((m = re.exec(body))) {
    const name = m[1].toLowerCase();
    let k = re.lastIndex, val;
    if (body[k] === "{") {
      let depth = 0, s = k;
      for (; k < body.length; k++) { if (body[k] === "{") depth++; else if (body[k] === "}") { depth--; if (!depth) break; } }
      val = body.slice(s + 1, k); k++;
    } else if (body[k] === '"') {
      const e = body.indexOf('"', k + 1); val = body.slice(k + 1, e); k = e + 1;
    } else {
      const e = body.slice(k).search(/[,\n}]/); val = body.slice(k, k + (e < 0 ? body.length : e)).trim(); k += e < 0 ? 0 : e;
    }
    f[name] = val.replace(/\s+/g, " ").trim();
    re.lastIndex = k;
  }
  return f;
}

// ---------- text helpers ----------
const clean = (s) => (s || "").replace(/\\&/g, "&").replace(/--/g, "–").replace(/[{}]/g, "");

// Sentence case outside {protected} groups; capitalize the first letter and the first letter after ": ".
function sentenceCase(title) {
  let out = "", depth = 0, capNext = true;
  for (const ch of title) {
    if (ch === "{") { depth++; continue; }
    if (ch === "}") { depth--; continue; }
    if (depth > 0) { out += ch; if (/\S/.test(ch)) capNext = false; continue; }
    if (/[A-Za-z]/.test(ch)) { out += capNext ? ch.toUpperCase() : ch.toLowerCase(); capNext = false; }
    else if (/[0-9]/.test(ch)) { out += ch; capNext = false; } // "1.5 billion words", not "1.5 Billion"
    else { out += ch; if (ch === ":" || ch === "?") capNext = true; }
  }
  return clean(out.replace(/--/g, "–").replace(/ - /g, " – "));
}

function people(field) {
  return clean(field).split(/\s+and\s+/).map((p) => {
    let last, first;
    if (p.includes(",")) [last, first] = p.split(",").map((x) => x.trim());
    else { const parts = p.trim().split(/\s+/); last = parts.pop(); first = parts.join(" "); }
    const initials = (first || "")
      .split(/\s+/).filter(Boolean)
      .map((w) => w.split("-").map((h) => (h.endsWith(".") ? h : h[0] + ".")).join("-"))
      .join(" ");
    return { last, initials };
  });
}

function authorList(entry) {
  const a = people(entry.author || entry.editor || "Anonymous");
  const names = a.map((p) => (p.initials ? `${p.last}, ${p.initials}` : p.last));
  if (names.length === 1) return names[0];
  if (names.length <= 20) return names.slice(0, -1).join(", ") + ", & " + names[names.length - 1];
  return names.slice(0, 19).join(", ") + ", … " + names[names.length - 1];
}

function citeName(entry, narrative) {
  const a = people(entry.author || entry.editor || "Anonymous");
  if (a.length === 1) return a[0].last;
  if (a.length === 2) return `${a[0].last} ${narrative ? "and" : "&"} ${a[1].last}`;
  return `${a[0].last} et al.`;
}

const link = (e) => (e.doi ? `https://doi.org/${e.doi.replace(/^https?:\/\/doi\.org\//, "")}` : e.url ? e.url.replace(/\/$/, "") : "");
const pages = (e) => (e.pages ? clean(e.pages).replace(/-+/g, "–") : "");

/** APA 7 reference as [text, italic][] segments. */
function apa(e) {
  const head = `${authorList(e)} (${e.year}). `;
  const tail = (parts) => parts.filter(Boolean).join(" ");
  const pub = e.publisher ? clean(e.publisher) + "." : "";
  const url = link(e);
  switch (e.type) {
    case "inproceedings":
    case "incollection": {
      // APA 7: proceedings keep their (proper-name) title case; edited-book titles take sentence case.
      const pp = pages(e) ? ` (${/[–-]/.test(pages(e)) ? "pp." : "p."} ${pages(e)})` : "";
      const container = e.type === "incollection" ? sentenceCase(e.booktitle) : clean(e.booktitle);
      return [[head + sentenceCase(e.title) + ". In "], [container, true], [tail([pp + ".", pub, url])]];
    }
    case "article": {
      const vol = e.volume ? `, ` : "";
      return [
        [head + sentenceCase(e.title) + ". "], [clean(e.journal), true], [vol], [e.volume || "", true],
        [tail([(e.number ? `(${e.number})` : "") + (pages(e) ? `, ${pages(e)}` : "") + ".", url])],
      ];
    }
    case "book":
      return [[head], [sentenceCase(e.title), true], [tail([".", pub, url]).replace(/^ \./, ".")]];
    default: { // misc / techreport / preprint
      const note = e.eprint ? ` (arXiv:${e.eprint})` : e.number ? ` (${e.number})` : "";
      const where = e.publisher || e.howpublished || e.institution || (e.eprint ? "arXiv" : "");
      return [[head], [sentenceCase(e.title), true], [tail([`${note}.`, where ? clean(where) + "." : "", url])]];
    }
  }
}

// ---------- citations ----------
class Bibliography {
  constructor(bibPath) {
    this.entries = parseBib(fs.readFileSync(bibPath, "utf8"));
    this.cited = new Set();
  }
  get(key) {
    const e = this.entries[key];
    if (!e) throw new Error(`citation @${key} is not in references.bib`);
    this.cited.add(key);
    return e;
  }
  /** Replace all citation markup in a string with APA in-text citations. */
  resolve(text) {
    text = text.replace(/\[(@[^\]]+)\]/g, (_, inner) => {
      const parts = inner.split(";").map((p) => p.trim()).map((p) => {
        const m = /^@([\w:.-]+)\s*(?:,\s*(.+))?$/.exec(p);
        if (!m) throw new Error(`bad citation: [${inner}]`);
        const e = this.get(m[1]);
        return `${citeName(e, false)}, ${e.year}${m[2] ? `, ${m[2]}` : ""}`;
      });
      return `(${parts.join("; ")})`;
    });
    return text.replace(/(^|[^\w@])@([A-Za-z][\w:.-]*[\w])(?:\[([^\]]+)\])?/g, (_, pre, key, loc) => {
      const e = this.get(key);
      return `${pre}${citeName(e, true)} (${e.year}${loc ? `, ${loc}` : ""})`;
    });
  }
  /** Cited entries in APA order (first author's last name, then year). */
  list() {
    return [...this.cited].map((k) => this.entries[k]).sort((a, b) => {
      const ka = people(a.author || a.editor)[0].last, kb = people(b.author || b.editor)[0].last;
      return ka.localeCompare(kb) || String(a.year).localeCompare(String(b.year));
    }).map((e) => ({ key: e.key, parts: apa(e) }));
  }
  uncited() { return Object.keys(this.entries).filter((k) => !this.cited.has(k)); }
}

module.exports = { Bibliography, parseBib, apa, sentenceCase };
