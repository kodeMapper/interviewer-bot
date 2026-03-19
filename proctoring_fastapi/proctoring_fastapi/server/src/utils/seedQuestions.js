/**
 * Question Bank Seeder
 * Seeds the MongoDB database with the original question bank from Python
 */

const Question = require('../models/Question');

// Original question repository migrated from Python
const QUESTION_REPO = {
  Java: [
    { question: "What is the difference between JDK, JRE, and JVM?", expectedAnswer: "JDK is for development, JRE for running, JVM executes bytecode.", keywords: ["jdk", "jre", "jvm", "bytecode", "development"] },
    { question: "Explain the concept of OOP in Java.", expectedAnswer: "OOP uses objects and classes, focusing on encapsulation, inheritance, polymorphism.", keywords: ["oop", "objects", "classes", "encapsulation", "inheritance", "polymorphism"] },
    { question: "A production list is throwing NullPointerException occasionally. How do you handle this efficiently?", expectedAnswer: "Check for nulls before access, use Optional, or basic if-checks.", keywords: ["nullpointerexception", "optional", "null", "exception"] },
    { question: "How would you design a thread-safe Singleton class?", expectedAnswer: "Use double-checked locking, static inner helper class, or Enum singleton.", keywords: ["singleton", "thread-safe", "double-checked", "locking", "enum"] },
    { question: "What happens if you try to modify a collection while iterating over it?", expectedAnswer: "It throws ConcurrentModificationException. Use Iterator.remove() or concurrent collections.", keywords: ["concurrentmodificationexception", "iterator", "collection", "concurrent"] },
    { question: "Explain the difference between HashMap and Hashtable.", expectedAnswer: "HashMap is non-synchronized and allows nulls; Hashtable is synchronized.", keywords: ["hashmap", "hashtable", "synchronized", "nulls"] },
    { question: "How would you handle a memory leak in a Java application?", expectedAnswer: "Use a profiler (like VisualVM) to analyze heap dump and find objects retaining memory.", keywords: ["memory", "leak", "profiler", "visualvm", "heap", "dump"] },
    { question: "Scenario: You need to read a 10GB file in Java with only 2GB RAM. How do you do it?", expectedAnswer: "Use Streams or memory-mapped files to read line-by-line instead of loading all at once.", keywords: ["streams", "memory-mapped", "file", "line-by-line", "buffered"] },
    { question: "What is the difference between an Interface and an Abstract Class?", expectedAnswer: "Interfaces define contracts (can implements multiple), Abstract classes define base behavior (single inheritance).", keywords: ["interface", "abstract", "class", "inheritance", "contract"] },
    { question: "Explain the String Pool and why Strings are immutable.", expectedAnswer: "Strings are cached in a pool to save memory. Immutability ensures security and thread-safety.", keywords: ["string", "pool", "immutable", "cache", "thread-safety"] },
    { question: "What is the 'final' keyword used for?", expectedAnswer: "It can make variables constant, methods un-overridable, and classes un-inheritable.", keywords: ["final", "constant", "override", "inherit"] },
    { question: "Difference between Checked and Unchecked exceptions?", expectedAnswer: "Checked are enforced at compile-time (IOException); Unchecked occur at runtime (NullPointerException).", keywords: ["checked", "unchecked", "exception", "compile-time", "runtime"] },
    { question: "Compare Synchronized block vs ReentrantLock.", expectedAnswer: "Synchronized is implicit/scoped; ReentrantLock offers more control like tryLock() and fairness policies.", keywords: ["synchronized", "reentrantlock", "trylock", "fairness", "lock"] },
    { question: "What is the 'volatile' keyword?", expectedAnswer: "It guarantees visibility of changes to variables across threads (happens-before relationship).", keywords: ["volatile", "visibility", "threads", "happens-before"] },
    { question: "How does Java Serialization work? What is serialVersionUID?", expectedAnswer: "Converts objects to byte streams. serialVersionUID ensures version compatibility during deserialization.", keywords: ["serialization", "byte", "serialversionuid", "deserialization"] },
    { question: "Explain Generics and Type Erasure.", expectedAnswer: "Generics provide type safety at compile time. Erasure removes type info at runtime for backward compatibility.", keywords: ["generics", "type", "erasure", "compile-time", "backward"] },
    { question: "How does the Garbage Collector know what to remove?", expectedAnswer: "It finds unreachable objects (no references) starting from GC Roots (stack, static vars).", keywords: ["garbage", "collector", "gc", "roots", "unreachable", "references"] },
    { question: "What are the differences between ArrayList and LinkedList?", expectedAnswer: "ArrayList uses dynamic arrays (fast access, slow modify); LinkedList uses nodes (slow access, fast modify).", keywords: ["arraylist", "linkedlist", "dynamic", "array", "nodes"] },
    { question: "Explain the Factory Design Pattern.", expectedAnswer: "A creational pattern that uses a factory method to create objects without specifying the exact class.", keywords: ["factory", "pattern", "creational", "design"] },
    { question: "What is the difference between map() and flatMap() in Streams?", expectedAnswer: "map() transforms elements 1-to-1; flatMap() flattens nested structures (1-to-Many).", keywords: ["map", "flatmap", "streams", "transform", "flatten"] },
    { question: "What is a Functional Interface?", expectedAnswer: "An interface with exactly one abstract method, compatible with Lambdas (e.g., Runnable, Callable).", keywords: ["functional", "interface", "lambda", "runnable", "callable"] },
    { question: "Explain the Reflection API.", expectedAnswer: "Allows inspecting and modifying runtime behavior of classes, methods, and fields dynamically.", keywords: ["reflection", "api", "runtime", "dynamic", "inspect"] },
    { question: "What is the difference between Comparable and Comparator?", expectedAnswer: "Comparable defines natural ordering (compareTo); Comparator defines custom external ordering (compare).", keywords: ["comparable", "comparator", "ordering", "compareto"] },
    { question: "Differentiate between Stack and Heap memory.", expectedAnswer: "Stack stores local variables/method calls (LIFO); Heap stores objects (global access).", keywords: ["stack", "heap", "memory", "lifo", "local"] },
    { question: "What is the try-with-resources statement?", expectedAnswer: "Automatically closes resources (like streams/connections) implementing AutoCloseable.", keywords: ["try-with-resources", "autocloseable", "streams", "connections"] },
    { question: "How do you prevent Deadlocks in Java?", expectedAnswer: "Avoid nested locks, use lock ordering, or use tryLock with timeouts.", keywords: ["deadlock", "lock", "ordering", "timeout", "nested"] }
  ],

  Python: [
    { question: "What is the difference between a list and a tuple?", expectedAnswer: "Lists are mutable, tuples are immutable.", keywords: ["list", "tuple", "mutable", "immutable"] },
    { question: "Explain the use of decorators in Python.", expectedAnswer: "Decorators modify the behavior of a function or class using @symbol.", keywords: ["decorator", "function", "class", "wrapper"] },
    { question: "How is memory managed in Python?", expectedAnswer: "Python uses a private heap and automatic garbage collection with reference counting.", keywords: ["memory", "heap", "garbage", "collection", "reference"] },
    { question: "Scenario: Your Python script is running too slow processing data. How do you optimize it?", expectedAnswer: "Use profiling to find bottlenecks, vectorization with NumPy, or parallelism.", keywords: ["optimize", "profiling", "numpy", "vectorization", "parallelism"] },
    { question: "What is the difference between deep copy and shallow copy?", expectedAnswer: "Shallow copy copies references, deep copy creates new objects recursively.", keywords: ["deep", "shallow", "copy", "reference", "recursive"] },
    { question: "Explain generators vs lists. When would you use a generator?", expectedAnswer: "Generators yield items one by one (memory efficient), lists store everything (memory heavy).", keywords: ["generator", "yield", "memory", "efficient", "list"] },
    { question: "How do you handle dependency management in a large Python project?", expectedAnswer: "Use requirements.txt, virtual environments (venv), or Docker.", keywords: ["dependency", "requirements", "venv", "virtual", "docker"] },
    { question: "What is the Global Interpreter Lock (GIL)?", expectedAnswer: "A mutex that prevents multiple native threads from executing Python bytecodes at once.", keywords: ["gil", "global", "interpreter", "lock", "mutex", "threads"] },
    { question: "Explain the 'with' statement and Context Managers.", expectedAnswer: "Ensures resources (files, locks) are properly acquired and released (setup/teardown logic).", keywords: ["with", "context", "manager", "resource", "teardown"] },
    { question: "Difference between __init__ and __new__?", expectedAnswer: "__new__ creates the instance; __init__ initializes it. __new__ is used for immutable subclassing.", keywords: ["init", "new", "instance", "initialize", "immutable"] },
    { question: "What are Metaclasses in Python?", expectedAnswer: "Classes of classes. They define how classes themselves are created (e.g., Singleton implementation).", keywords: ["metaclass", "class", "singleton", "type"] },
    { question: "Compare List Comprehension vs Generator Expression.", expectedAnswer: "List comp creates a full list in memory; Generator expr returns an iterator (lazy evaluation).", keywords: ["comprehension", "generator", "expression", "lazy", "iterator"] },
    { question: "What is Monkey Patching?", expectedAnswer: "Dynamically modifying a class or module at runtime (often for testing/mocking).", keywords: ["monkey", "patching", "runtime", "testing", "mocking"] },
    { question: "Explain the difference between Multiprocessing and Threading.", expectedAnswer: "Threading is limited by GIL (good for I/O); Multiprocessing uses separate processes (good for CPU bound).", keywords: ["multiprocessing", "threading", "gil", "io", "cpu"] },
    { question: "Difference between 'is' and '=='?", expectedAnswer: "'is' checks identity (same memory address); '==' checks equality (same value).", keywords: ["is", "equality", "identity", "memory", "address"] },
    { question: "What happens with mutable default arguments in functions?", expectedAnswer: "They are created once at definition time, leading to shared state across calls (common bug).", keywords: ["mutable", "default", "argument", "shared", "state"] },
    { question: "Explain *args and **kwargs.", expectedAnswer: "*args passes variable positional arguments; **kwargs passes variable keyword arguments.", keywords: ["args", "kwargs", "positional", "keyword", "arguments"] },
    { question: "What is a Lambda function?", expectedAnswer: "A small anonymous function defined with the lambda keyword, usually for short operations.", keywords: ["lambda", "anonymous", "function", "inline"] },
    { question: "Explain the Iterator Protocol.", expectedAnswer: "An object must implement __iter__() returning self and __next__() returning values or StopIteration.", keywords: ["iterator", "protocol", "iter", "next", "stopiteration"] },
    { question: "What is Pickling?", expectedAnswer: "Serializing a Python object structure into a byte stream for storage or transmission.", keywords: ["pickle", "serialize", "byte", "stream", "storage"] },
    { question: "Explain LEGB scope rule.", expectedAnswer: "Local, Enclosing, Global, Built-in. The order in which Python looks up variable names.", keywords: ["legb", "scope", "local", "global", "enclosing"] },
    { question: "What are PyTest Fixtures?", expectedAnswer: "Functions that run before/after tests to set up state or data (dependency injection for tests).", keywords: ["pytest", "fixture", "test", "setup", "injection"] },
    { question: "Difference between asyncio and threading?", expectedAnswer: "Asyncio uses a single-threaded event loop (cooperative multitasking); Threading uses OS threads.", keywords: ["asyncio", "threading", "event", "loop", "cooperative"] },
    { question: "How does Python handle circular imports?", expectedAnswer: "It can fail or return partially initialized modules. Fix by moving imports inside functions or restructuring.", keywords: ["circular", "import", "module", "restructure"] }
  ],

  JavaScript: [
    { question: "What is the difference between var, let, and const?", expectedAnswer: "Var is function scoped, let/const are block scoped. Const cannot be reassigned.", keywords: ["var", "let", "const", "scope", "block", "function"] },
    { question: "Explain the event loop in JavaScript.", expectedAnswer: "It handles asynchronous callbacks by pushing them to the call stack when empty.", keywords: ["event", "loop", "async", "callback", "stack"] },
    { question: "Scenario: A user complains the UI freezes when clicking a button. What could be the cause?", expectedAnswer: "Heavy computation on the main thread blocking the Event Loop. Use Web Workers or async.", keywords: ["freeze", "ui", "main", "thread", "event", "loop", "workers"] },
    { question: "What are Promises and how are they different from Callbacks?", expectedAnswer: "Promises represent future values and avoid 'callback hell' by chaining .then().", keywords: ["promise", "callback", "then", "async", "chain"] },
    { question: "What is a closure? Give a practical use case.", expectedAnswer: "A function retaining access to its outer scope. Used for data privacy/currying.", keywords: ["closure", "scope", "privacy", "currying", "function"] },
    { question: "Explain 'this' keyword behavior in Arrow functions vs Normal functions.", expectedAnswer: "Arrow functions inherit 'this' from surrounding scope; normal functions define 'this' based on caller.", keywords: ["this", "arrow", "function", "scope", "caller"] },
    { question: "What is Hoisting?", expectedAnswer: "Variable and function declarations are moved to the top of their scope during compilation.", keywords: ["hoisting", "declaration", "scope", "compilation"] },
    { question: "Explain Prototypal Inheritance.", expectedAnswer: "Objects inherit properties directly from other objects (prototypes) via the prototype chain.", keywords: ["prototype", "inheritance", "chain", "object"] },
    { question: "Difference between '==' and '==='?", expectedAnswer: "'==' converts types (coercion) before comparing; '===' checks value and type (strict equality).", keywords: ["equality", "coercion", "strict", "type"] },
    { question: "What do bind, call, and apply do?", expectedAnswer: "They change the context of 'this'. Call/Apply invoke immediately; Bind returns a new function.", keywords: ["bind", "call", "apply", "this", "context"] },
    { question: "What is Destructuring Assignment?", expectedAnswer: "Unpacking values from arrays or properties from objects into distinct variables.", keywords: ["destructuring", "array", "object", "unpack", "variable"] },
    { question: "Explain the Spread (...) vs Rest operator.", expectedAnswer: "Spread expands iterables; Rest collects multiple elements into an array.", keywords: ["spread", "rest", "operator", "iterable", "array"] },
    { question: "What is Currying?", expectedAnswer: "Transforming a function with multiple arguments into a sequence of functions taking one argument.", keywords: ["currying", "function", "argument", "sequence"] },
    { question: "Explain Higher Order Functions.", expectedAnswer: "Functions that take other functions as args or return them (e.g., map, filter, reduce).", keywords: ["higher", "order", "function", "map", "filter", "reduce"] },
    { question: "Difference between CommonJS and ES6 Modules?", expectedAnswer: "CommonJS uses require/module.exports (dynamic); ES6 uses import/export (static/analyzable).", keywords: ["commonjs", "es6", "module", "require", "import", "export"] },
    { question: "What is Event Bubbling vs Capturing?", expectedAnswer: "Bubbling propagates events up the DOM; Capturing propagates down. Controlled via addEventListener options.", keywords: ["bubbling", "capturing", "event", "dom", "propagate"] },
    { question: "Difference between LocalStorage, SessionStorage, and Cookies?", expectedAnswer: "Local stays until deleted; Session clears on tab close; Cookies are sent with HTTP requests.", keywords: ["localstorage", "sessionstorage", "cookies", "storage"] },
    { question: "Why use async/await over Promises?", expectedAnswer: "Syntactic sugar that makes asynchronous code look synchronous and easier to read/debug.", keywords: ["async", "await", "promise", "syntactic", "sugar"] },
    { question: "What is Memoization?", expectedAnswer: "Caching results of expensive function calls based on arguments to speed up future calls.", keywords: ["memoization", "cache", "function", "performance"] },
    { question: "What is a Generator Function?", expectedAnswer: "A function that can pause execution (yield) and resume later. Returns an iterator.", keywords: ["generator", "yield", "iterator", "pause", "resume"] },
    { question: "Explain Event Delegation.", expectedAnswer: "Attaching a single listener to a parent element to manage events for all descendants.", keywords: ["event", "delegation", "listener", "parent", "descendant"] },
    { question: "What is 'Strict Mode'?", expectedAnswer: "Enforces stricter parsing/error handling (e.g., prevents accidental globals) using 'use strict'.", keywords: ["strict", "mode", "parsing", "error", "global"] },
    { question: "What are Typed Arrays in JS?", expectedAnswer: "Array-like buffers (Int8Array, Float32Array) for handling raw binary data efficiently.", keywords: ["typed", "array", "buffer", "binary", "int8array"] }
  ],

  React: [
    { question: "What are React Hooks?", expectedAnswer: "Functions that let you use state and lifecycle features in functional components.", keywords: ["hooks", "state", "lifecycle", "functional", "component"] },
    { question: "Scenario: A component is re-rendering too often, causing lag. How do you fix it?", expectedAnswer: "Use React.memo, useMemo/useCallback to cache values/functions, or verify dependency arrays.", keywords: ["rerender", "memo", "usememo", "usecallback", "performance"] },
    { question: "Explain the difference between State and Props.", expectedAnswer: "State is internal/mutable; Props are external/read-only passed from parent.", keywords: ["state", "props", "internal", "external", "mutable"] },
    { question: "When would you use Redux or Context API over local state?", expectedAnswer: "When state needs to be accessed by many completely unrelated components (global state).", keywords: ["redux", "context", "api", "global", "state"] },
    { question: "What is the Virtual DOM and how does it improve performance?", expectedAnswer: "It's a lightweight copy of DOM. React calculates diffs (reconciliation) and updates only changed nodes.", keywords: ["virtual", "dom", "diff", "reconciliation", "performance"] },
    { question: "Scenario: You need to optimize the initial load time of a large React app.", expectedAnswer: "Use Code Splitting (React.lazy/Suspense), minimize bundle size, and optimize assets.", keywords: ["code", "splitting", "lazy", "suspense", "bundle", "optimize"] },
    { question: "What is the useEffect Hook used for?", expectedAnswer: "Handling side effects (fetching data, subscriptions) in functional components.", keywords: ["useeffect", "side", "effect", "fetch", "subscription"] },
    { question: "Dependency Array pitfalls in useEffect?", expectedAnswer: "Omitting dependencies causes stale closures; including objects/arrays without memoization causes loops.", keywords: ["dependency", "array", "stale", "closure", "memoization"] },
    { question: "Difference between useRef and useState?", expectedAnswer: "useRef values persist without triggering re-renders; useState triggers re-render on update.", keywords: ["useref", "usestate", "rerender", "persist"] },
    { question: "What are Higher Order Components (HOC)?", expectedAnswer: "Functions that take a component and return a new enhanced component.", keywords: ["hoc", "higher", "order", "component", "enhance"] },
    { question: "Explain the Render Props pattern.", expectedAnswer: "Sharing code between components using a prop whose value is a function.", keywords: ["render", "props", "pattern", "function", "share"] },
    { question: "What are Error Boundaries?", expectedAnswer: "Components that catch JavaScript errors in their child component tree.", keywords: ["error", "boundary", "catch", "child", "tree"] },
    { question: "What are React Portals?", expectedAnswer: "Way to render children into a DOM node properly outside the parent hierarchy (e.g., Modals).", keywords: ["portal", "render", "dom", "modal", "hierarchy"] },
    { question: "Compare SSR (Server Side Rendering) vs CSR.", expectedAnswer: "SSR sends fully rendered HTML (better SEO/initial load); CSR renders in browser (interactive faster).", keywords: ["ssr", "csr", "server", "client", "rendering", "seo"] },
    { question: "controlled vs uncontrolled components?", expectedAnswer: "Controlled gets value from state; Uncontrolled gets value from Ref (DOM source of truth).", keywords: ["controlled", "uncontrolled", "state", "ref", "dom"] },
    { question: "What is Prop Drilling and how to avoid it?", expectedAnswer: "Passing data through many layers. Avoid via Context API, Redux, or Composition.", keywords: ["prop", "drilling", "context", "redux", "composition"] },
    { question: "What are Custom Hooks?", expectedAnswer: "User-defined hooks to extract reusable logic involving other hooks (e.g., useFetch).", keywords: ["custom", "hook", "reusable", "logic", "usefetch"] },
    { question: "Why are 'keys' important in lists?", expectedAnswer: "They help React identify which items changed, added, or removed. Using index is bad if order changes.", keywords: ["key", "list", "identify", "change", "index"] },
    { question: "What is React Fiber?", expectedAnswer: "The reimplemented reconciliation engine allowing incremental rendering and prioritization.", keywords: ["fiber", "reconciliation", "incremental", "rendering", "priority"] },
    { question: "Explain React.StrictMode.", expectedAnswer: "A tool/wrapper that activates checks/warnings (like double rendering) in development mode.", keywords: ["strictmode", "checks", "warnings", "development"] },
    { question: "Difference between CSS-in-JS and CSS Modules?", expectedAnswer: "CSS-in-JS (Styled Components) scopes styles dynamically; Modules scope via unique class names at build time.", keywords: ["css", "js", "modules", "styled", "components", "scope"] },
    { question: "How do you handle forms in React?", expectedAnswer: "Using strict state control (onChange handlers) or libraries like Formik/React Hook Form.", keywords: ["form", "onchange", "formik", "react", "hook"] }
  ],

  SQL: [
    { question: "What is the difference between INNER JOIN and LEFT JOIN?", expectedAnswer: "Inner join returns matching rows; Left join returns all left rows + matches.", keywords: ["inner", "join", "left", "matching", "rows"] },
    { question: "Scenario: A query is running very slow on a large table. How do you optimize it?", expectedAnswer: "Add Indexes on filtered columns, avoid SELECT *, check execution plan.", keywords: ["index", "optimize", "slow", "execution", "plan"] },
    { question: "Explain ACID properties.", expectedAnswer: "Atomicity, Consistency, Isolation, Durability - ensuring reliable transactions.", keywords: ["acid", "atomicity", "consistency", "isolation", "durability"] },
    { question: "What is Normalization? Why might you purposefully DE-normalize?", expectedAnswer: "Normalization reduces redundancy. Denormalization improves read performance by reducing joins.", keywords: ["normalization", "denormalization", "redundancy", "performance"] },
    { question: "What is an Index? Are there downsides to having too many?", expectedAnswer: "Indexes speed up reads but slow down writes (INSERT/UPDATE) and consume storage.", keywords: ["index", "read", "write", "storage", "performance"] },
    { question: "Difference between WHERE and HAVING clause?", expectedAnswer: "WHERE filters rows before grouping; HAVING filters groups after aggregation.", keywords: ["where", "having", "filter", "group", "aggregation"] },
    { question: "Explain Primary Key vs Foreign Key.", expectedAnswer: "Primary uniquely identifies a row; Foreign links to a Primary Key in another table (enforces integrity).", keywords: ["primary", "key", "foreign", "integrity", "unique"] },
    { question: "Stored Procedures vs Functions in SQL?", expectedAnswer: "Procs can perform actions/transactions; Functions must return a value and cannot change DB state.", keywords: ["stored", "procedure", "function", "transaction", "return"] },
    { question: "What is a Database Trigger?", expectedAnswer: "Code that automatically runs in response to specific events (INSERT, UPDATE) on a table.", keywords: ["trigger", "event", "insert", "update", "automatic"] },
    { question: "Difference between View and Materialized View?", expectedAnswer: "View is a virtual query (runs every time); Materialized stores the result physically (needs refreshing).", keywords: ["view", "materialized", "virtual", "physical", "refresh"] },
    { question: "Explain UNION vs UNION ALL.", expectedAnswer: "UNION removes duplicates; UNION ALL keeps duplicates (faster).", keywords: ["union", "all", "duplicate", "faster"] },
    { question: "Clustered vs Non-Clustered Index?", expectedAnswer: "Clustered stores data physically in order (only 1 per table); Non-Clustered is a separate pointer list.", keywords: ["clustered", "non-clustered", "index", "physical", "pointer"] },
    { question: "What are Transaction Isolation Levels?", expectedAnswer: "Read Uncommitted, Read Committed, Repeatable Read, Serializable (trade-off between consistency and concurrency).", keywords: ["isolation", "level", "read", "committed", "serializable"] },
    { question: "What is a Self Join?", expectedAnswer: "Joining a table with itself, useful for hierarchical data (e.g., Employee Manager relationship).", keywords: ["self", "join", "hierarchical", "employee", "manager"] },
    { question: "Explain Window Functions like RANK() or ROW_NUMBER().", expectedAnswer: "Perform calculations across a set of table rows related to the current row without grouping.", keywords: ["window", "function", "rank", "row_number", "partition"] },
    { question: "What is a CTE (Common Table Expression)?", expectedAnswer: "A temporary result set named in a WITH clause, improving readability over subqueries.", keywords: ["cte", "common", "table", "expression", "with"] },
    { question: "How to prevent SQL Injection?", expectedAnswer: "Use Parameterized Queries (Prepared Statements) or ORMs; never concatenate user input.", keywords: ["sql", "injection", "parameterized", "prepared", "statement"] },
    { question: "Sharding vs Partitioning?", expectedAnswer: "sharding distributes data across multiple servers; Partitioning splits a table within a single database.", keywords: ["sharding", "partitioning", "distribute", "server", "split"] },
    { question: "NoSQL vs SQL trade-offs?", expectedAnswer: "SQL = Structured, ACID, Scaling Up. NoSQL = Flexible schema, BASE, Scaling Out.", keywords: ["nosql", "sql", "acid", "base", "schema", "scaling"] },
    { question: "What is the N+1 problem?", expectedAnswer: "Fetching parent then fetching children individually (N queries) instead of 1 join query.", keywords: ["n+1", "problem", "query", "join", "fetch"] },
    { question: "DELETE vs TRUNCATE vs DROP?", expectedAnswer: "DELETE removes rows (loggable); TRUNCATE resets table (fast); DROP deletes table structure.", keywords: ["delete", "truncate", "drop", "rows", "table"] },
    { question: "Difference between COALESCE and ISNULL?", expectedAnswer: "COALESCE returns first non-null argument (standard SQL); ISNULL is engine specific (often 2 args).", keywords: ["coalesce", "isnull", "null", "argument"] },
    { question: "When might a Subquery be faster than a Join?", expectedAnswer: "Sometimes, when the subquery can filter massive data early (though optimizers often treat them similarly).", keywords: ["subquery", "join", "filter", "optimizer", "performance"] }
  ],

  Machine_Learning: [
    { question: "What is the difference between Supervised and Unsupervised learning?", expectedAnswer: "Supervised uses labeled data; Unsupervised uses unlabeled data to find patterns.", keywords: ["supervised", "unsupervised", "labeled", "unlabeled", "pattern"] },
    { question: "Scenario: Your model has high accuracy on training data but low on test data. What is happening?", expectedAnswer: "Overfitting. Fix by adding data, regularization, or simplifying the model.", keywords: ["overfitting", "accuracy", "training", "test", "regularization"] },
    { question: "Explain the Bias-Variance tradeoff.", expectedAnswer: "Balancing error from erroneous assumptions (bias) vs sensitivity to noise (variance).", keywords: ["bias", "variance", "tradeoff", "error", "noise"] },
    { question: "How do you handle an imbalanced dataset (e.g., 99% benign, 1% fraud)?", expectedAnswer: "Resampling (SMOTE/undersampling), changing metrics (F1/Precision/Recall instead of Accuracy).", keywords: ["imbalanced", "smote", "resampling", "precision", "recall"] },
    { question: "Scenario: How would you select features if you have 1000 noisy features?", expectedAnswer: "Use L1 regularization (Lasso), Feature Importance (Random Forest), or PCA.", keywords: ["feature", "selection", "lasso", "l1", "pca", "importance"] },
    { question: "What is a Confusion Matrix?", expectedAnswer: "A table showing True Positives, False Positives, etc., to evaluate classification.", keywords: ["confusion", "matrix", "true", "positive", "false", "classification"] },
    { question: "Explain Precision vs Recall.", expectedAnswer: "Precision = Correct Positives / All Predicted Positives. Recall = Correct Positives / All Actual Positives.", keywords: ["precision", "recall", "positive", "predicted", "actual"] },
    { question: "What is ROC Curve and AUC?", expectedAnswer: "ROC plots TPR vs FPR. AUC measures separability (1.0 is perfect).", keywords: ["roc", "curve", "auc", "tpr", "fpr", "separability"] },
    { question: "What is Cross-Validation (K-Fold)?", expectedAnswer: "Splitting data into K parts, training on K-1 and testing on 1, K times. Reduces variance.", keywords: ["cross", "validation", "k-fold", "split", "variance"] },
    { question: "Difference between L1 and L2 Regularization?", expectedAnswer: "L1 (Lasso) shrinks weights to zero (feature selection); L2 (Ridge) shrinks weights evenly.", keywords: ["l1", "l2", "lasso", "ridge", "regularization", "weights"] },
    { question: "Gradient Descent vs Stochastic Gradient Descent (SGD)?", expectedAnswer: "GD updates using whole dataset; SGD updates using single sample (faster, noisier).", keywords: ["gradient", "descent", "sgd", "stochastic", "update"] },
    { question: "Bagging vs Boosting?", expectedAnswer: "Bagging (Random Forest) trains in parallel to reduce variance; Boosting (XGBoost) trains sequentially to reduce bias.", keywords: ["bagging", "boosting", "random", "forest", "xgboost", "variance"] },
    { question: "How does a Support Vector Machine (SVM) work?", expectedAnswer: "Finds the hyperplane that maximizes the margin between classes. Uses Kernel trick for non-linear.", keywords: ["svm", "support", "vector", "hyperplane", "margin", "kernel"] },
    { question: "What is K-Means Clustering?", expectedAnswer: "Partitioning n observations into k clusters where each belongs to the cluster with the nearest mean.", keywords: ["k-means", "clustering", "partition", "centroid", "mean"] },
    { question: "Explain PCA (Principal Component Analysis).", expectedAnswer: "Dimensionality reduction technique projecting data onto orthogonal axes measuring max variance.", keywords: ["pca", "principal", "component", "dimensionality", "variance"] },
    { question: "Assumption of Naive Bayes?", expectedAnswer: "Features are independent of each other (often false, but works well).", keywords: ["naive", "bayes", "independent", "feature", "assumption"] },
    { question: "How to handle Missing Data?", expectedAnswer: "Imputation (mean/median), dropping rows, or using algorithms that handle nulls.", keywords: ["missing", "data", "imputation", "mean", "median", "null"] },
    { question: "Normalization vs Standardization?", expectedAnswer: "Normalization scales to [0,1]; Standardization scales to Mean=0, Std=1.", keywords: ["normalization", "standardization", "scale", "mean", "std"] },
    { question: "Grid Search vs Random Search for Hyperparameters?", expectedAnswer: "Grid checks all combinations (slow); Random samples combinations (faster, often finds good enough).", keywords: ["grid", "search", "random", "hyperparameter", "combination"] },
    { question: "Advantages of XGBoost/LightGBM?", expectedAnswer: "Handling missing values, tree pruning, parallel processing, regularization.", keywords: ["xgboost", "lightgbm", "pruning", "parallel", "regularization"] },
    { question: "What is Collaborative Filtering?", expectedAnswer: "Recommendation technique based on past user-item interactions (User-based or Item-based).", keywords: ["collaborative", "filtering", "recommendation", "user", "item"] },
    { question: "Explain the F1 Score.", expectedAnswer: "Harmonic mean of Precision and Recall. Good for imbalanced datasets.", keywords: ["f1", "score", "harmonic", "precision", "recall"] },
    { question: "What is A/B Testing?", expectedAnswer: "Comparing two versions against each other to determine which performs better.", keywords: ["ab", "testing", "compare", "version", "experiment"] }
  ],

  Deep_Learning: [
    { question: "What is Backpropagation?", expectedAnswer: "Algorithm for training NNs by calculating gradients of loss with respect to weights.", keywords: ["backpropagation", "gradient", "loss", "weights", "training"] },
    { question: "Scenario: Your neural network loss is not decreasing. What could be wrong?", expectedAnswer: "Learning rate too high/low, bad initialization, or incorrect data preprocessing.", keywords: ["loss", "learning", "rate", "initialization", "preprocessing"] },
    { question: "Explain Dropout and why it works.", expectedAnswer: "Randomly disabling neurons during training to force the network to learn robust features (reduces overfitting).", keywords: ["dropout", "neuron", "overfitting", "robust", "training"] },
    { question: "What is the difference between a CNN and an RNN?", expectedAnswer: "CNNs use spatial features (images); RNNs use temporal/sequential features (text/time-series).", keywords: ["cnn", "rnn", "spatial", "temporal", "sequential"] },
    { question: "What is the vanishing gradient problem?", expectedAnswer: "Gradients become zero in deep layers, stopping learning. Fix with ReLU or LSTM/ResNets.", keywords: ["vanishing", "gradient", "deep", "relu", "lstm", "resnet"] },
    { question: "Explain Activation Functions (ReLU vs Sigmoid).", expectedAnswer: "Sigmoid squashes to [0,1] (vanishing gradient risk). ReLU outputs input if >0 (sparse, efficient).", keywords: ["activation", "relu", "sigmoid", "function", "squash"] },
    { question: "What is Batch Normalization?", expectedAnswer: "Normalizing layer inputs to mean 0, var 1 per batch. Speeds up training and stabilizes gradients.", keywords: ["batch", "normalization", "layer", "mean", "variance"] },
    { question: "Difference between Xavier and He Initialization?", expectedAnswer: "Xavier is for Sigmoid/Tanh; He is optimized for ReLU to prevent signal dying out.", keywords: ["xavier", "he", "initialization", "sigmoid", "relu"] },
    { question: "Compare Adam vs SGD with Momentum.", expectedAnswer: "Adam adapts learning rates per parameter; SGD Momentum accelerates in relevant direction.", keywords: ["adam", "sgd", "momentum", "optimizer", "learning", "rate"] },
    { question: "What is Padding and Stride in CNN?", expectedAnswer: "Padding adds border pixels (keeps size); Stride is step size of filter (reduces size).", keywords: ["padding", "stride", "cnn", "filter", "convolution"] },
    { question: "Max Pooling vs Average Pooling?", expectedAnswer: "Max selects sharpest feature; Average smooths out features.", keywords: ["max", "pooling", "average", "feature", "downsample"] },
    { question: "What is Transfer Learning?", expectedAnswer: "Using a pre-trained model (e.g., ResNet on ImageNet) and fine-tuning it for a new task.", keywords: ["transfer", "learning", "pretrained", "finetune", "resnet"] },
    { question: "LSTM vs GRU?", expectedAnswer: "LSTM has 3 gates (forget, input, output); GRU has 2 (reset, update). GRU is faster/simpler.", keywords: ["lstm", "gru", "gate", "forget", "reset", "recurrent"] },
    { question: "Explain Attention Mechanism.", expectedAnswer: "Allows model to focus on specific parts of input sequence regardless of distance.", keywords: ["attention", "mechanism", "focus", "sequence", "transformer"] },
    { question: "BERT vs GPT architecture?", expectedAnswer: "BERT is Encoder-only (bidirectional, understanding); GPT is Decoder-only (unidirectional, generation).", keywords: ["bert", "gpt", "encoder", "decoder", "bidirectional"] },
    { question: "What is an Autoencoder?", expectedAnswer: "NN that compresses input to latent space and reconstructs it. Used for denoising/dimensionality reduction.", keywords: ["autoencoder", "latent", "space", "compress", "reconstruct"] },
    { question: "Explain GANs (Generative Adversarial Networks).", expectedAnswer: "Two networks (Generator vs Discriminator) competing. Generator creates fakes; Discriminator detects them.", keywords: ["gan", "generative", "adversarial", "generator", "discriminator"] },
    { question: "Exploding Gradient Problem?", expectedAnswer: "Gradients get too large, creating NaN weights. Fix with Gradient Clipping.", keywords: ["exploding", "gradient", "nan", "clipping", "weights"] },
    { question: "What are Skip Connections (ResNet)?", expectedAnswer: "Adding input directly to deeper layer output. Solves vanishing gradient in deep nets.", keywords: ["skip", "connection", "resnet", "residual", "deep"] },
    { question: "CrossEntropy vs MSE Loss?", expectedAnswer: "CrossEntropy for classification (probability distance); MSE for regression (value distance).", keywords: ["crossentropy", "mse", "loss", "classification", "regression"] },
    { question: "What are Word Embeddings (Word2Vec/GloVe)?", expectedAnswer: "Vector representations of words where similar meanings are close in space.", keywords: ["word", "embedding", "word2vec", "glove", "vector"] },
    { question: "Explain Temperature in Softmax.", expectedAnswer: "Controls randomness. High temp = flat distribution (creative); Low temp = peaked (confident).", keywords: ["temperature", "softmax", "distribution", "randomness"] },
    { question: "Epoch vs Batch vs Iteration?", expectedAnswer: "Epoch = 1 pass of full dataset; Batch = subset processed at once; Iteration = 1 step of gradient update.", keywords: ["epoch", "batch", "iteration", "dataset", "gradient"] },
    { question: "What is Model Quantization?", expectedAnswer: "Reducing precision of weights (float32 -> int8) to reduce model size/latency.", keywords: ["quantization", "precision", "float32", "int8", "compression"] }
  ]
};

/**
 * Seed the question bank if empty
 */
async function seedQuestionBank() {
  try {
    const existingCount = await Question.countDocuments();
    
    if (existingCount > 0) {
      console.log(`📚 Question bank already seeded with ${existingCount} questions`);
      return;
    }

    console.log('📚 Seeding question bank...');
    
    const questions = [];
    
    for (const [topic, topicQuestions] of Object.entries(QUESTION_REPO)) {
      for (const q of topicQuestions) {
        questions.push({
          topic,
          question: q.question,
          expectedAnswer: q.expectedAnswer,
          keywords: q.keywords,
          difficulty: 'medium',
          isActive: true
        });
      }
    }

    await Question.insertMany(questions);
    console.log(`✅ Seeded ${questions.length} questions across ${Object.keys(QUESTION_REPO).length} topics`);
    
  } catch (error) {
    console.error('❌ Error seeding question bank:', error);
    throw error;
  }
}

module.exports = { seedQuestionBank, QUESTION_REPO };
