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
        ("Scenario: You need to read a 10GB file in Java with only 2GB RAM. How do you do it?", "Use Streams or memory-mapped files to read line-by-line instead of loading all at once."),
        ("What is the difference between an Interface and an Abstract Class?", "Interfaces define contracts (can implements multiple), Abstract classes define base behavior (single inheritance)."),
        ("Explain the String Pool and why Strings are immutable.", "Strings are cached in a pool to save memory. Immutability ensures security and thread-safety."),
        ("What is the 'final' keyword used for?", "It can make variables constant, methods un-overridable, and classes un-inheritable."),
        ("Difference between Checked and Unchecked exceptions?", "Checked are enforced at compile-time (IOException); Unchecked occur at runtime (NullPointerException)."),
        ("Compare Synchronized block vs ReentrantLock.", "Synchronized is implicit/scoped; ReentrantLock offers more control like tryLock() and fairness policies."),
        ("What is the 'volatile' keyword?", "It guarantees visibility of changes to variables across threads (happens-before relationship)."),
        ("How does Java Serialization work? What is serialVersionUID?", "Converts objects to byte streams. serialVersionUID ensures version compatibility during deserialization."),
        ("Explain Generics and Type Erasure.", "Generics provide type safety at compile time. Erasure removes type info at runtime for backward compatibility."),
        ("How does the Garbage Collector know what to remove?", "It finds unreachable objects (no references) starting from GC Roots (stack, static vars)."),
        ("What are the differences between ArrayList and LinkedList?", "ArrayList uses dynamic arrays (fast access, slow modify); LinkedList uses nodes (slow access, fast modify)."),
        ("Explain the Factory Design Pattern.", "A creational pattern that uses a factory method to create objects without specifying the exact class."),
        ("What is the difference between map() and flatMap() in Streams?", "map() transforms elements 1-to-1; flatMap() flattens nested structures (1-to-Many)."),
        ("What is a Functional Interface?", "An interface with exactly one abstract method, compatible with Lambdas (e.g., Runnable, Callable)."),
        ("Explain the Reflection API.", "Allows inspecting and modifying runtime behavior of classes, methods, and fields dynamically."),
        ("What is the difference between Comparable and Comparator?", "Comparable defines natural ordering (compareTo); Comparator defines custom external ordering (compare)."),
        ("Differentiate between Stack and Heap memory.", "Stack stores local variables/method calls (LIFO); Heap stores objects (global access)."),
        ("What is the try-with-resources statement?", "Automatically closes resources (like streams/connections) implementing AutoCloseable."),
        ("How do you prevent Deadlocks in Java?", "Avoid nested locks, use lock ordering, or use tryLock with timeouts.")
    ],
    
    "Python": [
        ("What is the difference between a list and a tuple?", "Lists are mutable, tuples are immutable."),
        ("Explain the use of decorators in Python.", "Decorators modify the behavior of a function or class using @symbol."),
        ("How is memory managed in Python?", "Python uses a private heap and automatic garbage collection with reference counting."),
        ("Scenario: Your Python script is running too slow processing data. How do you optimize it?", "Use profiling to find bottlenecks, vectorization with NumPy, or parallelism."),
        ("What is the difference between deep copy and shallow copy?", "Shallow copy copies references, deep copy creates new objects recursively."),
        ("Explain generators vs lists. When would you use a generator?", "Generators yield items one by one (memory efficient), lists store everything (memory heavy)."),
        ("How do you handle dependency management in a large Python project?", "Use requirements.txt, virtual environments (venv), or Docker."),
        ("What is the Global Interpreter Lock (GIL)?", "A mutex that prevents multiple native threads from executing Python bytecodes at once."),
        ("Explain the 'with' statement and Context Managers.", "Ensures resources (files, locks) are properly acquired and released (setup/teardown logic)."),
        ("Difference between __init__ and __new__?", "__new__ creates the instance; __init__ initializes it. __new__ is used for immutable subclassing."),
        ("What are Metaclasses in Python?", "Classes of classes. They define how classes themselves are created (e.g., Singleton implementation)."),
        ("Compare List Comprehension vs Generator Expression.", "List comp creates a full list in memory; Generator expr returns an iterator (lazy evaluation)."),
        ("What is Monkey Patching?", "Dynamically modifying a class or module at runtime (often for testing/mocking)."),
        ("Explain the difference between Multiprocessing and Threading.", "Threading is limited by GIL (good for I/O); Multiprocessing uses separate processes (good for CPU bound)."),
        ("Difference between 'is' and '=='?", "'is' checks identity (same memory address); '==' checks equality (same value)."),
        ("What happens with mutable default arguments in functions?", "They are created once at definition time, leading to shared state across calls (common bug)."),
        ("Explain *args and **kwargs.", "*args passes variable positional arguments; **kwargs passes variable keyword arguments."),
        ("What is a Lambda function?", "A small anonymous function defined with the lambda keyword, usually for short operations."),
        ("Explain the Iterator Protocol.", "An object must implement __iter__() returning self and __next__() returning values or StopIteration."),
        ("What is Pickling?", "Serializing a Python object structure into a byte stream for storage or transmission."),
        ("Explain LEGB scope rule.", "Local, Enclosing, Global, Built-in. The order in which Python looks up variable names."),
        ("What are PyTest Fixtures?", "Functions that run before/after tests to set up state or data (dependency injection for tests)."),
        ("Difference between asyncio and threading?", "Asyncio uses a single-threaded event loop (cooperative multitasking); Threading uses OS threads."),
        ("How does Python handle circular imports?", "It can fail or return partially initialized modules. Fix by moving imports inside functions or restructuring.")
    ],
    
    "JavaScript": [
        ("What is the difference between var, let, and const?", "Var is function scoped, let/const are block scoped. Const cannot be reassigned."),
        ("Explain the event loop in JavaScript.", "It handles asynchronous callbacks by pushing them to the call stack when empty."),
        ("Scenario: A user complains the UI freezes when clicking a button. What could be the cause?", "Heavy computation on the main thread blocking the Event Loop. Use Web Workers or async."),
        ("What are Promises and how are they different from Callbacks?", "Promises represent future values and avoid 'callback hell' by chaining .then()."),
        ("What is a closure? Give a practical use case.", "A function retaining access to its outer scope. Used for data privacy/currying."),
        ("Explain 'this' keyword behavior in Arrow functions vs Normal functions.", "Arrow functions inherit 'this' from surrounding scope; normal functions define 'this' based on caller."),
        ("What is Hoisting?", "Variable and function declarations are moved to the top of their scope during compilation."),
        ("Explain Prototypal Inheritance.", "Objects inherit properties directly from other objects (prototypes) via the prototype chain."),
        ("Difference between '==' and '==='?", "'==' converts types (coercion) before comparing; '===' checks value and type (strict equality)."),
        ("What do bind, call, and apply do?", "They change the context of 'this'. Call/Apply invoke immediately; Bind returns a new function."),
        ("What is Destructuring Assignment?", "Unpacking values from arrays or properties from objects into distinct variables."),
        ("Explain the Spread (...) vs Rest operator.", "Spread expands iterables; Rest collects multiple elements into an array."),
        ("What is Currying?", "Transforming a function with multiple arguments into a sequence of functions taking one argument."),
        ("Explain Higher Order Functions.", "Functions that take other functions as args or return them (e.g., map, filter, reduce)."),
        ("Difference between CommonJS and ES6 Modules?", "CommonJS uses require/module.exports (dynamic); ES6 uses import/export (static/analyzable)."),
        ("What is Event Bubbling vs Capturing?", "Bubbling propagates events up the DOM; Capturing propagates down. Controlled via addEventListener options."),
        ("Difference between LocalStorage, SessionStorage, and Cookies?", "Local stays until deleted; Session clears on tab close; Cookies are sent with HTTP requests."),
        ("Why use async/await over Promises?", "Syntactic sugar that makes asynchronous code look synchronous and easier to read/debug."),
        ("What is Memoization?", "Caching results of expensive function calls based on arguments to speed up future calls."),
        ("What is a Generator Function?", "A function that can pause execution (yield) and resume later. Returns an iterator."),
        ("Explain Event Delegation.", "Attaching a single listener to a parent element to manage events for all descendants."),
        ("What is 'Strict Mode'?", "Enforces stricter parsing/error handling (e.g., prevents accidental globals) using 'use strict'."),
        ("What are Typed Arrays in JS?", "Array-like buffers (Int8Array, Float32Array) for handling raw binary data efficiently.")
    ],
    
    "React": [
        ("What are React Hooks?", "Functions that let you use state and lifecycle features in functional components."),
        ("Scenario: A component is re-rendering too often, causing lag. How do you fix it?", "Use React.memo, useMemo/useCallback to cache values/functions, or verify dependency arrays."),
        ("Explain the difference between State and Props.", "State is internal/mutable; Props are external/read-only passed from parent."),
        ("When would you use Redux or Context API over local state?", "When state needs to be accessed by many completely unrelated components (global state)."),
        ("What is the Virtual DOM and how does it improve performance?", "It's a lightweight copy of DOM. React calculates diffs (reconciliation) and updates only changed nodes."),
        ("Scenario: You need to optimize the initial load time of a large React app.", "Use Code Splitting (React.lazy/Suspense), minimize bundle size, and optimize assets."),
        ("What is the useEffect Hook used for?", "Handling side effects (fetching data, subscriptions) in functional components."),
        ("Dependency Array pitfalls in useEffect?", "Omitting dependencies causes stale closures; including objects/arrays without memoization causes loops."),
        ("Difference between useRef and useState?", "useRef values persist without triggering re-renders; useState triggers re-render on update."),
        ("What are Higher Order Components (HOC)?", "Functions that take a component and return a new enhanced component."),
        ("Explain the Render Props pattern.", "Sharing code between components using a prop whose value is a function."),
        ("What are Error Boundaries?", "Components that catch JavaScript errors in their child component tree."),
        ("What are React Portals?", "Way to render children into a DOM node properly outside the parent hierarchy (e.g., Modals)."),
        ("Compare SSR (Server Side Rendering) vs CSR.", "SSR sends fully rendered HTML (better SEO/initial load); CSR renders in browser (interactive faster)."),
        ("controlled vs uncontrolled components?", "Controlled gets value from state; Uncontrolled gets value from Ref (DOM source of truth)."),
        ("What is Prop Drilling and how to avoid it?", "Passing data through many layers. Avoid via Context API, Redux, or Composition."),
        ("What are Custom Hooks?", "User-defined hooks to extract reusable logic involving other hooks (e.g., useFetch)."),
        ("Why are 'keys' important in lists?", "They help React identify which items changed, added, or removed. Using index is bad if order changes."),
        ("What is React Fiber?", "The reimplemented reconciliation engine allowing incremental rendering and prioritization."),
        ("Explain React.StrictMode.", "A tool/wrapper that activates checks/warnings (like double rendering) in development mode."),
        ("Difference between CSS-in-JS and CSS Modules?", "CSS-in-JS (Styled Components) scopes styles dynamically; Modules scope via unique class names at build time."),
        ("How do you handle forms in React?", "Using strict state control (onChange handlers) or libraries like Formik/React Hook Form.")
    ],
    
    "SQL": [
        ("What is the difference between INNER JOIN and LEFT JOIN?", "Inner join returns matching rows; Left join returns all left rows + matches."),
        ("Scenario: A query is running very slow on a large table. How do you optimize it?", "Add Indexes on filtered columns, avoid SELECT *, check execution plan."),
        ("Explain ACID properties.", "Atomicity, Consistency, Isolation, Durability - ensuring reliable transactions."),
        ("What is Normalization? Why might you purposefully DE-normalize?", "Normalization reduces redundancy. Denormalization improves read performance by reducing joins."),
        ("What is an Index? Are there downsides to having too many?", "Indexes speed up reads but slow down writes (INSERT/UPDATE) and consume storage."),
        ("Difference between WHERE and HAVING clause?", "WHERE filters rows before grouping; HAVING filters groups after aggregation."),
        ("Explain Primary Key vs Foreign Key.", "Primary uniquely identifies a row; Foreign links to a Primary Key in another table (enforces integrity)."),
        ("Stored Procedures vs Functions in SQL?", "Procs can perform actions/transactions; Functions must return a value and cannot change DB state."),
        ("What is a Database Trigger?", "Code that automatically runs in response to specific events (INSERT, UPDATE) on a table."),
        ("Difference between View and Materialized View?", "View is a virtual query (runs every time); Materialized stores the result physically (needs refreshing)."),
        ("Explain UNION vs UNION ALL.", "UNION removes duplicates; UNION ALL keeps duplicates (faster)."),
        ("Clustered vs Non-Clustered Index?", "Clustered stores data physically in order (only 1 per table); Non-Clustered is a separate pointer list."),
        ("What are Transaction Isolation Levels?", "Read Uncommitted, Read Committed, Repeatable Read, Serializable (trade-off between consistency and concurrency)."),
        ("What is a Self Join?", "Joining a table with itself, useful for hierarchical data (e.g., Employee Manager relationship)."),
        ("Explain Window Functions like RANK() or ROW_NUMBER().", "Perform calculations across a set of table rows related to the current row without grouping."),
        ("What is a CTE (Common Table Expression)?", "A temporary result set named in a WITH clause, improving readability over subqueries."),
        ("How to prevent SQL Injection?", "Use Parameterized Queries (Prepared Statements) or ORMs; never concatenate user input."),
        ("Sharding vs Partitioning?", "sharding distributes data across multiple servers; Partitioning splits a table within a single database."),
        ("NoSQL vs SQL trade-offs?", "SQL = Structured, ACID, Scaling Up. NoSQL = Flexible schema, BASE, Scaling Out."),
        ("What is the N+1 problem?", "Fetching parent then fetching children individually (N queries) instead of 1 join query."),
        ("DELETE vs TRUNCATE vs DROP?", "DELETE removes rows (loggable); TRUNCATE resets table (fast); DROP deletes table structure."),
        ("Difference between COALESCE and ISNULL?", "COALESCE returns first non-null argument (standard SQL); ISNULL is engine specific (often 2 args)."),
        ("When might a Subquery be faster than a Join?", "Sometimes, when the subquery can filter massive data early (though optimizers often treat them similarly).")
    ],
    
    "Machine_Learning": [
        ("What is the difference between Supervised and Unsupervised learning?", "Supervised uses labeled data; Unsupervised uses unlabeled data to find patterns."),
        ("Scenario: Your model has high accuracy on training data but low on test data. What is happening?", "Overfitting. Fix by adding data, regularization, or simplifying the model."),
        ("Explain the Bias-Variance tradeoff.", "Balancing error from erroneous assumptions (bias) vs sensitivity to noise (variance)."),
        ("How do you handle an imbalanced dataset (e.g., 99% benign, 1% fraud)?", "Resampling (SMOTE/undersampling), changing metrics (F1/Precision/Recall instead of Accuracy)."),
        ("Scenario: How would you select features if you have 1000 noisy features?", "Use L1 regularization (Lasso), Feature Importance (Random Forest), or PCA."),
        ("What is a Confusion Matrix?", "A table showing True Positives, False Positives, etc., to evaluate classification."),
        ("Explain Precision vs Recall.", "Precision = Correct Positives / All Predicted Positives. Recall = Correct Positives / All Actual Positives."),
        ("What is ROC Curve and AUC?", "ROC plots TPR vs FPR. AUC measures separability (1.0 is perfect)."),
        ("What is Cross-Validation (K-Fold)?", "Splitting data into K parts, training on K-1 and testing on 1, K times. Reduces variance."),
        ("Difference between L1 and L2 Regularization?", "L1 (Lasso) shrinks weights to zero (feature selection); L2 (Ridge) shrinks weights evenly."),
        ("Gradient Descent vs Stochastic Gradient Descent (SGD)?", "GD updates using whole dataset; SGD updates using single sample (faster, noisier)."),
        ("Bagging vs Boosting?", "Bagging (Random Forest) trains in parallel to reduce variance; Boosting (XGBoost) trains sequentially to reduce bias."),
        ("How does a Support Vector Machine (SVM) work?", "Finds the hyperplane that maximizes the margin between classes. Uses Kernel trick for non-linear."),
        ("What is K-Means Clustering?", "Partitioning n observations into k clusters where each belongs to the cluster with the nearest mean."),
        ("Explain PCA (Principal Component Analysis).", "Dimensionality reduction technique projecting data onto orthogonal axes measuring max variance."),
        ("Assumption of Naive Bayes?", "Features are independent of each other (often false, but works well)."),
        ("How to handle Missing Data?", "Imputation (mean/median), dropping rows, or using algorithms that handle nulls."),
        ("Normalization vs Standardization?", "Normalization scales to [0,1]; Standardization scales to Mean=0, Std=1."),
        ("Grid Search vs Random Search for Hyperparameters?", "Grid checks all combinations (slow); Random samples combinations (faster, often finds good enough)."),
        ("Advantages of XGBoost/LightGBM?", "Handling missing values, tree pruning, parallel processing, regularization."),
        ("What is Collaborative Filtering?", "Recommendation technique based on past user-item interactions (User-based or Item-based)."),
        ("Explain the F1 Score.", "Harmonic mean of Precision and Recall. Good for imbalanced datasets."),
        ("What is A/B Testing?", "Comparing two versions against each other to determine which performs better.")
    ],
    
    "Deep_Learning": [
        ("What is Backpropagation?", "Algorithm for training NNs by calculating gradients of loss with respect to weights."),
        ("Scenario: Your neural network loss is not decreasing. What could be wrong?", "Learning rate too high/low, bad initialization, or incorrect data preprocessing."),
        ("Explain Dropout and why it works.", "Randomly disabling neurons during training to force the network to learn robust features (reduces overfitting)."),
        ("What is the difference between a CNN and an RNN?", "CNNs use spatial features (images); RNNs use temporal/sequential features (text/time-series)."),
        ("What is the vanishing gradient problem?", "Gradients become zero in deep layers, stopping learning. Fix with ReLU or LSTM/ResNets."),
        ("Explain Activation Functions (ReLU vs Sigmoid).", "Sigmoid squashes to [0,1] (vanishing gradient risk). ReLU outputs input if >0 (sparse, efficient)."),
        ("What is Batch Normalization?", "Normalizing layer inputs to mean 0, var 1 per batch. Speeds up training and stabilizes gradients."),
        ("Difference between Xavier and He Initialization?", "Xavier is for Sigmoid/Tanh; He is optimized for ReLU to prevent signal dying out."),
        ("Compare Adam vs SGD with Momentum.", "Adam adapts learning rates per parameter; SGD Momentum accelerates in relevant direction."),
        ("What is Padding and Stride in CNN?", "Padding adds border pixels (keeps size); Stride is step size of filter (reduces size)."),
        ("Max Pooling vs Average Pooling?", "Max selects sharpest feature; Average smooths out features."),
        ("What is Transfer Learning?", "Using a pre-trained model (e.g., ResNet on ImageNet) and fine-tuning it for a new task."),
        ("LSTM vs GRU?", "LSTM has 3 gates (forget, input, output); GRU has 2 (reset, update). GRU is faster/simpler."),
        ("Explain Attention Mechanism.", "Allows model to focus on specific parts of input sequence regardless of distance."),
        ("BERT vs GPT architecture?", "BERT is Encoder-only (bidirectional, understanding); GPT is Decoder-only (unidirectional, generation)."),
        ("What is an Autoencoder?", "NN that compresses input to latent space and reconstructs it. Used for denoising/dimensionality reduction."),
        ("Explain GANs (Generative Adversarial Networks).", "Two networks (Generator vs Discriminator) competing. Generator creates fakes; Discriminator detects them."),
        ("Exploding Gradient Problem?", "Gradients get too large, creating NaN weights. Fix with Gradient Clipping."),
        ("What are Skip Connections (ResNet)?", "Adding input directly to deeper layer output. Solves vanishing gradient in deep nets."),
        ("CrossEntropy vs MSE Loss?", "CrossEntropy for classification (probability distance); MSE for regression (value distance)."),
        ("What are Word Embeddings (Word2Vec/GloVe)?", "Vector representations of words where similar meanings are close in space."),
        ("Explain Temperature in Softmax.", "Controls randomness. High temp = flat distribution (creative); Low temp = peaked (confident)."),
        ("Epoch vs Batch vs Iteration?", "Epoch = 1 pass of full dataset; Batch = subset processed at once; Iteration = 1 step of gradient update."),
        ("What is Model Quantization?", "Reducing precision of weights (float32 -> int8) to reduce model size/latency.")
    ]
}

