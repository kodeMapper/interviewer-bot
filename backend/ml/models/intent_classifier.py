"""
Intent Classifier Model - Multi-Layer Perceptron
Covers Syllabus Modules 1, 2, 3: MLPs, Backpropagation, Optimization
"""

import torch
import torch.nn as nn


class IntentClassifier(nn.Module):
    """
    Multi-Layer Perceptron for Multi-Label Intent Classification.
    
    Architecture:
        Input (384) -> Linear(128) -> ReLU -> Dropout
                    -> Linear(64) -> ReLU -> Dropout  
                    -> Linear(7) -> Sigmoid (for multi-label)
    
    Syllabus Coverage:
        - Module 1: Perceptrons, MLPs, Vectorization
        - Module 2: Feedforward NNs, Backpropagation
        - Module 6: Regularization (Dropout)
    """
    
    def __init__(
        self, 
        input_dim: int = 384,      # Sentence-Transformer embedding size
        hidden_dim_1: int = 128,   # First hidden layer
        hidden_dim_2: int = 64,    # Second hidden layer
        output_dim: int = 7,       # Number of topic classes
        dropout_rate: float = 0.3  # Dropout for regularization (Module 6)
    ):
        super(IntentClassifier, self).__init__()
        
        # Store architecture params for serialization
        self.input_dim = input_dim
        self.hidden_dim_1 = hidden_dim_1
        self.hidden_dim_2 = hidden_dim_2
        self.output_dim = output_dim
        self.dropout_rate = dropout_rate
        
        # Define layers
        self.network = nn.Sequential(
            # Layer 1: Input -> Hidden 1
            nn.Linear(input_dim, hidden_dim_1),
            nn.ReLU(),  # Non-linear activation (Module 1)
            nn.Dropout(dropout_rate),  # Regularization (Module 6)
            
            # Layer 2: Hidden 1 -> Hidden 2
            nn.Linear(hidden_dim_1, hidden_dim_2),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            
            # Output Layer: Hidden 2 -> Output
            nn.Linear(hidden_dim_2, output_dim)
            # Note: No activation here - we use BCEWithLogitsLoss which includes Sigmoid
        )
        
        # Initialize weights using Xavier (good for ReLU)
        self._init_weights()
    
    def _init_weights(self):
        """Initialize weights with Xavier uniform for better convergence"""
        for module in self.network:
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                nn.init.zeros_(module.bias)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass through the network.
        
        Args:
            x: Input tensor of shape (batch_size, input_dim)
        
        Returns:
            Logits tensor of shape (batch_size, output_dim)
        """
        return self.network(x)
    
    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """Get probabilities (after Sigmoid) for each class"""
        self.eval()
        with torch.no_grad():
            logits = self.forward(x)
            return torch.sigmoid(logits)
    
    def predict(self, x: torch.Tensor, threshold: float = 0.5) -> torch.Tensor:
        """Get binary predictions based on threshold"""
        proba = self.predict_proba(x)
        return (proba >= threshold).int()


class IntentClassifierLarge(nn.Module):
    """
    Larger variant with 3 hidden layers for comparison.
    Useful for demonstrating overfitting on small datasets.
    """
    
    def __init__(
        self,
        input_dim: int = 384,
        hidden_dims: list = [256, 128, 64],
        output_dim: int = 7,
        dropout_rate: float = 0.4
    ):
        super(IntentClassifierLarge, self).__init__()
        
        layers = []
        prev_dim = input_dim
        
        for hidden_dim in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.ReLU(),
                nn.BatchNorm1d(hidden_dim),  # Batch normalization
                nn.Dropout(dropout_rate)
            ])
            prev_dim = hidden_dim
        
        layers.append(nn.Linear(prev_dim, output_dim))
        
        self.network = nn.Sequential(*layers)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


# ==================== MODEL UTILITIES ====================
def get_model_summary(model: nn.Module) -> str:
    """Get a summary of model architecture"""
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    
    summary = f"""
{'='*50}
MODEL SUMMARY: {model.__class__.__name__}
{'='*50}
Total Parameters: {total_params:,}
Trainable Parameters: {trainable_params:,}
{'='*50}
Architecture:
{model}
{'='*50}
"""
    return summary


if __name__ == "__main__":
    # Test model creation
    model = IntentClassifier()
    print(get_model_summary(model))
    
    # Test forward pass
    dummy_input = torch.randn(8, 384)  # Batch of 8
    output = model(dummy_input)
    print(f"Input shape: {dummy_input.shape}")
    print(f"Output shape: {output.shape}")
    
    # Test prediction
    predictions = model.predict(dummy_input)
    print(f"Predictions shape: {predictions.shape}")
    print(f"Sample prediction: {predictions[0]}")
