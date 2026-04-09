# Migration Notes

> Generated: 2026-02-08 | Branch: `integration/agent-2026-02-08T19-53-02`
> 2026-04 Update: Proctoring integration is now implemented in active flow.

This document tracks architectural decisions, file movements, and planned future removals.

---

## 1. Current State Summary

The repository has been migrated from a Python CLI interview bot to a MERN stack web application. The migration preserved original Python ML/DL code by wrapping it in a FastAPI microservice. The current layout is functional but needs cleanup.

### Architecture (post-migration):
```
Browser (React) ──WebSocket/REST──▶ Express.js ──REST──▶ FastAPI ──import──▶ backend/ (Python ML)
                                      │
                                      └──▶ MongoDB
                                      └──▶ Gemini API
                                      └──▶ Proctoring FastAPI (via adapter)
```

---

## 2. Structural Decisions

### 2.1 Why NOT move `client/` and `server/` into `adaptive-questioning/`

After analysis, moving `client/` and `server/` would break:
- Root `package.json` scripts that reference `cd server`, `cd client`
- `server/.env` → `ML_SERVICE_URL` relative path assumptions
- `client/.env` → `VITE_API_URL`
- `ml-service/main.py` → `sys.path` insert for `../backend`

**Decision:** Keep `client/`, `server/`, `ml-service/` at root level. Create `docs/` and `scripts/` for organization. The "desired layout" from the prompt is documented as a future target but NOT enacted to avoid breaking running services.

### 2.2 Proctoring runs in `proctoring_fastapi/`

The proctoring system runs as a FastAPI service with its own frontend (`index.html` + `style.css`) on port 5000. It is integrated with the MERN app through the Express adapter (`server/src/adapters/proctoringAdapter.js`).

### 2.3 `backend/` is a library, not a service

`backend/` is NOT run directly anymore. It exists solely as a Python package imported by `ml-service/main.py`. The original `backend/core/interview_controller.py` (CLI entrypoint) is legacy code.

### 2.4 `frontend/` is deprecated

The `frontend/` directory contains the old vanilla HTML/JS/CSS interface from before the MERN migration. It has been fully replaced by `client/` (React SPA).

---

## 3. Dependency Isolation

### 3.1 NumPy Version Conflict

**Problem:** The root `venv/` has numpy version conflicts:
- `openai-whisper` needs `numba` which needs `numpy < 2.0`
- `scikit-learn 1.8.0` was compiled against numpy 2.x ABI
- `pandas 2.2.1` needs `numpy < 2`
- `torch 2.2.2` was compiled against numpy 1.x ABI

**Resolution:** The `ml-service/venv/` has its own isolated environment with compatible versions (`numpy 2.4.2`, `torch 2.10.0`, `sentence-transformers 5.2.2`). The root `venv/` should ONLY be used for legacy CLI tools (if needed) and should NOT be used for `ml-service/`.

**Action:** Documented in `RUN_GUIDE.md` that each service uses its own venv. Root `venv/` is for legacy use only.

### 3.2 Proctoring Dependencies

**Current:** `proctoring_fastapi/requirements.txt` is present and used for setup. Runtime stack is FastAPI + OpenCV + PyTorch (+ MediaPipe fallback logic in runtime path).

---

## 4. Adapter: Proctoring → Express (Implemented)

The MERN app controls proctoring during interviews through this adapter:

```
client/ ──▶ server/src/adapters/proctoringAdapter.js ──▶ FastAPI (localhost:5000)
```

**Adapter endpoints (current):**
- `POST /api/proctoring/start` → forwards to FastAPI `/start`
- `POST /api/proctoring/stop` → forwards to FastAPI `/stop`
- `GET /api/proctoring/status` → forwards to FastAPI `/status`

Additional current routes:
- `POST /api/proctoring/process_frame`
- `POST /api/proctoring/session/meta`
- `GET /api/proctoring/report`
- `GET /api/proctoring/download/{csv|video|package}`

**Status:** Implemented and used in report flow.

---

## 5. Files Marked for Future Removal

These files are **NOT deleted** in this pass. Each requires human approval.

| File/Folder | Reason for Removal | Prerequisite |
|-------------|-------------------|--------------|
| `frontend/` | Replaced by `client/` (React) | Confirm no one is using it |
| `backend/core/interview_controller.py` | Legacy CLI entrypoint, replaced by Express + Socket.io | Confirm no tests reference it |
| `backend/resume/gpt_client.py` | GPT replaced by Gemini in Node.js `resume.service.js` | Confirm no import chains depend on it |
| `backend/resume/question_generator.py` | Gemini question gen moved to Node.js | Confirm `ml-service/` doesn't import it |
| `root venv/` | Replaced by `ml-service/venv/` and `proctoring/venv/` (to be created) | Confirm legacy CLI bot is not needed |
| `MIGRATION_FLASK_TO_MERN.md` | One-time migration planning doc | After migration is complete |
| `mernMigration.md` | Migration notes | After migration is complete |
| `whyMERN.md` | Decision doc | After migration is complete |
| `temp-prompt.txt` | Agent instructions file | After this integration pass |
| `test_runner.py` + `tests/` | Legacy CLI test suite | After MERN tests are established |
| `.env` (root) | Contains deprecated GPT key | Ensure `server/.env` has all needed keys |

---

## 6. Files Moved (this pass)

No files were moved with `git mv` in this pass. Rationale:
- Current layout is functional and all services start correctly
- Moving files risks breaking `sys.path`, `require()`, and env references
- Creating `docs/` and `scripts/` is additive and non-destructive

---

## 7. Known Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Intro message cut-off | High | TTS-to-question timing. See `PROBLEMS_SOLUTION_PLAN.md` Problem 1 |
| Resume question enum mismatch | High | Gemini generates types not in Session schema enum. See Problem 2 |
| Low speech recognition accuracy | High | Web Speech API + Indian accent. See Problem 3 |
| TTS volume inconsistency | Medium | No audio normalization. See Problem 4 |
| Final vs avg score mismatch | Medium | See Problem 6 in `problemsAfterMigration.txt` |
| Proctoring integration hardening | Low | Integration is done; remaining work is auth hardening and load testing |
| Root venv conflicts | Low | NumPy binary incompatibility in root venv |
