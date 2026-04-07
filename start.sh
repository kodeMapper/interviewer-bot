#!/bin/bash
# SkillWise Unified Startup Script for Hugging Face Spaces

echo "Starting ML Service (Port 8000)..."
cd /app/ml-service
uvicorn main:app --host 127.0.0.1 --port 8000 > /app/ml-service.log 2>&1 &
ML_PID=$!

echo "Starting Proctoring Service (Port 5000)..."
cd /app/proctoring_fastapi
python server.py > /app/proctoring.log 2>&1 &
PROC_PID=$!

echo "Waiting for Python dependencies to initialize (5 seconds)..."
sleep 5

echo "Starting Express Gateway (Port 7860)..."
cd /app/server
node server.js &
EXPRESS_PID=$!

# Wait for all background processes to keep the container alive
echo "All systems running!"
wait $EXPRESS_PID $PROC_PID $ML_PID
