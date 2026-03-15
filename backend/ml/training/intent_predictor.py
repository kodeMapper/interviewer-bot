"""
Intent Predictor Module
Loads trained model and provides inference API
"""

import os
import sys
import torch
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Tuple

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.intent_classifier import IntentClassifier

# ==================== CONFIG ====================
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models", "saved")
MODEL_PATH = os.path.join(MODELS_DIR, "intent_model.pth")
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


class IntentPredictor:
    """
    Inference wrapper for the Intent Classifier.
    Handles text embedding and topic prediction.
    """
    
    def __init__(self, model_path: str = MODEL_PATH, device: str = None):
        """
        Initialize the predictor with a trained model.
        
        Args:
            model_path: Path to saved model checkpoint
            device: 'cuda' or 'cpu' (auto-detected if None)
        """
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load model checkpoint
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at {model_path}. Please train first.")
        
        checkpoint = torch.load(model_path, map_location=self.device)
        
        # Extract config
        config = checkpoint.get("config", {})
        self.label_names = checkpoint.get("label_names", [])
        
        # Initialize model
        self.model = IntentClassifier(
            input_dim=config.get("input_dim", 384),
            hidden_dim_1=config.get("hidden_dim_1", 128),
            hidden_dim_2=config.get("hidden_dim_2", 64),
            output_dim=config.get("output_dim", 7),
            dropout_rate=config.get("dropout_rate", 0.3)
        )
        
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()
        
        # Load embedding model
        print(f"[PREDICTOR] Loading embedding model: {EMBEDDING_MODEL_NAME}")
        self.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        
        print(f"[PREDICTOR] Model loaded successfully on {self.device}")
        print(f"[PREDICTOR] Labels: {self.label_names}")
    
    def encode_text(self, text: str) -> torch.Tensor:
        """Convert text to embedding vector"""
        embedding = self.embedding_model.encode([text])
        return torch.tensor(embedding, dtype=torch.float32).to(self.device)
    
    def predict_proba(self, text: str) -> Dict[str, float]:
        """
        Get probability scores for each topic.
        
        Returns:
            Dictionary mapping topic names to probabilities
        """
        embedding = self.encode_text(text)
        
        with torch.no_grad():
            logits = self.model(embedding)
            probs = torch.sigmoid(logits).squeeze().cpu().numpy()
        
        return {label: float(prob) for label, prob in zip(self.label_names, probs)}
    
    def predict(self, text: str, threshold: float = 0.5) -> List[str]:
        """
        Predict topic labels for input text.
        
        Args:
            text: User input text
            threshold: Probability threshold for label assignment
        
        Returns:
            List of predicted topic labels
        """
        probs = self.predict_proba(text)
        return [label for label, prob in probs.items() if prob >= threshold]
    
    def predict_with_scores(self, text: str, threshold: float = 0.5) -> List[Tuple[str, float]]:
        """
        Predict topics with their confidence scores.
        
        Returns:
            List of (topic, probability) tuples, sorted by probability
        """
        probs = self.predict_proba(text)
        results = [(label, prob) for label, prob in probs.items() if prob >= threshold]
        return sorted(results, key=lambda x: x[1], reverse=True)
    
    def get_top_k(self, text: str, k: int = 3) -> List[Tuple[str, float]]:
        """Get top-k predictions regardless of threshold"""
        probs = self.predict_proba(text)
        sorted_probs = sorted(probs.items(), key=lambda x: x[1], reverse=True)
        return sorted_probs[:k]


# ==================== CONVENIENCE FUNCTION ====================
_predictor = None

def get_predictor() -> IntentPredictor:
    """Get singleton predictor instance"""
    global _predictor
    if _predictor is None:
        _predictor = IntentPredictor()
    return _predictor


def predict_topics(text: str, threshold: float = 0.5) -> List[str]:
    """
    Convenience function for topic prediction.
    
    Usage:
        from intent_predictor import predict_topics
        topics = predict_topics("I work with React hooks")
        # Returns: ['React']
    """
    predictor = get_predictor()
    return predictor.predict(text, threshold)


def predict_topics_with_scores(text: str, threshold: float = 0.5) -> List[Tuple[str, float]]:
    """Convenience function for prediction with scores"""
    predictor = get_predictor()
    return predictor.predict_with_scores(text, threshold)


# ==================== MAIN (Testing) ====================
if __name__ == "__main__":
    print("="*60)
    print("INTENT PREDICTOR TEST")
    print("="*60)
    
    # Test samples
    test_inputs = [
        "I work with React hooks and useState",
        "java is object oriented programming language",
        "I use pandas and numpy for data analysis in python",
        "SELECT * FROM users WHERE id = 1",
        "neural networks with backpropagation",
        "I built a React frontend with Java backend and SQL database",
        "i dunno much about javascript async await stuff",
        "machine learning uses training data to make predictions"
    ]
    
    predictor = IntentPredictor()
    
    print("\n" + "-"*60)
    for text in test_inputs:
        predictions = predictor.predict_with_scores(text)
        top_k = predictor.get_top_k(text, k=3)
        
        print(f"\n📝 Input: \"{text}\"")
        print(f"   Predicted: {[p[0] for p in predictions]}")
        print(f"   Top 3: {[(p[0], f'{p[1]:.2f}') for p in top_k]}")
    
    print("\n" + "="*60)
    print("✅ Predictor test complete!")
