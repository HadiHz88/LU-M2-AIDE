# ENGL 591 — Shared Rules (demo / mini / final)

House style lives in [`style.toml`](style.toml), personal and course details in `../profile.toml`, and project content in `<project>/sources/`. This file holds the **rules**.
Each rule cites the course slide it comes from, so it can be defended if questioned. Where it says "house rule", the choice is ours, not the course's.

---

## 1. Scientific language (Ch. 1)
- **Formal and objective.** No contractions (*don't → do not*), no slang, no "I think / we feel" (slide 6).
- **Precise.** Quantify everything: "*accuracy of 92.6%*", never "*much better*" (slides 6, 12).
- **Passive voice for methods and results**: "*The model was pre-trained on…*" (slide 15).
- **Scientific verbs** (slide 8):

  | Avoid | Use |
  |---|---|
  | get | obtain / acquire |
  | show | demonstrate / indicate |
  | find out | determine / discover |
  | need | require |
  | use | employ / apply (in moderation) |
  | good / okay | effective / satisfactory (+ a number) |

- **Linking words** (slide 8): *furthermore, in addition, moreover* · *however, on the other hand* · *therefore, consequently, as a result*.
- **Logical structure:** IMRaD (slides 23–24).
- **Vocabulary:** use the correct technical term (slide 37), and define it on first use.
- **House rule:** American English spelling; numbers < 10 as words in prose except with units/percentages; abbreviations defined on first use: "*multilingual BERT (mBERT)*".

## 2. Academic integrity (Ch. 1, slide 31)
- Cite every borrowed **text, idea, figure, number, and code**. Idea plagiarism counts too.
- Results from an external study are always attributed: "*Antoun et al. (2020) reported…*". Never present them as our own.
- Paraphrase, never copy. A quote needs quotation marks + page number, and at most 1–2 per document.
- **AI-generated text** is listed as plagiarism if submitted *without rewriting*. Decide before each submission: personal rewrite pass and/or an AI-assistance disclosure line in the acknowledgements.
- **Self-plagiarism:** the final must not reuse text from the mini.
- **House rule, number provenance:** every number in a deliverable must appear in that project's `sources/*_facts.md` with its location in the source (section/table/page). If it is not there, it does not go in.

## 3. Summaries & abstracts (Ch. 2)
- **Abstract structure** (slide 16): Background → Aim → Method → Results → Conclusion.
- Must answer (slide 17): *Why important? What was done and how? What was found? What does it mean?*
- **Length:** mini report 3–4 sentences (Ch. 3 slide 20); full report 100–250 words (slide 18).
- **Avoid** (slides 21, 25): vague terms without numbers, missing elements, jargon overload, excessive length.
- **Summaries** are 10–20% of the original's length, in our own words (slide 5).
- **Citation format** is APA (slide 22), e.g. `Author, A., & Author, B. (Year). Title. Journal, Vol(Issue), pages. DOI`.

## 4. Reports (Ch. 3)
**Full structure** (slide 4), used for the final:
Cover · Acknowledgements · Abstract · Table of Contents · List of Figures & Tables · Introduction · Background · Methodology · Results & Analysis · Discussion & Recommendations · Conclusion · References · Appendices.

**Mini structure** (slide 20, plus our front-matter rule), used for the homework:
Cover · Abstract · **Contents · List of Figures · List of Tables** · Introduction · Methodology · Expected Results *(for a study review: "Results")* · Discussion · Conclusion · References.

**House rule: front matter is mandatory in every report**, mini and final, even where the course template omits it (slides 4 and 9):
- A **Table of Contents** (levels 1–2) on its own page, **after the Abstract and before the Introduction** (slide 4 order).
- A **List of Figures** and a **List of Tables** directly under it, whenever the report has figures or tables.
- They must be **real Word fields** (TOC, and TOC \c on the SEQ caption numbers) so they can be refreshed with F9. They must also ship with **pre-filled, verified page numbers**, so they read correctly on first open in Word or LibreOffice.
- Enforced in code: `docx_kit.buildDocument` throws if `K.CONTENTS` is missing. The report build is two-pass (`shared/lib/paginate.js`): it lays the document out, reads each heading's and caption's page, rebuilds, and fails if the numbers do not stabilise.
- **House rule: each section starts on a new page.** A page break comes before every top-level (Heading 1) section: Abstract, Contents, 1 Introduction, 2 Background, …, Conclusion, References, Appendices. Subsections (2.1, 2.2, …) flow on. The List of Figures and List of Tables stay on the Contents page as part of the front matter. Controlled by `report.section_page_break` in `style.toml` and applied automatically by `docx_kit.h1`. Never insert manual breaks.
- After any **manual edit in Word**: right-click the contents → *Update Field → Update entire table* (or select all + F9).

**Cover page** (slide 5): title, author, institution, department/program, supervisor/instructor, date. We also add the coordinator and both logos.

**Section content:**
| Section | Must contain (slide) |
|---|---|
| Introduction | problem, context, objectives, why it matters, outline of the report (11) |
| Background | needed theory, brief related work, definitions/diagrams (12) |
| Methodology | tools, datasets, methods, preprocessing, training, metrics, hardware/software (13) |
| Results | captioned tables/charts, comparisons, professional interpretation that references the table (14) |
| Discussion | real-world meaning, improvements, next steps (15) |
| Conclusion | restate objective + outcomes, **no new information** (16) |
| References | one consistent style (APA), everything cited (17) |
| Appendices | large tables, code, extra docs (18) |

**Formatting** (slides 10, 19): see `[report]` in `style.toml`. Times New Roman 12, 1.5 spacing, 2.5 cm margins, page numbers bottom center, all figures/tables numbered and captioned, Heading 1/2/3 styles → automatic TOC and List of Figures/Tables.

**Results sentence pattern** (slide 14): "*As shown in Table 2, [model] achieved the highest [metric] ([value]), outperforming [baseline] by [delta].*"

## 5. Presentations (Ch. 4)
- **Structure** (slides 4, 13): Title → Objective → Method → Results → Conclusion → Questions.
- **1 minute per slide**; visuals (graphs, diagrams) over text; no paragraphs; **no red text**; one consistent style (slide 5).
- The good-vs-bad example (slides 7–8): short labeled facts plus a visual, not one long sentence.
- **House rules:** ≤ 4 bullets, ≤ 12 words each; body text ≥ 14 pt (card text), source lines ≥ 10 pt; one key message per slide as an assertion-style title (e.g. "*AraBERT outperforms mBERT on all five datasets*"); a source line under any borrowed figure or number; speaker notes on every slide.
- **Audience** (slide 9): one central message; simplify AI terms for non-experts.
- **Delivery** (slides 10–11): rehearse and time it; do not read the slides; eye contact.
- **Questions** (slide 12): repeat the question; if unsure, say "*I will look into that*"; stay professional.

## 6. Pre-submission checklist
- [ ] Every number is in `sources/*_facts.md` and matches the source
- [ ] Every borrowed idea/figure/number cited; reference list complete, APA, alphabetical
- [ ] No contractions, no "I think", no vague adjectives without numbers
- [ ] Abstract has all 5 elements, within the length limit
- [ ] Conclusion introduces nothing new
- [ ] Figures/tables numbered, captioned, referenced in the text
- [ ] Contents + List of Figures + List of Tables present after the abstract, page numbers match the rendered PDF
- [ ] Every top-level section starts on a new page; no blank pages
- [ ] Fonts, spacing, margins, page numbers per `style.toml`
- [ ] Slides: timing ≈ 1 min/slide, no red text, ≥ 18 pt, notes present
- [ ] AI-use decision applied (rewrite pass and/or disclosure)

## 7. Working conventions (multi-session, multi-student)
The full agent workflow is in `../AGENTS.md`. The conventions:
- **Sources are the single source of truth.** Every project is `<project>/sources/` (project.toml, facts.md, references.bib, data.yaml, report.md, slides.yaml, qa.md). Deliverables in `<project>/out/` are **generated, never hand-edited**. To change output, edit the sources (or `style.toml` / `profile.toml`) and rebuild.
- **Build:** from `Homeworks/`, run `node shared/bin/build.js <project> [report|slides|all]`. Every check in §6 that can be automated runs here and fails the build.
- **Visual QA (required after every build):** `shared/bin/render.sh <tmp_dir> <files…>` renders PDF + JPG pages through LibreOffice. Inspect every page for overflow, overlaps and blank pages before delivering.
- **Independent fact-check** before each delivery: a reviewer that did not write the text compares it against the primary source.
- **New project:** `shared/bin/new.sh <name>` copies `templates/project/`. **Setup check:** `shared/bin/doctor.sh`.
- **Review gates:** stop after the interview, the draft and the delivery for the student's approval.
- **Version control (the repo is PUBLIC):** the toolchain, template, rules and docs are tracked. Every project folder and `profile.toml` are git-ignored by default. Publish a project only after it has been submitted (`!/<name>/` in `.gitignore`). `out/` and `node_modules/` are never committed. Never put homework text in shared files.
- **Deliverable filenames:** `<Name>_<Course>_<file_label>_<Report|Slides>_v<N>.docx|pptx` (from profile.toml + project.toml).
