"""
Generate systematic model-comparison plots from temp architecture ablation results.

Outputs multiple PNGs and a ranked summary CSV so model selection is explainable
across quality, complexity, and training cost dimensions.
"""

from __future__ import annotations

import csv
import math
import os
from dataclasses import dataclass

import matplotlib.pyplot as plt
import numpy as np


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV = os.path.join(BASE_DIR, "temp_arch_ablation_results.csv")
OUT_DIR = os.path.join(BASE_DIR, "model_selection_report")
SUMMARY_CSV = os.path.join(OUT_DIR, "model_selection_summary.csv")


@dataclass
class Row:
    name: str
    hidden_dims: str
    params: int
    best_epoch: int
    val_loss: float
    val_f1: float
    test_exact_match: float
    test_precision: float
    test_recall: float
    test_f1: float


def load_rows(path: str) -> list[Row]:
    rows: list[Row] = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(
                Row(
                    name=r["name"],
                    hidden_dims=r["hidden_dims"],
                    params=int(r["params"]),
                    best_epoch=int(r["best_epoch"]),
                    val_loss=float(r["val_loss"]),
                    val_f1=float(r["val_f1"]),
                    test_exact_match=float(r["test_exact_match"]),
                    test_precision=float(r["test_precision"]),
                    test_recall=float(r["test_recall"]),
                    test_f1=float(r["test_f1"]),
                )
            )
    return rows


def minmax(values: np.ndarray, invert: bool = False) -> np.ndarray:
    vmin = float(values.min())
    vmax = float(values.max())
    if math.isclose(vmin, vmax):
        out = np.ones_like(values)
    else:
        out = (values - vmin) / (vmax - vmin)
    if invert:
        out = 1.0 - out
    return out


def compute_scores(rows: list[Row]) -> list[dict]:
    arr_params = np.array([r.params for r in rows], dtype=float)
    arr_epochs = np.array([r.best_epoch for r in rows], dtype=float)
    arr_vloss = np.array([r.val_loss for r in rows], dtype=float)
    arr_vf1 = np.array([r.val_f1 for r in rows], dtype=float)
    arr_exact = np.array([r.test_exact_match for r in rows], dtype=float)
    arr_prec = np.array([r.test_precision for r in rows], dtype=float)
    arr_rec = np.array([r.test_recall for r in rows], dtype=float)
    arr_f1 = np.array([r.test_f1 for r in rows], dtype=float)

    n_params = minmax(np.log10(arr_params), invert=True)
    n_epochs = minmax(arr_epochs, invert=True)
    n_vloss = minmax(arr_vloss, invert=True)

    n_vf1 = minmax(arr_vf1)
    n_exact = minmax(arr_exact)
    n_prec = minmax(arr_prec)
    n_rec = minmax(arr_rec)
    n_f1 = minmax(arr_f1)

    perf = (
        0.45 * n_f1
        + 0.20 * n_exact
        + 0.15 * n_vf1
        + 0.10 * n_prec
        + 0.10 * n_rec
    )
    efficiency = 0.60 * n_params + 0.20 * n_epochs + 0.20 * n_vloss
    composite = 0.70 * perf + 0.30 * efficiency

    out = []
    for idx, r in enumerate(rows):
        out.append(
            {
                "name": r.name,
                "hidden_dims": r.hidden_dims,
                "params": r.params,
                "best_epoch": r.best_epoch,
                "val_loss": r.val_loss,
                "val_f1": r.val_f1,
                "test_exact_match": r.test_exact_match,
                "test_precision": r.test_precision,
                "test_recall": r.test_recall,
                "test_f1": r.test_f1,
                "performance_score": float(perf[idx]),
                "efficiency_score": float(efficiency[idx]),
                "composite_score": float(composite[idx]),
            }
        )

    out.sort(key=lambda x: x["composite_score"], reverse=True)
    for rank, row in enumerate(out, start=1):
        row["composite_rank"] = rank
    return out


def save_summary_csv(summary: list[dict], path: str):
    fields = [
        "composite_rank",
        "name",
        "hidden_dims",
        "params",
        "best_epoch",
        "val_loss",
        "val_f1",
        "test_exact_match",
        "test_precision",
        "test_recall",
        "test_f1",
        "performance_score",
        "efficiency_score",
        "composite_score",
    ]
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in summary:
            writer.writerow(row)


