# Unified SkillWise Deployment Container (Hugging Face / General Linux)
# Uses Python base image, installs Node.js, and runs all 3 microservices.

FROM python:3.10-slim

# Install system dependencies (Node.js, ffmpeg for video/audio, and OpenCV deps)
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Setup working directory
WORKDIR /app

# Copy application files (ignoring node_modules and venv via .dockerignore)
COPY . /app/

# Install Python ML Service Dependencies
RUN pip install --no-cache-dir -r ml-service/requirements.txt || true

# Install Python Proctoring Dependencies
RUN pip install --no-cache-dir -r proctoring_fastapi/requirements.txt || true

# Install Node.js Express Dependencies
WORKDIR /app/server
RUN npm install

# Revert back to root to configure the execution
WORKDIR /app

# Hugging face passes port 7860. The express server should bind to this port.
ENV PORT=7860
ENV CLIENT_URL="https://your-vercel-domain.vercel.app"
ENV PROCTOR_URL="http://127.0.0.1:5000"
ENV ML_SERVICE_URL="http://127.0.0.1:8000"

# Make the start script executable
RUN chmod +x /app/start.sh

# Start all processes
CMD ["/app/start.sh"]
