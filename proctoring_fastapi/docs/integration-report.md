# Integration Report

**Branch:** `integration/agent-2026-02-08T19-53-02`  
**Base:** `main` @ `5e58626`  
**Date:** 2026-02-08  

> 2026-04 Update: This file keeps the historical integration snapshot, but proctoring is now FastAPI-based and integrated through the Express adapter in active flow.

---

## 1. Commits

| Hash | Message |
|------|---------|
| `e48b5ac` | `chore(integration): add docs, scripts, adapters, env examples` |

## 2. Files Created

| File | Purpose |
|------|---------|
| `docs/inventory.md` | Full service inventory — ports, entry-points, dependencies, duplicated functionality matrix |
| `docs/api-contracts.md` | REST + WebSocket + inter-service API shapes for every endpoint |
| `docs/migration-notes.md` | Architectural decisions, dependency isolation, planned removals, known issues |
| `docs/RUN_GUIDE.md` | Per-service setup instructions, env-var reference, troubleshooting guide |
| `scripts/smoke-check.ps1` | Automated health-check script — hits `/health` on all services, exits non-zero on failure |
| `server/src/adapters/proctoringAdapter.js` | HTTP proxy forwarding `/api/proctoring/*` to FastAPI service on port 5000 |
| `server/src/routes/proctoring.routes.js` | Express route file wiring the adapter into the app |
| `proctoring_fastapi/requirements.txt` | Pinned Python dependencies for the proctoring service |
| `server/.env.example` | Template for Express server environment variables |
| `client/.env.example` | Template for React client environment variables |
| `ml-service/.env.example` | Template for ML service environment variables |
| `proctoring env template (historical)` | Template entry from the original integration branch snapshot |

## 3. Files Modified

| File | Change |
|------|--------|
| `server/src/app.js` | Added `app.use('/api/proctoring', ...)` route registration |

## 4. Smoke-Test Results

All three main services started and passed health checks:

| Service | Port | Endpoint | Result |
|---------|------|----------|--------|
| ML Service (FastAPI) | 8000 | `GET /health` | `{"status":"ok","intent_predictor":true,"answer_evaluator":true}` |
| Express Server | 5001 | `GET /health` | `{"status":"ok", ...}` |
| Client (Vite) | 3000 | `GET /` | HTML served, title present |

**Proctoring** (port 5000) is now integrated in the end-to-end flow; webcam-dependent checks are still validated manually.

## 5. Known Issues

| # | Severity | Description | Mitigation |
|---|----------|-------------|------------|
| 1 | Medium | Root `requirements.txt` pins `numpy<2.0.0` but `ml-service/venv` has numpy 2.4.2. Each service must use its own venv. | Documented in `migration-notes.md`. Never activate the root venv for ml-service work. |
| 2 | Low | Root `venv/` has stale packages (torch 2.2.2) from the pre-MERN era. | Marked for removal once team confirms no legacy CLI usage. |
| 3 | Low | `frontend/` (vanilla HTML/JS) and `backend/resume/` duplicate functionality now in `client/` and `server/`. | Marked for future deletion in `migration-notes.md` §5. |
| 4 | Info | `.env.example` files created but actual `.env` files are gitignored — each dev must copy and fill secrets. | Documented in `RUN_GUIDE.md`. |

## 6. Architecture Summary

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  React+Vite │────▶│ Express+WS   │────▶│ FastAPI ML    │
│  :3000      │     │  :5001       │     │  :8000        │
└─────────────┘     └──────┬───────┘     └───────────────┘
                           │ /api/proctoring/*
                           ▼
                    ┌──────────────┐
                    │FastAPI Proctor│
                    │  :5000       │
                    └──────────────┘
```

## 7. Recommended Next Steps

1. **Review & merge** this branch into `main` after team approval.
2. **Delete legacy files** listed in `docs/migration-notes.md` §5 (requires human sign-off).
3. **Add CI pipeline** — use `scripts/smoke-check.ps1` as a post-deploy gate (or port to `smoke-check.sh` for Linux CI runners).
4. **Harden proctoring integration** — current UI already calls `/api/proctoring/*`; next focus is reliability/load testing and auth hardening.
5. **Pin ml-service deps** — run `pip freeze > ml-service/requirements-lock.txt` inside the ml-service venv for reproducible builds.
6. **Add authentication middleware** to the proctoring adapter routes before production use.