def pareto_frontier(summary: list[dict]) -> list[dict]:
    frontier = []
    for candidate in summary:
        dominated = False
        for other in summary:
            if other["name"] == candidate["name"]:
                continue
            better_or_equal_f1 = other["test_f1"] >= candidate["test_f1"]
            lower_or_equal_params = other["params"] <= candidate["params"]
            strictly_better = (
                other["test_f1"] > candidate["test_f1"]
                or other["params"] < candidate["params"]
            )
            if better_or_equal_f1 and lower_or_equal_params and strictly_better:
                dominated = True
                break
        if not dominated:
            frontier.append(candidate)
    frontier.sort(key=lambda r: r["params"])
    return frontier


def shorten(name: str) -> str:
    return name.replace("_current", "")


def plot_rank_by_test_f1(summary: list[dict]):
    ordered = sorted(summary, key=lambda r: (r["test_f1"], r["test_exact_match"]), reverse=True)
    labels = [shorten(r["name"]) for r in ordered]
    scores = [r["test_f1"] for r in ordered]

    fig, ax = plt.subplots(figsize=(12, 8))
    y = np.arange(len(labels))
    bars = ax.barh(y, scores, color="#1f77b4", alpha=0.9)
    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=9)
    ax.invert_yaxis()
    ax.set_xlabel("Test F1")
    ax.set_title("01. Architecture Ranking by Test F1")
    ax.grid(axis="x", alpha=0.3)

    for bar, r in zip(bars, ordered):
        ax.text(
            bar.get_width() + 0.0003,
            bar.get_y() + bar.get_height() / 2,
            f"p={r['params']:,} e={r['best_epoch']}",
            va="center",
            fontsize=8,
        )

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "01_rank_by_test_f1.png"), dpi=180)
    plt.close(fig)


def plot_params_vs_f1(summary: list[dict]):
    x = np.array([r["params"] for r in summary], dtype=float)
    y = np.array([r["test_f1"] for r in summary], dtype=float)
    c = np.array([r["test_exact_match"] for r in summary], dtype=float)
    s = np.array([r["best_epoch"] for r in summary], dtype=float)

    fig, ax = plt.subplots(figsize=(10.5, 7))
    scatter = ax.scatter(x, y, c=c, s=25 + s * 5, cmap="viridis", alpha=0.85, edgecolor="black", linewidth=0.3)
    ax.set_xscale("log")
    ax.set_xlabel("Trainable Parameters (log scale)")
    ax.set_ylabel("Test F1")
    ax.set_title("02. Test F1 vs Parameters (color=Exact Match, size=Best Epoch)")
    ax.grid(alpha=0.3)

    top_names = {summary[i]["name"] for i in range(min(5, len(summary)))}
    for r in summary:
        if r["name"] in top_names:
            ax.annotate(shorten(r["name"]), (r["params"], r["test_f1"]), textcoords="offset points", xytext=(5, 5), fontsize=8)

    cb = fig.colorbar(scatter, ax=ax)
    cb.set_label("Test Exact Match")

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "02_params_vs_f1_bubble.png"), dpi=180)
    plt.close(fig)


def plot_pareto(summary: list[dict]):
    frontier = pareto_frontier(summary)

    fig, ax = plt.subplots(figsize=(10.5, 7))
    x_all = np.array([r["params"] for r in summary], dtype=float)
    y_all = np.array([r["test_f1"] for r in summary], dtype=float)
    ax.scatter(x_all, y_all, color="#b0b0b0", alpha=0.7, label="All models")

    x_front = np.array([r["params"] for r in frontier], dtype=float)
    y_front = np.array([r["test_f1"] for r in frontier], dtype=float)
    ax.plot(x_front, y_front, color="#d62728", marker="o", linewidth=2.0, label="Pareto frontier")

    for r in frontier:
        ax.annotate(shorten(r["name"]), (r["params"], r["test_f1"]), textcoords="offset points", xytext=(4, 5), fontsize=8)

    ax.set_xscale("log")
    ax.set_xlabel("Trainable Parameters (log scale)")
    ax.set_ylabel("Test F1")
    ax.set_title("03. Pareto Frontier: Quality vs Model Size")
    ax.grid(alpha=0.3)
    ax.legend()

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "03_pareto_quality_vs_size.png"), dpi=180)
    plt.close(fig)


