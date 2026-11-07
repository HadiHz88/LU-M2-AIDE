"""Build the PDF lab reports from the Markdown sources in this folder.

    uv run --with markdown python build.py            # all reports
    uv run --with markdown python build.py load_testing
"""
import html
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import markdown

HERE = Path(__file__).resolve().parent
SUBMISSIONS = HERE.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
AUTHOR = "Hadi Hijazi"
PROGRAM = "Lebanese University, Master 2 AIDE"
DATE = "November 2026"

REPORTS = {
    "unit_integration_testing": {
        "folder": "01_unit_integration_testing",
        "lab": "Lab 1",
        "title": "Unit and Integration Testing of a Flask Application",
        "subtitle": "Automated tests with pytest, fixtures and the Flask test client",
    },
    "load_testing": {
        "folder": "02_load_testing",
        "lab": "Lab 2",
        "title": "Load Testing a Flask Authentication Service with k6",
        "subtitle": "Throughput, latency and capacity limits under constant and ramping traffic",
    },
    "docker_containers": {
        "folder": "03_docker_containers",
        "lab": "Lab 3",
        "title": "Containerising a Web Application with Docker",
        "subtitle": "Single-stage and multi-stage images, layer caching and image size",
    },
}

CSS = (HERE / "report.css").read_text(encoding="utf-8")


def render(name: str, meta: dict) -> str:
    source = (HERE / f"{name}.md").read_text(encoding="utf-8")
    body = markdown.markdown(source, extensions=["tables", "fenced_code", "md_in_html", "attr_list"])
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{html.escape(meta['title'])}</title>
<base href="{HERE.as_uri()}/">
<style>{CSS}</style></head>
<body>
<header class="titleblock">
  <p class="course">AIDE505 &middot; MLOps &middot; {meta['lab']}</p>
  <h1>{html.escape(meta['title'])}</h1>
  <p class="subtitle">{html.escape(meta['subtitle'])}</p>
  <p class="byline">{AUTHOR}<br>{PROGRAM}<br>{DATE}</p>
</header>
{body}
</body></html>"""


def print_pdf(page: Path, pdf: Path) -> None:
    """Chrome's headless printer often stays alive after writing; stop it once the PDF is done."""
    pdf.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        proc = subprocess.Popen(
            [CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer",
             f"--user-data-dir={profile}", f"--print-to-pdf={pdf}", page.as_uri()],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        last_size, stable = -1, 0
        for _ in range(120):
            time.sleep(0.5)
            if proc.poll() is not None:
                break
            size = pdf.stat().st_size if pdf.exists() else -1
            stable = stable + 1 if size > 0 and size == last_size else 0
            last_size = size
            if stable >= 3:
                break
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)
            proc.wait(timeout=10)
    if not pdf.exists() or pdf.stat().st_size == 0:
        raise SystemExit(f"PDF not written: {pdf}")


def main() -> None:
    names = sys.argv[1:] or list(REPORTS)
    build = HERE / "build"
    build.mkdir(exist_ok=True)
    for name in names:
        meta = REPORTS[name]
        page = build / f"{name}.html"
        page.write_text(render(name, meta), encoding="utf-8")
        pdf = SUBMISSIONS / meta["folder"] / f"AIDE505_{name}_Hadi_Hijazi_report.pdf"
        print_pdf(page, pdf)
        print(f"{name}: {pdf.relative_to(SUBMISSIONS)}")


if __name__ == "__main__":
    main()
