#!/usr/bin/env bash
# Render .docx/.pptx deliverables to PDF + JPG pages for visual QA.
# Usage: shared/bin/render.sh <out_dir> <file> [file...]
# Needs LibreOffice (/Applications/LibreOffice.app) and poppler (pdftoppm), both via Homebrew.
set -euo pipefail
out="$1"; shift
mkdir -p "$out"
SOFFICE="/Applications/LibreOffice.app/Contents/MacOS/soffice"
for f in "$@"; do
  base="$(basename "${f%.*}")"
  "$SOFFICE" --headless --convert-to pdf --outdir "$out" "$f" >/dev/null 2>&1
  rm -f "$out/$base"-*.jpg
  case "$f" in
    *.pptx) pdftoppm -jpeg -r 150 "$out/$base.pdf" "$out/$base" ;;
    *)      pdftoppm -jpeg -r 90  "$out/$base.pdf" "$out/$base" ;;
  esac
  ls -1 "$out/$base"-*.jpg
done
