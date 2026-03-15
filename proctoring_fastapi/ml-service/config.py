"""
ML Microservice Configuration

This config points to the ORIGINAL backend/ ML models.
The ml-service is just a FastAPI wrapper, NOT a reimplementation.
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Server
    PORT = int(os.getenv('PORT', 8000))
    HOST = os.getenv('HOST', '0.0.0.0')
    
    # Path to the ORIGINAL backend directory
    BACKEND_DIR = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
        "backend"
    )
    
    # ORIGINAL model path (backend/ml/models/saved/intent_model.pth)
    INTENT_MODEL_PATH = os.getenv(
        'INTENT_MODEL_PATH', 
        os.path.join(BACKEND_DIR, "ml", "models", "saved", "intent_model.pth")
    )
    
    # Embedding model (same as used in original code)
    EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')

config = Config()
