"""Draws the performance chart in README.md from the figures in docs/performance.md.

    python3 scripts/readme-perf-chart.py

The numbers are typed in below (guest, median / slowest of the runs, in seconds); update them when that table changes.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

BUDGET = 3.0
rows = [  # label, median, slowest, note
    ("Before the work\n(click timing, 7 runs)", 6.48, 7.00),
    ("After, click timing\n(15 runs)", 2.87, 3.11),
    ("After, in-page timing\n(15 runs)", 1.89, 2.06),
]
INK, MUTED = "#1f2933", "#6b7280"
GREY_DARK, GREY_LIGHT = "#6b7280", "#c4c9d0"
TEAL_DARK, TEAL_LIGHT = "#0f766e", "#7cc4bb"

fig, ax = plt.subplots(figsize=(9, 4.2), dpi=200)
fig.patch.set_facecolor("white")
ax.set_facecolor("white")
height = 0.34
for i, (label, median, slowest) in enumerate(rows):
    y = len(rows) - 1 - i
    dark, light = (GREY_DARK, GREY_LIGHT) if i == 0 else (TEAL_DARK, TEAL_LIGHT)
    ax.barh(y + height / 2 + 0.02, median, height, color=dark)
    ax.barh(y - height / 2 - 0.02, slowest, height, color=light)
    # Labels sit inside the bars, so the budget line never runs through them.
    ax.text(median - 0.1, y + height / 2 + 0.02, f"{median:.2f} s  median", va="center", ha="right", fontsize=9.5, color="white", fontweight="bold")
    ax.text(slowest - 0.3, y - height / 2 - 0.02, f"{slowest:.2f} s  slowest", va="center", ha="right", fontsize=9.5, color=INK, fontweight="bold")
ax.axvline(BUDGET, color="#b45309", linestyle=(0, (4, 3)), linewidth=1.4)
ax.text(BUDGET, len(rows) - 0.46, "3 s budget", color="#b45309", fontsize=9.5, fontweight="bold", va="bottom", ha="center")
ax.set_yticks(range(len(rows)))
ax.set_yticklabels([r[0] for r in rows][::-1], fontsize=10, color=INK)
ax.set_xlim(0, 8.6)
ax.set_xlabel("Seconds until the first product card is on screen (guest, emulated Pixel 5 on mobile 4G)", fontsize=9, color=MUTED)
ax.tick_params(axis="x", colors=MUTED, labelsize=9)
ax.tick_params(axis="y", length=0)
for spine in ("top", "right", "left"):
    ax.spines[spine].set_visible(False)
ax.spines["bottom"].set_color("#d1d5db")
ax.xaxis.grid(True, color="#eef0f2", linewidth=0.8)
ax.set_axisbelow(True)
ax.set_title("Storefront: first product card, before and after the performance work", loc="left", fontsize=12, color=INK, fontweight="bold", pad=26)
fig.tight_layout()
fig.savefig(".github/assets/readme/perf-first-card.png", facecolor="white")
print("wrote .github/assets/readme/perf-first-card.png")
