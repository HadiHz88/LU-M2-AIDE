"""Figures for the lab reports, drawn from the measured numbers (written as SVG)."""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

OUT = Path(__file__).parent / "figures"
OUT.mkdir(exist_ok=True)

INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#e4e3df"
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"

plt.rcParams.update({
    "font.family": "Helvetica Neue",
    "font.size": 8.5,
    "text.color": INK,
    "axes.labelcolor": INK_2,
    "axes.edgecolor": INK_2,
    "axes.linewidth": 0.6,
    "xtick.color": INK_2,
    "ytick.color": INK_2,
    "xtick.major.width": 0.6,
    "ytick.major.width": 0.6,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "axes.axisbelow": True,
    "grid.color": GRID,
    "grid.linewidth": 0.6,
    "svg.fonttype": "none",
    "figure.dpi": 100,
})


def save(fig, name):
    fig.savefig(OUT / f"{name}.svg", bbox_inches="tight", pad_inches=0.04)
    plt.close(fig)


# ---- Load testing: POST /login p95 vs target login rate, per thread count ----
series = [
    ("2 threads", BLUE, "o", [(50, 11.8), (100, 16.9), (150, 582.7), (200, 643.7)]),
    ("8 threads", ORANGE, "s", [(50, 13.4), (100, 12.9), (200, 13.9), (250, 19.8),
                                (300, 44.9), (350, 311.2), (400, 252.9)]),
    ("16 threads", AQUA, "D", [(200, 16.0), (250, 19.8), (300, 20.0), (400, 188.3)]),
]
fig, ax = plt.subplots(figsize=(6.2, 2.9))
for label, color, marker, pts in series:
    x, y = zip(*pts)
    ax.plot(x, y, color=color, lw=2, marker=marker, ms=5, mec="white", mew=0.8, label=label)
ax.set_yscale("log")
ax.set_yticks([10, 20, 50, 100, 200, 500, 1000])
ax.set_yticklabels(["10", "20", "50", "100", "200", "500", "1000"])
ax.set_ylim(8, 1200)
ax.set_xlim(30, 420)
ax.axhline(500, color=INK_2, lw=0.8, ls=(0, (4, 3)))
ax.text(415, 540, "p95 threshold, 500 ms", ha="right", va="bottom", color=INK_2, fontsize=7.5)
ax.set_xlabel("Target login rate (requests/s), plus 40 requests/s of page views")
ax.set_ylabel("POST /login p95 (ms, log scale)")
ax.legend(frameon=False, loc="center left", bbox_to_anchor=(0.0, 0.5))
save(fig, "load_threads")

# ---- Load testing: ramp to 400 logins/s, rate and p95 per 10 s window ----
t = list(range(0, 180, 10))
rate = [25.2, 69.7, 114.1, 158.5, 202.9, 247.4, 291.6, 319.2, 380.9, 387.3, 373.3, 393.2,
        328.5, 302.3, 230.0, 157.3, 107.0, 28.9]
p95 = [66.6, 15.2, 14.6, 11.7, 17.0, 20.9, 22.1, 254.2, 293.6, 259.6, 325.2, 149.8,
       334.7, 322.4, 27.5, 1119.1, 1024.8, 21.1]
mid = [x + 5 for x in t]
fig, (a1, a2) = plt.subplots(2, 1, figsize=(6.2, 3.6), sharex=True,
                             gridspec_kw={"height_ratios": [1, 1.25], "hspace": 0.18})
a1.plot(mid, rate, color=BLUE, lw=2, marker="o", ms=4, mec="white", mew=0.8)
a1.set_ylabel("Achieved logins/s")
a1.set_ylim(0, 450)
a2.plot(mid, p95, color=ORANGE, lw=2, marker="s", ms=4, mec="white", mew=0.8)
a2.set_yscale("log")
a2.set_yticks([10, 20, 50, 100, 200, 500, 1000])
a2.set_yticklabels(["10", "20", "50", "100", "200", "500", "1000"])
a2.set_ylim(8, 1600)
a2.set_ylabel("p95 (ms, log scale)")
a2.set_xlabel("Time since start (s)")
a2.set_xlim(0, 180)
for a in (a1, a2):
    a.axvline(75, color=INK_2, lw=0.8, ls=(0, (4, 3)))
a1.text(77, 30, "knee at about 320 logins/s", color=INK_2, fontsize=7.5)
a2.text(149, 1050, "backlog draining\nwhile load falls", color=INK_2, fontsize=7.5,
         ha="right", va="center")
save(fig, "load_ramp")

# ---- Docker: image size per variant (disk usage, MB) ----
tags = ["simple\nnode:26", "alpine\nnode:26-alpine", "multistage\nnginx:stable-alpine",
        "slim\nnginx:stable-alpine-slim"]
sizes = [1960, 429, 92.2, 21.4]
fig, ax = plt.subplots(figsize=(6.2, 2.2))
y = list(range(len(tags)))[::-1]
ax.barh(y, sizes, height=0.55, color=BLUE)
for yi, s in zip(y, sizes):
    label = f"{s / 1000:.2f} GB" if s >= 1000 else f"{s:g} MB"
    ax.text(s + 25, yi, label, va="center", color=INK, fontsize=8)
ax.set_yticks(y)
ax.set_yticklabels(tags, fontsize=8)
ax.set_xlim(0, 2250)
ax.set_xlabel("Image size on disk (MB)")
ax.grid(axis="y", visible=False)
ax.tick_params(axis="y", length=0)
save(fig, "docker_sizes")
print("figures written to", OUT)
