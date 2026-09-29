#!/usr/bin/env bash
# Create a new project from the template.   Usage (from Homeworks/): shared/bin/new.sh <name>
set -euo pipefail
cd "$(dirname "$0")/../.."
name="${1:?usage: shared/bin/new.sh <name>   (e.g. final, mini2, my-topic)}"
[[ -e "$name" ]] && { echo "✗ $name/ already exists"; exit 1; }
cp -R templates/project "$name"
echo "✓ created $name/sources/ from templates/project"
echo
echo "Next:"
echo "  1. Put the study's verified facts in   $name/sources/facts.md"
echo "  2. Add its BibTeX to                   $name/sources/references.bib"
echo "  3. Edit                                $name/sources/{project.toml,report.md,slides.yaml,data.yaml}"
echo "  4. Build:   node shared/bin/build.js $name"
echo "  5. Check:   shared/bin/render.sh /tmp/$name-qa $name/out/*.docx $name/out/*.pptx"
echo
echo "New project folders are git-ignored by default (see .gitignore). Publish only after submission."