def plot_metric_heatmap(summary: list[dict]):
    top = summary[:10]
    labels = [shorten(r["name"]) for r in top]
    metric_names = ["test_f1", "test_exact_match", "val_f1", "test_precision", "test_recall", "params", "best_epoch"]
    matrix = np.array([[r[m] for m in metric_names] for r in top], dtype=float)

    # Normalize each column for visual comparability.
    norm = np.zeros_like(matrix)
    for i, m in enumerate(metric_names):
        invert = m in {"params", "best_epoch"}
        norm[:, i] = minmax(matrix[:, i], invert=invert)

    fig, ax = plt.subplots(figsize=(11, 6.8))
    im = ax.imshow(norm, cmap="YlGnBu", aspect="auto")
    ax.set_xticks(np.arange(len(metric_names)))
    ax.set_xticklabels(metric_names, rotation=25, ha="right")
    ax.set_yticks(np.arange(len(labels)))
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_title("04. Top-10 Models Heatmap (normalized, lower is better for params/epochs)")

    for i in range(norm.shape[0]):
        for j in range(norm.shape[1]):
            ax.text(j, i, f"{matrix[i, j]:.4f}" if j < 5 else f"{int(matrix[i, j])}", ha="center", va="center", fontsize=7, color="black")

    fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02, label="Normalized score")
    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "04_top10_metric_heatmap.png"), dpi=180)
    plt.close(fig)


def plot_epochs_vs_quality(summary: list[dict]):
    fig, ax = plt.subplots(figsize=(10.5, 7))
    x = np.array([r["best_epoch"] for r in summary], dtype=float)
    y = np.array([r["test_f1"] for r in summary], dtype=float)
    s = np.array([r["params"] for r in summary], dtype=float)

    ax.scatter(x, y, s=(s / s.max()) * 700 + 40, c="#ff7f0e", alpha=0.65, edgecolor="black", linewidth=0.3)
    ax.set_xlabel("Best Epoch (proxy for training cost)")
    ax.set_ylabel("Test F1")
    ax.set_title("05. Training Cost vs Quality (bubble size = parameters)")
    ax.grid(alpha=0.3)

    best = max(summary, key=lambda r: r["composite_score"])
    ax.annotate(
        f"Best composite: {shorten(best['name'])}",
        (best["best_epoch"], best["test_f1"]),
        textcoords="offset points",
        xytext=(8, 8),
        fontsize=9,
        fontweight="bold",
    )

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "05_training_cost_vs_quality.png"), dpi=180)
    plt.close(fig)


def plot_composite_ranking(summary: list[dict]):
    top = summary[:12]
    labels = [shorten(r["name"]) for r in top][::-1]
    comp = [r["composite_score"] for r in top][::-1]
    perf = [r["performance_score"] for r in top][::-1]
    eff = [r["efficiency_score"] for r in top][::-1]

    fig, ax = plt.subplots(figsize=(12, 8))
    y = np.arange(len(labels))
    ax.barh(y, comp, color="#2ca02c", alpha=0.7, label="Composite")
    ax.plot(perf, y, "o", color="#1f77b4", label="Performance subscore")
    ax.plot(eff, y, "s", color="#d62728", label="Efficiency subscore")

    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_xlabel("Score (0-1 normalized)")
    ax.set_title("06. Composite Model Selection Ranking")
    ax.grid(axis="x", alpha=0.3)
    ax.legend(loc="lower right")

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "06_composite_ranking.png"), dpi=180)
    plt.close(fig)


def select_recommendations(summary: list[dict]) -> dict:
    by_quality = sorted(
        summary,
        key=lambda r: (r["test_f1"], r["test_exact_match"], -r["params"]),
        reverse=True,
    )[0]

    by_balance = max(summary, key=lambda r: r["composite_score"])

    max_f1 = max(r["test_f1"] for r in summary)
    candidates = [r for r in summary if r["test_f1"] >= max_f1 - 0.004]
    by_lightweight = min(candidates, key=lambda r: r["params"]) if candidates else min(summary, key=lambda r: r["params"])

    return {
        "max_quality": by_quality,
        "best_balance": by_balance,
        "lightweight": by_lightweight,
    }


