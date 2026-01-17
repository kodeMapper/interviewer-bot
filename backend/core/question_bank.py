"""
Question Bank for AI Interviewer
Expanded to cover all 7 supported topics.
"""

import random

# =======================
# QUESTION REPOSITORY
# =======================

QUESTION_REPO = {
    "Java": [
        ("What is the difference between JDK, JRE, and JVM?", "JDK is for development, JRE for running, JVM executes bytecode."),
        ("Explain the concept of OOP in Java.", "OOP uses objects and classes, focusing on encapsulation, inheritance, polymorphism."),
        ("A production list is throwing NullPointerException occasionally. How do you handle this efficiently?", "Check for nulls before access, use Optional, or basic if-checks."),
        ("How would you design a thread-safe Singleton class?", "Use double-checked locking, static inner helper class, or Enum singleton."),
        ("What happens if you try to modify a collection while iterating over it?", "It throws ConcurrentModificationException. Use Iterator.remove() or concurrent collections."),
        ("Explain the difference between HashMap and Hashtable.", "HashMap is non-synchronized and allows nulls; Hashtable is synchronized."),
        ("How would you handle a memory leak in a Java application?", "Use a profiler (like VisualVM) to analyze heap dump and find objects retaining memory."),
        ("Scenario: You need to read a 10GB file in Java with only 2GB RAM. How do you do it?", "Use Streams or memory-mapped files to read line-by-line instead of loading all at once.")
    ],
    
    "Python": [
        ("What is the difference between a list and a tuple?", "Lists are mutable, tuples are immutable."),
        ("Explain the use of decorators in Python.", "Decorators modify the behavior of a function or class using @symbol."),
        ("How is memory managed in Python?", "Python uses a private heap and automatic garbage collection with reference counting."),
        ("Scenario: Your Python script is running too slow processing data. How do you optimize it?", "Use profiling to find bottlenecks, vectorization with NumPy, or parallelism."),
        ("What is the difference between deep copy and shallow copy?", "Shallow copy copies references, deep copy creates new objects recursively."),
        ("Explain generators vs lists. When would you use a generator?", "Generators yield items one by one (memory efficient), lists store everything (memory heavy)."),
        ("How do you handle dependency management in a large Python project?", "Use requirements.txt, virtual environments (venv), or Docker.")
    ],
    
    "JavaScript": [
        ("What is the difference between var, let, and const?", "Var is function scoped, let/const are block scoped. Const cannot be reassigned."),
        ("Explain the event loop in JavaScript.", "It handles asynchronous callbacks by pushing them to the call stack when empty."),
        ("Scenario: A user complains the UI freezes when clicking a button. What could be the cause?", "Heavy computation on the main thread blocking the Event Loop. Use Web Workers or async."),
        ("What are Promises and how are they different from Callbacks?", "Promises represent future values and avoid 'callback hell' by chaining .then()."),
        ("What is a closure? Give a practical use case.", "A function retaining access to its outer scope. Used for data privacy/currying."),
        ("Explain 'this' keyword behavior in Arrow functions vs Normal functions.", "Arrow functions inherit 'this' from surrounding scope; normal functions define 'this' based on caller.")
    ],
    
    "React": [
        ("What are React Hooks?", "Functions that let you use state and lifecycle features in functional components."),
        ("Scenario: A component is re-rendering too often, causing lag. How do you fix it?", "Use React.memo, useMemo/useCallback to cache values/functions, or verify dependency arrays."),
        ("Explain the difference between State and Props.", "State is internal/mutable; Props are external/read-only passed from parent."),
        ("When would you use Redux or Context API over local state?", "When state needs to be accessed by many completely unrelated components (global state)."),
        ("What is the Virtual DOM and how does it improve performance?", "It's a lightweight copy of DOM. React calculates diffs (reconciliation) and updates only changed nodes."),
        ("Scenario: You need to optimize the initial load time of a large React app.", "Use Code Splitting (React.lazy/Suspense), minimize bundle size, and optimize assets.")
    ],
    
    "SQL": [
        ("What is the difference between INNER JOIN and LEFT JOIN?", "Inner join returns matching rows; Left join returns all left rows + matches."),
        ("Scenario: A query is running very slow on a large table. How do you optimize it?", "Add Indexes on filtered columns, avoid SELECT *, check execution plan."),
        ("Explain ACID properties.", "Atomicity, Consistency, Isolation, Durability - ensuring reliable transactions."),
        ("What is Normalization? Why might you purposefully DE-normalize?", "Normalization reduces redundancy. Denormalization improves read performance by reducing joins."),
        ("What is an Index? Are there downsides to having too many?", "Indexes speed up reads but slow down writes (INSERT/UPDATE) and consume storage."),
        ("Difference between WHERE and HAVING clause?", "WHERE filters rows before grouping; HAVING filters groups after aggregation.")
    ],
    
    "Machine_Learning": [
        ("What is the difference between Supervised and Unsupervised learning?", "Supervised uses labeled data; Unsupervised uses unlabeled data to find patterns."),
        ("Scenario: Your model has high accuracy on training data but low on test data. What is happening?", "Overfitting. Fix by adding data, regularization, or simplifying the model."),
        ("Explain the Bias-Variance tradeoff.", "Balancing error from erroneous assumptions (bias) vs sensitivity to noise (variance)."),
        ("How do you handle an imbalanced dataset (e.g., 99% benign, 1% fraud)?", "Resampling (SMOTE/undersampling), changing metrics (F1/Precision/Recall instead of Accuracy)."),
        ("Scenario: How would you select features if you have 1000 noisy features?", "Use L1 regularization (Lasso), Feature Importance (Random Forest), or PCA."),
        ("What is a Confusion Matrix?", "A table showing True Positives, False Positives, etc., to evaluate classification.")
    ],
    
    "Deep_Learning": [
        ("What is Backpropagation?", "Algorithm for training NNs by calculating gradients of loss with respect to weights."),
        ("Scenario: Your neural network loss is not decreasing. What could be wrong?", "Learning rate too high/low, bad initialization, or incorrect data preprocessing."),
        ("Explain Dropout and why it works.", "Randomly disabling neurons during training to force the network to learn robust features (reduces overfitting)."),
        ("What is the difference between a CNN and an RNN?", "CNNs use spatial features (images); RNNs use temporal/sequential features (text/time-series)."),
        ("What is the vanishing gradient problem?", "Gradients become zero in deep layers, stopping learning. Fix with ReLU or LSTM/ResNets.")
    ]
}

def get_random_question(topic: str):
    """Get a random question-answer pair for a given topic."""
    if topic not in QUESTION_REPO:
        # Fallback to general tech question if topic unknown
        return ("Tell me about your experience with this technology.", "General experience.")
    
    questions = QUESTION_REPO[topic]
    return random.choice(questions)

def get_all_questions(topic: str):
    return QUESTION_REPO.get(topic, [])