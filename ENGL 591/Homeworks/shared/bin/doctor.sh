#!/usr/bin/env bash
# Check that everything the build needs is installed.   Usage (from Homeworks/): shared/bin/doctor.sh
cd "$(dirname "$0")/../.."
ok=1
check() { if eval "$2" >/dev/null 2>&1; then echo "✓ $1"; else echo "✗ $1  →  $3"; ok=0; fi; }
check "Node.js ≥ 18"            'node -e "process.exit(+process.versions.node.split(\".\")[0] >= 18 ? 0 : 1)"' "install from https://nodejs.org (or: brew install node)"
check "npm packages installed"  'node -e "[\"docx\",\"pptxgenjs\",\"sharp\",\"smol-toml\",\"yaml\"].forEach(require)"' "run: npm install"
check "profile.toml present"    'test -f profile.toml' "run: cp profile.example.toml profile.toml   and edit it"
check "LibreOffice (layout, TOC page numbers, previews)" 'test -x /Applications/LibreOffice.app/Contents/MacOS/soffice' "brew install --cask libreoffice   (macOS)"
check "poppler pdftotext/pdftoppm" 'command -v pdftotext && command -v pdftoppm' "brew install poppler   (macOS)"
[[ $ok == 1 ]] && echo "All set. Try: node shared/bin/build.js <project>" || exit 1
