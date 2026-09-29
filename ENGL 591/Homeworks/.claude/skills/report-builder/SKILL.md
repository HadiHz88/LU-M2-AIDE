---
name: report-builder
description: Build a scientific report (.docx) and presentation (.pptx) for ENGL 591 from a project's plain-text sources. Covers interviewing the student, gathering verified facts and BibTeX, writing report.md and slides.yaml, building, visual QA and fact-checking. Use when the user wants to start, write, edit, rebuild, or check a report or presentation in this Homeworks folder, or asks for a new topic/project.
---

# Report builder

Follow the workflow in `AGENTS.md` (§2), stopping at each ⏸ gate. Summary:

1. **Setup check.** Run `shared/bin/doctor.sh`. If `profile.toml` is missing, copy `profile.example.toml` and ask the user for their details.
2. **Interview ⏸.** Establish the topic, the kind (review / proposal / experiment), the source paper(s), mini or full, and the deadline. Do not assume; offer options.
3. **New project.** Run `shared/bin/new.sh <name>`, then edit `<name>/sources/project.toml`.
4. **Source pack.** Read the primary PDF and put every fact, with its location, in `facts.md`. Take BibTeX from the raw `.bib` (ACL Anthology: URL + `.bib`) into `references.bib`. Put numbers in `data.yaml`. Never take numbers from web summaries.
5. **Draft ⏸.** Write `report.md` and `slides.yaml`, following `shared/RULES.md`. The syntax is in AGENTS.md §3 and the template files.
6. **Build.** `node shared/bin/build.js <name>`. Fix the sources when a check fails; never weaken a check.
7. **Visual QA.** `shared/bin/render.sh <scratch> <name>/out/*.docx <name>/out/*.pptx`, then read every page image.
8. **Fact-check.** Spawn a general-purpose subagent to compare the deliverables against the paper text, `facts.md` and `RULES.md`. Fix every issue and log it in the facts file's *Corrections log*.
9. **Deliver ⏸.** Send the PDFs, remind the user of the AI-use rule (RULES.md §2), and update `PLAN.md`.

Edits the user asks for go into `sources/` (content), `profile.toml` (personal details) or `shared/style.toml` (house style), then rebuild. Never hand-edit `out/`.
