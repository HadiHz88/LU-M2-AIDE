# ENGL 591: Report & Presentation Builder

Write a scientific **report** (Word) and **presentation** (PowerPoint) as plain text, and get polished, rule-checked
deliverables in the Lebanese University (Faculty of Science) house style. It is built for the ENGL 591 *Scientific
English and Communication Skills* course (M2 AIDE), and designed to be driven by an AI agent or edited by hand.

```
profile.toml            your name, university, instructor          (copy from profile.example.toml)
<project>/sources/      everything you write
  project.toml          title, subtitle, version
  facts.md              verified facts from the paper (every number must be here)
  references.bib        BibTeX; cite with [@key] or @key
  data.yaml             table and chart numbers
  report.md             the report, in Markdown
  slides.yaml           the slides, one block per slide
<project>/out/          generated: .docx, .pptx, speaker script (never edit)
```

## Quick start
```bash
npm install
cp profile.example.toml profile.toml      # then put your name in it
shared/bin/doctor.sh                      # checks Node, LibreOffice, poppler
shared/bin/new.sh my-topic                # new project from the template
node shared/bin/build.js my-topic         # → my-topic/out/*.docx, *.pptx, script.md
```
Open the files in `my-topic/out/`, edit `my-topic/sources/`, rebuild. The template builds as-is with example values, so
you can see every feature before writing anything.

**With an AI agent:** open this folder and ask, for example, *"Start a new mini report reviewing \<paper\>."* The agent
follows `AGENTS.md` (Claude Code also loads the `report-builder` skill): it interviews you, builds a verified fact
sheet from the paper, writes the sources, builds, checks every page, and has the result fact-checked.

## What you get for free
- Cover page with logos, abstract, **Contents / List of Figures / List of Tables** with correct page numbers, each section on a new page, numbered captions, APA 7 citations and reference list generated from BibTeX.
- Slides in a consistent layout system (title, objective, method steps, table, chart + key numbers, discussion, conclusion, questions), with speaker notes and a timed script.
- **Checks that fail the build:** numbers not backed by `facts.md`, unknown citations or cross-references, informal wording, over-long slide titles.

## Rules
`shared/RULES.md` gathers the course rules (Chapters 1–4) with slide references, the house rules, and a
pre-submission checklist.

## Privacy
Project folders are git-ignored by default, so your homework is not published with the toolchain. Publish a project only
after it has been submitted, by adding `!/<project>/` to `.gitignore`.

## Requirements
Node.js ≥ 18, LibreOffice and poppler (`brew install --cask libreoffice && brew install poppler` on macOS). LibreOffice
lays the report out to compute the contents page numbers and renders page previews for checking.
