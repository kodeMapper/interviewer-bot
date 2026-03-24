Systematic model-comparison report

Scoring design:
- Performance score = 0.45 test_f1 + 0.20 test_exact + 0.15 val_f1 + 0.10 precision + 0.10 recall (all min-max normalized)
- Efficiency score = 0.60 parameter efficiency + 0.20 epoch efficiency + 0.20 val-loss efficiency
- Composite score = 0.70 performance + 0.30 efficiency

Top model by composite score: H_384_192_96_48_7 ([192, 96, 48])
- Params: 97,447
- Best epoch: 33
- Test F1: 0.991361
- Test exact match: 0.965517

Decision-mode recommendations:
- Max quality: D_384_128_7 ([128])
- Best balance: H_384_192_96_48_7 ([192, 96, 48])
- Lightweight (near-top quality): D_384_128_7 ([128])

Convergence plots note:
- 09_cost_vs_iteration.png is an exact snapshot plot using (best_epoch, val_loss).
- 10_faster_descent_proxy.png is a proxy ranking, because per-epoch loss traces for each architecture are not stored in the ablation CSV.

Second-best model: B1_384_128_32_7 ([128, 32])
- Params: 53,639
- Test F1: 0.991361
- Test exact match: 0.965517