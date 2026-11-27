"""Build WORKING-GUIDE.pdf: the click-by-click guide for doing and recording Assignment 2.

Usage: python tools/build_guide_pdf.py <assignment_2_solution dir>      (needs reportlab)
The text lives in tools/guide_content.py (shared with the web page); pipeline listings come from pipelines/*.yml.
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import guide_content
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                XPreformatted, PageBreak, KeepTogether, CondPageBreak)

SOL = pathlib.Path(sys.argv[1])
OUT = SOL / "WORKING-GUIDE.pdf"

INK = colors.HexColor("#1b2230"); MUTED = colors.HexColor("#5d6676"); LINE = colors.HexColor("#dde1e8")
ACCENT = colors.HexColor("#3b5bdb"); CODEBG = colors.HexColor("#f2f4f8"); WARN = colors.HexColor("#b35c00")
TAGCOL = {"GO": "#3b5bdb", "CLICK": "#6b4fc9", "TYPE": "#1f7a8c", "PASTE": "#1f7a8c",
          "SHOW": "#1f8a4c", "SAY": "#5d6676", "CHECK": "#1f8a4c", "NOTE": "#b35c00", "OFF-CAM": "#c92a2a"}

base = dict(fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK)
st = {
 "title": ParagraphStyle("title", **{**base, "fontName": "Helvetica-Bold", "fontSize": 22, "leading": 27}),
 "sub": ParagraphStyle("sub", **{**base, "fontSize": 11, "leading": 15, "textColor": MUTED}),
 "h1": ParagraphStyle("h1", **{**base, "fontName": "Helvetica-Bold", "fontSize": 15, "leading": 19, "spaceBefore": 6, "spaceAfter": 6, "textColor": ACCENT}),
 "h2": ParagraphStyle("h2", **{**base, "fontName": "Helvetica-Bold", "fontSize": 11.5, "leading": 15, "spaceBefore": 10, "spaceAfter": 4}),
 "body": ParagraphStyle("body", **{**base, "spaceAfter": 4}),
 "small": ParagraphStyle("small", **{**base, "fontSize": 8.5, "leading": 11.5, "textColor": MUTED}),
 "cell": ParagraphStyle("cell", **{**base, "fontSize": 9, "leading": 12.5}),
 "tag": ParagraphStyle("tag", **{**base, "fontName": "Helvetica-Bold", "fontSize": 7.5, "leading": 12.5, "textColor": colors.white, "alignment": 1}),
 "code": ParagraphStyle("code", fontName="Courier", fontSize=7.6, leading=9.6, textColor=INK),
 "meta": ParagraphStyle("meta", **{**base, "fontSize": 8.5, "leading": 12, "textColor": MUTED}),
}

def c(s):  # inline code; real URLs become clickable links
    f = f'<font name="Courier" size="8.8" color="#1f3d99">{escape(s)}</font>'
    if s.startswith("http") and "<" not in s:
        return f'<link href="{escape(s)}">{f}</link>'
    return f

def P(t, s="body"): return Paragraph(t, st[s])

def table(rows, widths, header=True):
    data = [[P(x, "cell") if isinstance(x, str) else x for x in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [("GRID", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
             ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if header: style.append(("BACKGROUND", (0, 0), (-1, 0), CODEBG))
    t.setStyle(TableStyle(style)); return t

def actions(lines):
    rows = []
    for tag, text in lines:
        tg = Table([[P(tag, "tag")]], colWidths=[17 * mm])
        tg.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(TAGCOL[tag])),
                                ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                                ("LEFTPADDING", (0, 0), (-1, -1), 1), ("RIGHTPADDING", (0, 0), (-1, -1), 1)]))
        rows.append([tg, P(text, "cell")])
    t = Table(rows, colWidths=[19 * mm, 155 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    return t

def code_block(name):
    lines = (SOL / "pipelines" / name).read_text().rstrip().split("\n")
    chunks = [lines[i:i + 30] for i in range(0, len(lines), 30)]  # one row per chunk so the table can split across pages
    label = P(f'<b>pipelines/{name}</b> - select all in the Web IDE editor (Cmd+A), delete, paste this:', "small")
    rows = [[XPreformatted(escape("\n".join(ch)), st["code"])] for ch in chunks]
    story.append(CondPageBreak(45 * mm))
    story.append(label); story.append(Spacer(1, 3))
    t = Table(rows, colWidths=[174 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CODEBG), ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                           ("LEFTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, 0), 6),
                           ("BOTTOMPADDING", (0, -1), (-1, -1), 6)]))
    return t

story = []
def step(num, title, where, lines, yml=None, expect=None):
    head = [CondPageBreak(60 * mm), P(f"Step {num} &nbsp; {title}", "h2")]
    if where: head.append(P(f"Branch: {c(where)}" + (f" &nbsp;|&nbsp; Expected: <b>{expect}</b>" if expect else ""), "meta"))
    elif expect: head.append(P(f"Expected: <b>{expect}</b>", "meta"))
    story.extend(head); story.append(Spacer(1, 3)); story.append(actions(lines))
    if yml: story.append(Spacer(1, 5)); story.append(code_block(yml))  # code_block appends its own label first


class PdfRenderer:
    c = staticmethod(c)
    step = staticmethod(step)

    @staticmethod
    def add(*blocks):
        for b in blocks:
            kind = b[0]
            if kind == "break": story.append(PageBreak())
            elif kind == "space": story.append(Spacer(1, 6))
            elif kind == "codefile":
                text = (SOL / b[1]).read_text().rstrip()
                t = Table([[XPreformatted(escape(text), st["code"])]], colWidths=[174 * mm])
                t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CODEBG), ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                                       ("LEFTPADDING", (0, 0), (-1, -1), 6)]))
                story.extend([Spacer(1, 4), t])
            else:
                story.append(P(b[1], {"p": "body"}.get(kind, kind)))

    @staticmethod
    def table(rows, widths):
        story.append(table(rows, [w * mm for w in widths]))


guide_content.build(PdfRenderer)

def on_page(canv, doc):
    canv.saveState(); canv.setFont("Helvetica", 7.5); canv.setFillColor(MUTED)
    canv.drawString(18 * mm, 10 * mm, "AIDE501 Assignment 2 - GitLab CI/CD working guide")
    canv.drawRightString(A4[0] - 18 * mm, 10 * mm, f"{doc.page}"); canv.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                        title="AIDE501 Assignment 2 - GitLab CI/CD working guide", author="AIDE501")
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(OUT)
