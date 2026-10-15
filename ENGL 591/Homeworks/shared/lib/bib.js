// Minimal BibTeX reader + APA 7 formatter + citation resolver.
//
// In any source text:
//   [@key]              → (Antoun et al., 2020)
//   [@key, Table 1]     → (Antoun et al., 2020, Table 1)
//   [@a; @b]            → (Antoun et al., 2020; Devlin et al., 2019)
//   @key                → Antoun et al. (2020)          (narrative)
//   @key[Table 1]       → Antoun et al. (2020, Table 1)
// Two authors: "Aly & Atiya" in parentheses, "Aly and Atiya" in narrative (APA 7).
// IEEE style (new Bibliography(path, { style: "ieee" }), for project.toml report.format = "ieee"):
//   [@key] → [1]   [@key, Table 1] → [1, Table 1]   [@a; @b] → [1], [2]   @key → Huang et al. [1]
//   Numbers follow the order of first citation; list() returns the entries in that order, formatted by ieee().
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

// A field wholly in braces is one group author, kept as written: author = {{ONNX Runtime developers}}.
function people(field) {
  if (/^\{[^{}]*\}$/.test((field || "").trim())) return [{ last: clean(field).trim(), initials: "" }];
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

// A title ending in "?" or "!" takes no extra period: "Do better ImageNet models transfer better? In …"
const stop = (t) => (/[?!]$/.test(t) ? t : t + ".");

/** APA 7 reference as [text, italic][] segments. */
function apa(e) {
  const head = `${authorList(e)} (${e.year}). `;
  const tail = (parts) => parts.filter(Boolean).join(" ");
  const pub = e.publisher ? clean(e.publisher).replace(/\.$/, "") + "." : ""; // "Curran Associates, Inc." takes no second period
  const url = link(e);
  switch (e.type) {
    case "inproceedings":
    case "incollection": {
      // APA 7: proceedings keep their (proper-name) title case; edited-book titles take sentence case.
      const pp = pages(e) ? ` (${/[–-]/.test(pages(e)) ? "pp." : "p."} ${pages(e)})` : "";
      const container = e.type === "incollection" ? sentenceCase(e.booktitle) : clean(e.booktitle);
      return [[head + stop(sentenceCase(e.title)) + " In "], [container, true], [tail([pp + ".", pub, url])]];
    }
    case "article": {
      const vol = e.volume ? `, ` : "";
      return [
        [head + stop(sentenceCase(e.title)) + " "], [clean(e.journal), true], [vol], [e.volume || "", true],
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

/** IEEE reference (IEEE Reference Guide) as [text, italic][] segments, without the leading "[n]". */
function ieeeAuthors(entry) {
  const a = people(entry.author || entry.editor || "Anonymous").map((p) => (p.initials ? `${p.initials} ${p.last}` : p.last));
  if (a.length > 6) return `${a[0]} et al.`;
  if (a.length <= 2) return a.join(" and ");
  return a.slice(0, -1).join(", ") + ", and " + a[a.length - 1];
}
function ieee(e) {
  const who = ieeeAuthors(e);
  const t = sentenceCase(e.title);
  const title = /[?!]$/.test(t) ? `\u201c${t}\u201d` : `\u201c${t},\u201d`; // no comma after a "?" or "!"
  const pp = pages(e) ? `${/[–-]/.test(pages(e)) ? "pp." : "p."} ${pages(e)}` : "";
  const doi = e.doi ? ` doi: ${e.doi.replace(/^https?:\/\/doi\.org\//, "")}.` : "";
  const end = (parts) => parts.filter(Boolean).join(", ") + "." + doi;
  switch (e.type) {
    case "inproceedings":
    case "incollection":
      return [[`${who}, ${title} in `], [clean(e.booktitle), true],
        [", " + end([e.volume && `vol. ${e.volume}`, e.address && clean(e.address), e.year, pp])]];
    case "article":
      return [[`${who}, ${title} `], [clean(e.journal), true],
        [", " + end([e.volume && `vol. ${e.volume}`, e.number && `no. ${e.number}`, pp, e.year])]];
    case "book":
      return [[`${who}, `], [clean(e.title), true], [". " + end([e.address && clean(e.address) + ": " + clean(e.publisher || ""), e.year])]];
    default: { // misc / preprint / techreport / software
      const where = e.eprint ? `arXiv:${e.eprint}` : clean(e.howpublished || e.publisher || e.institution || "");
      return [[`${who}, ${title} `], [end([where, e.year]).replace(/^, /, "")]].concat(e.url && !e.doi && !e.eprint ? [[` [Online]. Available: ${e.url}`]] : []);
    }
  }
}

// ---------- citations ----------
class Bibliography {
  constructor(bibPath, { style = "apa" } = {}) {
    this.entries = parseBib(fs.readFileSync(bibPath, "utf8"));
    this.cited = new Set();
    this.order = []; // keys in order of first citation (IEEE numbering)
    this.style = style;
  }
  get(key) {
    const e = this.entries[key];
    if (!e) throw new Error(`citation @${key} is not in references.bib`);
    if (!this.cited.has(key)) this.order.push(key);
    this.cited.add(key);
    return e;
  }
  /** IEEE reference number of a key (assigned on first citation). */
  number(key) { this.get(key); return this.order.indexOf(key) + 1; }
  /** Replace all citation markup in a string with in-text citations (APA, or IEEE numbers). */
  resolve(text) {
    if (this.style === "ieee") {
      // One left-to-right pass over both forms, so numbers follow the reading order.
      return text.replace(/\[(@[^\]]+)\]|(^|[^\w@\[])@([A-Za-z][\w:.-]*[\w])(?:\[([^\]]+)\])?/g, (all, inner, pre, key, loc) => {
        if (inner) {
          return inner.split(";").map((p) => p.trim()).map((p) => {
            const m = /^@([\w:.-]+)\s*(?:,\s*(.+))?$/.exec(p);
            if (!m) throw new Error(`bad citation: [${inner}]`);
            return `[${this.number(m[1])}${m[2] ? `, ${m[2]}` : ""}]`;
          }).join(", ");
        }
        const e = this.get(key);
        return `${pre}${citeName(e, true)} [${this.number(key)}${loc ? `, ${loc}` : ""}]`;
      });
    }
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
  /** Cited entries: APA order (first author's last name, then year), or IEEE order (first citation). */
  list() {
    if (this.style === "ieee") return this.order.map((k, i) => ({ key: k, n: i + 1, parts: ieee(this.entries[k]) }));
    return [...this.cited].map((k) => this.entries[k]).sort((a, b) => {
      const ka = people(a.author || a.editor)[0].last, kb = people(b.author || b.editor)[0].last;
      return ka.localeCompare(kb) || String(a.year).localeCompare(String(b.year));
    }).map((e) => ({ key: e.key, parts: apa(e) }));
  }
  uncited() { return Object.keys(this.entries).filter((k) => !this.cited.has(k)); }
}

module.exports = { Bibliography, parseBib, apa, ieee, sentenceCase };
