"""
Data Loader Module for Intent Classification
Handles dataset loading, preprocessing, and train/val/test splitting
"""

import json
import os
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from sentence_transformers import SentenceTransformer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MultiLabelBinarizer

# ==================== CONFIG ====================
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DATA_PATH = os.path.join(DATA_DIR, "interview_intents.json")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")

# Topic labels (order matters for consistency)
TOPIC_LABELS = [
    "Java", "Python", "JavaScript", "React", 
    "SQL", "Machine_Learning", "Deep_Learning"
]

# ==================== DATASET CLASS ====================
class IntentDataset(Dataset):
    """PyTorch Dataset for Intent Classification"""
    
    def __init__(self, embeddings: np.ndarray, labels: np.ndarray):
        self.embeddings = torch.tensor(embeddings, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.float32)
    
    def __len__(self):
        return len(self.embeddings)
    
    def __getitem__(self, idx):
        return self.embeddings[idx], self.labels[idx]


# ==================== DATA PROCESSING ====================
def load_raw_data(filepath: str = RAW_DATA_PATH) -> list:
    """Load raw JSON dataset"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"[DATA] Loaded {len(data)} samples from {os.path.basename(filepath)}")
    return data


def preprocess_and_split(
    data: list,
    embedding_model_name: str = "all-MiniLM-L6-v2",
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_seed: int = 42,
    save_processed: bool = True
) -> dict:
    """
    Preprocess data and split into train/val/test sets.
    
    Args:
        data: List of {"text": str, "label": list} dictionaries
        embedding_model_name: Sentence Transformer model name
        train_ratio: Proportion for training (default 70%)
        val_ratio: Proportion for validation (default 15%)
        test_ratio: Proportion for testing (default 15%)
        random_seed: Random seed for reproducibility
        save_processed: Whether to save processed arrays
    
    Returns:
        Dictionary with train/val/test DataLoaders and metadata
    """
    assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 0.01, "Ratios must sum to 1"
    
    # Extract texts and labels
    texts = [item["text"] for item in data]
    raw_labels = [item["label"] for item in data]
    
    # Multi-label binarization
    mlb = MultiLabelBinarizer(classes=TOPIC_LABELS)
    labels = mlb.fit_transform(raw_labels)
    
    print(f"[DATA] Label distribution:")
    for i, topic in enumerate(TOPIC_LABELS):
        count = labels[:, i].sum()
        print(f"       {topic}: {int(count)} samples")
    
    # Generate embeddings using Sentence Transformers
    print(f"\n[EMBEDDING] Loading model: {embedding_model_name}")
    embedding_model = SentenceTransformer(embedding_model_name)
    
    print(f"[EMBEDDING] Encoding {len(texts)} texts...")
    embeddings = embedding_model.encode(texts, show_progress_bar=True)
    embeddings = np.array(embeddings)
    print(f"[EMBEDDING] Shape: {embeddings.shape}")
    
    # Split: First into train+val and test, then train and val
    np.random.seed(random_seed)
    
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        embeddings, labels, 
        test_size=test_ratio, 
        random_state=random_seed,
        stratify=None  # Multi-label doesn't support stratify directly
    )
    
    val_adjusted_ratio = val_ratio / (train_ratio + val_ratio)
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val,
        test_size=val_adjusted_ratio,
        random_state=random_seed
    )
    
    print(f"\n[SPLIT] Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")
    
    # Save processed data
    if save_processed:
        os.makedirs(PROCESSED_DIR, exist_ok=True)
        np.save(os.path.join(PROCESSED_DIR, "X_train.npy"), X_train)
        np.save(os.path.join(PROCESSED_DIR, "X_val.npy"), X_val)
        np.save(os.path.join(PROCESSED_DIR, "X_test.npy"), X_test)
        np.save(os.path.join(PROCESSED_DIR, "y_train.npy"), y_train)
        np.save(os.path.join(PROCESSED_DIR, "y_val.npy"), y_val)
        np.save(os.path.join(PROCESSED_DIR, "y_test.npy"), y_test)
        print(f"[SAVE] Processed data saved to {PROCESSED_DIR}")
    
    return {
        "X_train": X_train, "y_train": y_train,
        "X_val": X_val, "y_val": y_val,
        "X_test": X_test, "y_test": y_test,
        "embedding_dim": embeddings.shape[1],
        "num_classes": len(TOPIC_LABELS),
        "label_names": TOPIC_LABELS
    }


def load_processed_data() -> dict:
    """Load previously processed data from disk"""
    return {
        "X_train": np.load(os.path.join(PROCESSED_DIR, "X_train.npy")),
        "X_val": np.load(os.path.join(PROCESSED_DIR, "X_val.npy")),
        "X_test": np.load(os.path.join(PROCESSED_DIR, "X_test.npy")),
        "y_train": np.load(os.path.join(PROCESSED_DIR, "y_train.npy")),
        "y_val": np.load(os.path.join(PROCESSED_DIR, "y_val.npy")),
        "y_test": np.load(os.path.join(PROCESSED_DIR, "y_test.npy")),
        "embedding_dim": 384,  # MiniLM default
        "num_classes": len(TOPIC_LABELS),
        "label_names": TOPIC_LABELS
    }


def create_dataloaders(
    data_dict: dict,
    batch_size: int = 16,
    shuffle_train: bool = True
) -> dict:
    """Create PyTorch DataLoaders from processed data"""
    
    train_dataset = IntentDataset(data_dict["X_train"], data_dict["y_train"])
    val_dataset = IntentDataset(data_dict["X_val"], data_dict["y_val"])
    test_dataset = IntentDataset(data_dict["X_test"], data_dict["y_test"])
    
    return {
        "train": DataLoader(train_dataset, batch_size=batch_size, shuffle=shuffle_train),
        "val": DataLoader(val_dataset, batch_size=batch_size, shuffle=False),
        "test": DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    }


# ==================== MAIN (for testing) ====================
if __name__ == "__main__":
    # Test the data loading pipeline
    raw_data = load_raw_data()
    processed = preprocess_and_split(raw_data)
    loaders = create_dataloaders(processed)
    
    # Verify batch shapes
    for batch_x, batch_y in loaders["train"]:
        print(f"\n[TEST] Batch X shape: {batch_x.shape}")
        print(f"[TEST] Batch Y shape: {batch_y.shape}")
        break
    
    print("\n✅ Data loading pipeline complete!")