def plot_decision_modes(summary: list[dict]):
    picks = select_recommendations(summary)
    modes = ["Max Quality", "Best Balance", "Lightweight"]
    rows = [picks["max_quality"], picks["best_balance"], picks["lightweight"]]

    labels = [shorten(r["name"]) for r in rows]
    f1_vals = [r["test_f1"] for r in rows]
    params = [r["params"] for r in rows]
    epochs = [r["best_epoch"] for r in rows]

    fig, axes = plt.subplots(1, 2, figsize=(13.5, 5.5))

    # Left: quality bars
    ax = axes[0]
    x = np.arange(len(modes))
    bars = ax.bar(x, f1_vals, color=["#1f77b4", "#2ca02c", "#ff7f0e"], alpha=0.85)
    ax.set_xticks(x)
    ax.set_xticklabels(modes)
    ax.set_ylabel("Test F1")
    ax.set_ylim(min(f1_vals) - 0.01, max(f1_vals) + 0.003)
    ax.set_title("07A. Policy Picks - Quality")
    ax.grid(axis="y", alpha=0.3)

    for i, bar in enumerate(bars):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.0002,
            f"{labels[i]}\n{f1_vals[i]:.4f}",
            ha="center",
            va="bottom",
            fontsize=8,
        )

    # Right: params and epochs as annotated table-like panel
    ax2 = axes[1]
    ax2.axis("off")
    cell_text = []
    for mode, row, p, e in zip(modes, rows, params, epochs):
        cell_text.append([mode, shorten(row["name"]), f"{p:,}", str(e), f"{row['test_exact_match']:.4f}"])

    table = ax2.table(
        cellText=cell_text,
        colLabels=["Mode", "Chosen Model", "Params", "Best Epoch", "Exact Match"],
        loc="center",
        cellLoc="center",
        colLoc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.2, 1.6)
    ax2.set_title("07B. Policy Picks - Complexity/Training", pad=16)

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "07_policy_based_recommendation.png"), dpi=180)
    plt.close(fig)


def plot_recommendation_matrix(summary: list[dict]):
    picks = select_recommendations(summary)
    matrix_rows = [
        ("Max quality", picks["max_quality"]),
        ("Best balance", picks["best_balance"]),
        ("Lightweight", picks["lightweight"]),
    ]

    fig, ax = plt.subplots(figsize=(11.5, 4.8))
    ax.axis("off")

    cell_text = []
    for mode, row in matrix_rows:
        cell_text.append([
            mode,
            shorten(row["name"]),
            row["hidden_dims"],
            f"{row['test_f1']:.4f}",
            f"{row['test_exact_match']:.4f}",
            f"{row['params']:,}",
            str(row["best_epoch"]),
            f"{row['composite_score']:.4f}",
        ])

    table = ax.table(
        cellText=cell_text,
        colLabels=[
            "Decision Mode",
            "Model",
            "Hidden Dims",
            "Test F1",
            "Exact",
            "Params",
            "Epoch",
            "Composite",
        ],
        loc="center",
        cellLoc="center",
        colLoc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.15, 1.65)
    ax.set_title("08. Final Recommendation Matrix")

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "08_final_recommendation_matrix.png"), dpi=180)
    plt.close(fig)


def plot_cost_vs_iteration(summary: list[dict]):
    # Here, "cost" is validation BCE loss at the selected best epoch.
    x = np.array([r["best_epoch"] for r in summary], dtype=float)
    y = np.array([r["val_loss"] for r in summary], dtype=float)
    c = np.array([r["test_f1"] for r in summary], dtype=float)
    s = np.array([r["params"] for r in summary], dtype=float)

    fig, ax = plt.subplots(figsize=(10.8, 7.0))
    scatter = ax.scatter(
        x,
        y,
        c=c,
        s=(s / s.max()) * 700 + 50,
        cmap="plasma",
        alpha=0.8,
        edgecolor="black",
        linewidth=0.35,
    )

    for r in summary[:6]:
        ax.annotate(
            shorten(r["name"]),
            (r["best_epoch"], r["val_loss"]),
            textcoords="offset points",
            xytext=(5, 5),
            fontsize=8,
        )

    ax.set_xlabel("Iteration proxy: Best Epoch")
    ax.set_ylabel("Cost: Validation BCE Loss")
    ax.set_title("09. Cost vs Iteration (color=Test F1, bubble size=Params)")
    ax.grid(alpha=0.3)
    cb = fig.colorbar(scatter, ax=ax)
    cb.set_label("Test F1")

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "09_cost_vs_iteration.png"), dpi=180)
    plt.close(fig)


