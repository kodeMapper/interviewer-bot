# Run Commands (Windows CMD)

Use these commands in **Command Prompt (cmd)**.

## 1) Quick Run (FastAPI proctoring app)

```cmd
cd /d e:\delete\proctoring_fastapi
python -m pip install -r requirements.txt
python server.py
```

Open in browser:

- http://127.0.0.1:5000

---

## 2) Full Monorepo Run (Client + Server)

### Terminal 1 (Backend)

```cmd
cd /d e:\delete\proctoring_fastapi\server
npm install
npm run dev
```

### Terminal 2 (Frontend)

```cmd
cd /d e:\delete\proctoring_fastapi\client
npm install
npm run dev
```

Frontend URL (default Vite):

- http://localhost:3000

---

## Optional: Run from root with package scripts

```cmd
cd /d e:\delete\proctoring_fastapi
npm run dev:server
npm run dev:client
```

> Note: Run each `dev:*` command in a separate terminal window.
