# AGENTS.md: Scientific report & presentation builder

Instructions for any AI coding agent (Claude Code, Codex, Cursor, …) helping a student produce an ENGL 591
**report (.docx) and presentation (.pptx)** from a scientific study. Humans: see README.md.

**Everything is driven by plain-text files in `<project>/sources/`.** You (the agent) write and edit those
files; the student edits them too. A single command turns them into the deliverables. Never hand-edit files in
`out/`, and never put content in code.

## 0. Read first
1. `shared/RULES.md`: course rules (scientific English, abstract, report structure, slides, integrity) and the pre-submission checklist. They are graded; follow them.
2. `profile.toml`: the student's name and course. If it is missing: `cp profile.example.toml profile.toml`, then ask the student for their details.
3. `PLAN.md` (if present): the student's decisions and progress log. Update it at the end of every session.

## 1. Setup (once per machine)
```bash
npm install                 # docx, pptxgenjs, sharp, smol-toml, yaml
shared/bin/doctor.sh        # checks Node, packages, profile, LibreOffice, poppler
```
LibreOffice and poppler are needed for the two-pass contents build and for visual QA
(macOS: `brew install --cask libreoffice && brew install poppler`). Ask before installing software.

## 2. Workflow: stop at each ⏸ and wait for the student
1. **Interview ⏸.** Ask, and do not assume: the topic; the kind (`review` of a published study / `proposal` / own `experiment`); the source paper(s); mini or full report; deadline; audience. Offer 3–5 topic options with trade-offs if the student has none.
2. **Project.** `shared/bin/new.sh <name>` copies `templates/project/`. Set `sources/project.toml`.
3. **Source pack.**
   - Read the **primary PDF**. Record every fact you will use in `sources/facts.md`, with its location (section, table, page).
   - Put the BibTeX in `sources/references.bib`. Take it from the raw `.bib` (ACL Anthology: paper URL + `.bib`; DOI: Crossref). **Never trust a web summary for numbers or bibliographic data**: this project already caught a summary inventing a paper's corpus size and hardware.
   - Put table and chart numbers in `sources/data.yaml`.
4. **Draft ⏸.** Write `sources/report.md` and `sources/slides.yaml` (syntax below). Follow RULES.md: passive voice for methods, numbers instead of vague adjectives, every borrowed idea cited, results attributed to their authors.
5. **Build.** `node shared/bin/build.js <name>`. A failed check means the **sources** are wrong, so fix them. Never weaken a check.
6. **Visual QA.** Run `shared/bin/render.sh <tmp> <name>/out/*.docx <name>/out/*.pptx` and look at **every** page and slide: overflow, overlaps, blank pages, figure legibility.
7. **Independent fact-check.** Have a fresh agent or reviewer compare the report and slides against the paper text. Fix every "must fix" and log the corrections in `facts.md` → *Corrections log*.
8. **Deliver ⏸.** Send the PDFs and the .docx/.pptx. Remind the student of the AI-use rule (RULES.md §2): they must rewrite in their own words and/or disclose the assistance.
9. **Rehearse (optional).** Walk through `out/script.md` (the timed speaker notes) and `sources/qa.md`, playing the jury.

## 3. Sources, one file per concern
| File | Holds | Notes |
|---|---|---|
| `project.toml` | title, subtitle, label, running title, version, deliverables, kind | |
| `facts.md` | verified facts + locations + corrections log | **Every decimal number** in the other files must appear here, or the build fails |
| `references.bib` | BibTeX | Only cited entries are listed. Protect proper nouns: `{A}rabic` |
| `data.yaml` | rows for tables and charts | Cells may contain `@key` citations |
| `report.md` | the report | Syntax below |
| `slides.yaml` | the deck, one YAML document per slide | Layouts below |
| `qa.md` | likely questions and answers | Not built; for rehearsal |

### report.md
```
# Section {#id}                 numbered, starts a new page      # Abstract {.unnumbered}
## Subsection {#id}             numbered 2.1, 2.2 …
**bold** *italic*  - bullets  <!-- comments -->
[@key]  @key  [@key, Table 1]  [@a; @b]           APA 7 in-text citations
[[table:id]] [[figure:id]] [[section:id]]         auto-numbered cross-references
::: contents :::                                  Contents + List of Figures + List of Tables (mandatory)
::: references :::                                reference list
::: table id        (YAML: caption, data | rows, columns[{key,label,decimals}], widths, bold: row-max, note) :::
::: figure id       (YAML: type grouped-columns | flow | image, caption, note, width, …) :::
```

### slides.yaml layouts
`title`, `rows-callout`, `steps`, `table-callout`, `chart-stats`, `two-columns`, `closing`, `questions`. Their fields
are documented at the top of `shared/lib/slides_yaml.js`, with working examples in `templates/project/sources/slides.yaml`.
Content-slide titles are single assertions of **≤ 50 characters** (the build enforces this). Every slide has `notes`.

## 4. What the build enforces (do not bypass)
- Decimal numbers must be in `facts.md`. Citations must be `@key`s present in `references.bib`; hand-typed "Author et al., 2020" is refused.
- No informal wording (contractions, "I think", "a lot of", "pretty", …).
- Contents, List of Figures and List of Tables after the abstract, with page numbers verified by a second layout pass. Each section starts on a new page.
- Slide titles ≤ 50 characters.

## 5. Where to change what
| To change… | Edit |
|---|---|
| wording, structure, numbers, slides | `<project>/sources/*` |
| name, university, instructor, logos | `profile.toml` |
| fonts, spacing, colors, chart palette | `shared/style.toml` (affects everyone) |
| a course rule | `shared/RULES.md`, and enforce it in `shared/lib/*` where possible |
| a new slide layout or report directive | `shared/lib/slides_yaml.js` / `shared/lib/report_md.js`, then document it here and in the template |

## 6. Privacy & integrity
- The repository may be **public**. Project folders are git-ignored by default (`.gitignore`: `/*/`). Publish one only **after** it has been submitted (`!/<name>/`). Commit only when the student asks.
- For a review, results are *reported by* the authors, never presented as the student's own.
- Chapter 1 counts unrewritten AI-generated text as plagiarism. The student decides on a rewrite pass and/or a disclosure.
