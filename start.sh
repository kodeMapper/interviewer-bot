#!/bin/bash
# SkillWise Unified Startup Script for Hugging Face Spaces

# Define internal networking
export PORT=${PORT:-7860}
export PROCTOR_URL="http://127.0.0.1:5000"
export ML_SERVICE_URL="http://127.0.0.1:8000"
export INTERVIEW_API_URL="http://127.0.0.1:${PORT}"

echo "Starting ML Service (Port 8000)..."
cd /app/ml-service
uvicorn main:app --host 0.0.0.0 --port 8000 > /app/ml-service.log 2>&1 &
ML_PID=$!

echo "Starting Proctoring Service (Port 5000)..."
cd /app/proctoring_fastapi
python server.py > /app/proctoring.log 2>&1 &
PROC_PID=$!

echo "Waiting for Python dependencies to initialize (5 seconds)..."
sleep 5

echo "Starting Express Gateway (Port ${PORT})..."
cd /app/server
node server.js &
EXPRESS_PID=$!

# Wait for all background processes to keep the container alive
echo "SkillWise AI is live!"
wait $EXPRESS_PID $PROC_PID $ML_PID
