import torch
from sentence_transformers import SentenceTransformer, util

class AnswerEvaluator:
    def __init__(self):
        print("[JUDGE] Initializing Evaluation Engine (SentenceTransformer)...")
        # Reuse the same model as the intent classifier data loader for efficiency if possible,
        # otherwise load explicitly.
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Judge Ready")

    def evaluate(self, user_answer, expected_answer):
        """
        Compares user answer with expected answer using Cosine Similarity.
        Returns: (score_percentage, is_correct_bool)
        """
        if not user_answer or len(user_answer.strip()) < 2:
            return 0, False

        embeddings = self.model.encode([user_answer, expected_answer], convert_to_tensor=True)
        # Cosine similarity
        similarity = util.cos_sim(embeddings[0], embeddings[1]).item()
        
        # Scale to 0-100
        score = max(0, min(100, int(similarity * 100)))
        
        # Thresholds
        is_correct = score >= 60  # Lenient threshold for semantic match
        
        return score, is_correct
