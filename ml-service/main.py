"""
ML Microservice - FastAPI Server
Provides ML inference endpoints for the Node.js backend

IMPORTANT: This service wraps the ORIGINAL Python ML code from backend/
It does NOT reimplement the deep learning logic - it uses the existing:
  - backend/ml/models/intent_classifier.py (IntentClassifier)
  - backend/ml/training/intent_predictor.py (IntentPredictor)
  - backend/core/answer_evaluator.py (AnswerEvaluator)
"""

import os
import sys
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add the backend directory to Python path to import original modules
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, BACKEND_DIR)

# Import the ORIGINAL implementations
from ml.training.intent_predictor import IntentPredictor
from core.answer_evaluator import AnswerEvaluator

from config import config


# Global instances of the ORIGINAL classes
intent_predictor: Optional[IntentPredictor] = None
answer_evaluator: Optional[AnswerEvaluator] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup using the ORIGINAL Python classes"""
    global intent_predictor, answer_evaluator
    
    print("🔄 Loading ML models using ORIGINAL Python implementations...")
    print(f"   Backend directory: {BACKEND_DIR}")
    
    # Load Intent Predictor (uses original IntentClassifier + SentenceTransformer)
    try:
        intent_predictor = IntentPredictor()
        print("✅ Loaded IntentPredictor (original implementation)")
    except Exception as e:
        print(f"⚠️ Could not load IntentPredictor: {e}")
        intent_predictor = None
    
    # Load Answer Evaluator (original SentenceTransformer-based evaluation)
    try:
        answer_evaluator = AnswerEvaluator()
        print("✅ Loaded AnswerEvaluator (original implementation)")
    except Exception as e:
        print(f"⚠️ Could not load AnswerEvaluator: {e}")
        answer_evaluator = None
    
    print("🚀 ML Service ready!")
    
    yield
    
    # Cleanup
    print("👋 ML Service shutting down")


OPENAPI_TAGS = [
    {
        "name": "System",
        "description": "Service health and model readiness checks.",
    },
    {
        "name": "Answer Evaluation",
        "description": "Semantic answer scoring against an expected answer.",
    },
    {
        "name": "Intent Detection",
        "description": "Topic prediction and ranked intent scoring for interview text.",
    },
    {
        "name": "Diagnostics",
        "description": "Model metadata and runtime inspection.",
    },
]


# Create FastAPI app
app = FastAPI(
    title="SkillWise — ML Service",
    description=(
        "SkillWise ML inference service — wraps the original PyTorch intent classifier and\n"
        "SentenceTransformer answer evaluator.\n\n"
        "Use this Swagger UI to test answer scoring, topic prediction, model health, and runtime diagnostics."
    ),
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
    swagger_ui_parameters={
        "displayRequestDuration": True,
        "docExpansion": "list",
        "defaultModelsExpandDepth": 2,
        "filter": True,
        "tryItOutEnabled": True,
    },
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Request/Response Models ====================

class EvaluateRequest(BaseModel):
    user_answer: str = Field(..., description="Candidate answer text")
    expected_answer: str = Field(..., description="Reference answer text")
    keywords: List[str] = Field(default_factory=list, description="Optional supporting keywords")


class EvaluateResponse(BaseModel):
    score: int
    is_correct: bool


class IntentRequest(BaseModel):
    text: str = Field(..., description="Source text to classify")
    threshold: float = Field(default=0.5, description="Minimum confidence threshold")


class IntentResponse(BaseModel):
    topics: List[str]
    scores: dict
    top_topics: List[str]


class PredictWithScoresResponse(BaseModel):
    predictions: List[dict]
    top_topics: List[str]


class HealthResponse(BaseModel):
    status: str
    intent_predictor: bool
    answer_evaluator: bool


# ==================== Endpoints ====================

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Check ML service health",
)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="ok",
        intent_predictor=intent_predictor is not None,
        answer_evaluator=answer_evaluator is not None
    )


@app.post(
    "/evaluate",
    response_model=EvaluateResponse,
    tags=["Answer Evaluation"],
    summary="Evaluate a candidate answer",
)
async def evaluate_answer(request: EvaluateRequest):
    """
    Evaluate user answer against expected answer.
    Uses the ORIGINAL AnswerEvaluator from backend/core/answer_evaluator.py
    """
    if answer_evaluator is None:
        raise HTTPException(
            status_code=503, 
            detail="AnswerEvaluator not available"
        )
    
    try:
        # Call the ORIGINAL evaluate method
        score, is_correct = answer_evaluator.evaluate(
            request.user_answer, 
            request.expected_answer
        )
        
        return EvaluateResponse(
            score=score,
            is_correct=is_correct
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {str(e)}")


@app.post(
    "/predict-intent",
    response_model=IntentResponse,
    tags=["Intent Detection"],
    summary="Predict interview topics from text",
)
async def predict_intent(request: IntentRequest):
    """
    Predict which topics the text relates to.
    Uses the ORIGINAL IntentPredictor from backend/ml/training/intent_predictor.py
    """
    if intent_predictor is None:
        raise HTTPException(
            status_code=503, 
            detail="IntentPredictor not available"
        )
    
    try:
        # Use ORIGINAL predict method
        topics = intent_predictor.predict(request.text, request.threshold)
        
        # Use ORIGINAL predict_proba method
        scores = intent_predictor.predict_proba(request.text)
        
        # Get top 3 topics
        top_topics = [t[0] for t in intent_predictor.get_top_k(request.text, k=3)]
        
        return IntentResponse(
            topics=topics,
            scores=scores,
            top_topics=top_topics
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@app.post(
    "/predict",
    response_model=PredictWithScoresResponse,
    tags=["Intent Detection"],
    summary="Return ranked topic predictions with scores",
)
async def predict_with_scores(request: IntentRequest):
    """
    Predict topics with confidence scores.
    Uses the ORIGINAL IntentPredictor.predict_with_scores method
    """
    if intent_predictor is None:
        raise HTTPException(
            status_code=503, 
            detail="IntentPredictor not available"
        )
    
    try:
        # Use ORIGINAL predict_with_scores method
        predictions = intent_predictor.predict_with_scores(request.text, request.threshold)
        
        return {
            "predictions": [{"topic": p[0], "score": p[1]} for p in predictions],
            "top_topics": [p[0] for p in predictions[:3]]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@app.get(
    "/model-info",
    tags=["Diagnostics"],
    summary="Inspect loaded model metadata",
)
async def model_info():
    """Get information about the loaded models"""
    info = {
        "intent_predictor": None,
        "answer_evaluator": None
    }
    
    if intent_predictor is not None:
        info["intent_predictor"] = {
            "labels": intent_predictor.label_names,
            "device": str(intent_predictor.device),
            "model_type": "IntentClassifier (MLP 384->128->64->7)"
        }
    
    if answer_evaluator is not None:
        info["answer_evaluator"] = {
            "model": "all-MiniLM-L6-v2",
            "method": "Cosine Similarity"
        }
    
    return info


# Run the server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True
    )
