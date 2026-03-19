# Interviewer Bot - Run Guide (Windows)

This repository contains multiple services. Start each service in a separate terminal.

## Services and Ports

- Frontend (React + Vite): http://localhost:3000
- Backend (Express + Socket.io): http://localhost:5001
- ML Service (FastAPI): http://localhost:8000
- Proctoring FastAPI (optional): http://127.0.0.1:5000

## First-Time Setup

### 1) Root Python environment (CLI interviewer)

```powershell
cd C:\Users\acer\Desktop\DL Project
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### 2) ML service environment

```powershell
cd C:\Users\acer\Desktop\DL Project\ml-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### 3) Backend and frontend dependencies

```powershell
cd C:\Users\acer\Desktop\DL Project\server
npm install

cd C:\Users\acer\Desktop\DL Project\client
npm install
```

### 4) Proctoring dependencies (optional)

```powershell
cd C:\Users\acer\Desktop\DL Project\proctoring_fastapi
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

## Start Commands

### Terminal A: ML service

```powershell
cd C:\Users\acer\Desktop\DL Project\ml-service
.\venv\Scripts\Activate.ps1
uvicorn main:app --host 127.0.0.1 --port 8000
```

### Terminal B: Backend

```powershell
cd C:\Users\acer\Desktop\DL Project\server
npm run dev
```

### Terminal C: Frontend

```powershell
cd C:\Users\acer\Desktop\DL Project\client
npm run dev
```

### Terminal D: Proctoring (optional)

```powershell
cd C:\Users\acer\Desktop\DL Project\proctoring_fastapi
.\venv\Scripts\Activate.ps1
python server.py
```

## Health Checks

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/health | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5001/health | Select-Object -ExpandProperty Content
Invoke-WebRequest -UseBasicParsing http://localhost:3000 | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/status | Select-Object -ExpandProperty Content
```

## Port Conflict Fixes

### Free backend port 5001

```powershell
Get-NetTCPConnection -LocalPort 5001 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Free ML port 8000

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Free frontend port 3000

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Environment Variables

Use these values at minimum:

- server/.env:
  - PORT=5001
  - MONGODB_URI=<your-mongodb-uri>
  - ML_SERVICE_URL=http://localhost:8000
  - CLIENT_URL=http://localhost:3000
  - GEMINI_API_KEY=<your-key>

- client/.env:
  - VITE_API_URL=http://localhost:5001

## Notes

- Run uvicorn from inside ml-service so backend imports resolve correctly.
- The original Python ML logic remains in backend/ and is loaded by ml-service.
- Proctoring is separate and optional during MERN interview flow.
