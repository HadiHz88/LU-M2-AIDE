// Content checks shared by reports and slides (RULES.md §2, §1).
const fs = require("fs");
const path = require("path");

const INFORMAL = [
  /\b(don't|doesn't|isn't|aren't|can't|won't|it's|we're|didn't|wasn't|shouldn't|couldn't)\b/i,
  /\bI think\b|\bwe think\b|\bwe feel\b/i,
  /\b(pretty|kind of|sort of|a lot of|lots of|really|very good|okay|ok|got|stuff|things)\b/i,
];

/** Returns a list of error strings (empty = pass). */
function checkTexts(texts, factsPath) {
  const facts = fs.readFileSync(factsPath, "utf8");
  const errors = [];
  // 1. Number provenance: every decimal number must appear in the facts file.
  //    Section cross-references ("Section 2.1", "Sections 3 and 5.1" → the "3") are not data and are skipped.
  const text = texts.join("\n").replace(/Sections? \d+(\.\d+)*/g, "");
  for (const n of new Set(text.match(/\b\d+\.\d+\b/g) || [])) {
    if (!facts.includes(n)) errors.push(`number ${n} is not in ${path.basename(factsPath)}`);
  }
  // 2. Informal language (Ch. 1)
  for (const s of texts) for (const re of INFORMAL) {
    const m = s.match(re);
    if (m) errors.push(`informal wording "${m[0]}" in: "${s.slice(0, 70)}…"`);
  }
  return errors;
}

function assertTexts(texts, factsPath) {
  const errors = checkTexts(texts, factsPath);
  if (errors.length) throw new Error("Build checks failed:\n  - " + errors.join("\n  - "));
}

module.exports = { checkTexts, assertTexts };