def plot_faster_descent_proxy(summary: list[dict]):
    # Faster descent proxy based on how low val loss is achieved in fewer epochs.
    # Proxy score = 1 / (val_loss * best_epoch); higher is better.
    rows = []
    for r in summary:
        proxy = 1.0 / (max(1e-12, r["val_loss"]) * max(1, r["best_epoch"]))
        rows.append((r, proxy))

    rows.sort(key=lambda t: t[1], reverse=True)
    top = rows[:12]

    labels = [shorten(t[0]["name"]) for t in top][::-1]
    scores = [t[1] for t in top][::-1]

    fig, ax = plt.subplots(figsize=(12.0, 8.0))
    bars = ax.barh(np.arange(len(labels)), scores, color="#17becf", alpha=0.85)
    ax.set_yticks(np.arange(len(labels)))
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_xlabel("Faster-descent proxy (higher is better)")
    ax.set_title("10. Faster Descent Proxy Ranking")
    ax.grid(axis="x", alpha=0.3)

    for i, (bar, tup) in enumerate(zip(bars, top[::-1])):
        row = tup[0]
        ax.text(
            bar.get_width() + max(scores) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            f"val_loss={row['val_loss']:.4f}, epoch={row['best_epoch']}, p={row['params']:,}",
            va="center",
            fontsize=8,
        )

    plt.tight_layout()
    plt.savefig(os.path.join(OUT_DIR, "10_faster_descent_proxy.png"), dpi=180)
    plt.close(fig)


def write_report(summary: list[dict]):
    picks = select_recommendations(summary)
    best = summary[0]
    second = summary[1] if len(summary) > 1 else None
    lines = [
        "Systematic model-comparison report",
        "",
        "Scoring design:",
        "- Performance score = 0.45 test_f1 + 0.20 test_exact + 0.15 val_f1 + 0.10 precision + 0.10 recall (all min-max normalized)",
        "- Efficiency score = 0.60 parameter efficiency + 0.20 epoch efficiency + 0.20 val-loss efficiency",
        "- Composite score = 0.70 performance + 0.30 efficiency",
        "",
        f"Top model by composite score: {best['name']} ({best['hidden_dims']})",
        f"- Params: {best['params']:,}",
        f"- Best epoch: {best['best_epoch']}",
        f"- Test F1: {best['test_f1']:.6f}",
        f"- Test exact match: {best['test_exact_match']:.6f}",
        "",
        "Decision-mode recommendations:",
        f"- Max quality: {picks['max_quality']['name']} ({picks['max_quality']['hidden_dims']})",
        f"- Best balance: {picks['best_balance']['name']} ({picks['best_balance']['hidden_dims']})",
        f"- Lightweight (near-top quality): {picks['lightweight']['name']} ({picks['lightweight']['hidden_dims']})",
        "",
        "Convergence plots note:",
        "- 09_cost_vs_iteration.png is an exact snapshot plot using (best_epoch, val_loss).",
        "- 10_faster_descent_proxy.png is a proxy ranking, because per-epoch loss traces for each architecture are not stored in the ablation CSV.",
    ]
    if second is not None:
        lines.extend([
            "",
            f"Second-best model: {second['name']} ({second['hidden_dims']})",
            f"- Params: {second['params']:,}",
            f"- Test F1: {second['test_f1']:.6f}",
            f"- Test exact match: {second['test_exact_match']:.6f}",
        ])

    with open(os.path.join(OUT_DIR, "README_model_selection.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    rows = load_rows(INPUT_CSV)
    if not rows:
        raise RuntimeError("No rows found in input CSV")

    summary = compute_scores(rows)
    save_summary_csv(summary, SUMMARY_CSV)

    plot_rank_by_test_f1(summary)
    plot_params_vs_f1(summary)
    plot_pareto(summary)
    plot_metric_heatmap(summary)
    plot_epochs_vs_quality(summary)
    plot_composite_ranking(summary)
    plot_decision_modes(summary)
    plot_recommendation_matrix(summary)
    plot_cost_vs_iteration(summary)
    plot_faster_descent_proxy(summary)
    write_report(summary)

    print("Generated model-comparison artifacts:")
    print(f"- Output directory: {OUT_DIR}")
    print(f"- Summary CSV: {SUMMARY_CSV}")


if __name__ == "__main__":
    main()