COMMON_IGNORE_WORDS = {
    "the", "is", "a", "an", "and", "or", "in", "on", "of", "to", "with", "what", "how", 
    "why", "describe", "explain", "scenario", "difference", "between", "use", "using", 
    "does", "do", "you", "your", "my", "i", "it", "that", "this", "for", "are", "have", "has",
    "know", "think", "maybe", "guess", "tell", "me", "more", "about"
}

KEYWORD_INDEX = {}

def build_keyword_index():
    """Builds an inverted index: Keyword -> List of (Topic, Question, Answer)"""
    global KEYWORD_INDEX
    KEYWORD_INDEX = {}
    
    for topic, questions in QUESTION_REPO.items():
        for q_text, ans_text in questions:
            # Tokenize question text
            words = set(q_text.lower().replace("?", "").replace(".", "").replace(",", "").split())
            
            # Filter stop words
            keywords = words - COMMON_IGNORE_WORDS
            
            for kw in keywords:
                if len(kw) < 3: continue # Skip very short words
                if kw not in KEYWORD_INDEX:
                    KEYWORD_INDEX[kw] = []
                KEYWORD_INDEX[kw].append((topic, q_text, ans_text))

# Build index on startup
build_keyword_index()

def get_random_question(topic: str):
    """Get a random question-answer pair for a given topic."""
    if topic not in QUESTION_REPO:
        # Fallback to general tech question if topic unknown
        return ("Please describe your practical experience with this technology.", "Practical usage.")
    
    questions = QUESTION_REPO[topic]
    return random.choice(questions)

def get_all_questions(topic: str):
    return QUESTION_REPO.get(topic, [])

def get_question_by_keyword(keyword: str, current_topic: str = None, allowed_topics: list = None):
    """
    Finds a question matching the keyword.
    Prioritizes questions from the 'current_topic' if provided.
    Restricts results to 'allowed_topics' to avoid asking about React in a Java interview.
    """
    keyword = keyword.lower()
    if keyword not in KEYWORD_INDEX:
        return None
    
    # Get all matching questions
    matches = KEYWORD_INDEX[keyword]
    
    # 1. Filter by Allowed Topics (Critical Fix for Cross-Topic Pollution)
    if allowed_topics:
        matches = [m for m in matches if m[0] in allowed_topics]
        if not matches: return None

    # 2. If topic is specifically requested (e.g. current deep dive), prioritize it
    if current_topic:
        topic_matches = [m for m in matches if m[0] == current_topic]
        if topic_matches:
            return random.choice(topic_matches)
            
    # 3. Fallback to any match within allowed topics
    return random.choice(matches)