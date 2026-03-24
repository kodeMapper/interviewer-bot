"""
Augment and rebalance interview_intents.json for intent MLP training.
- Increases dataset size with high-quality, consistent labeled samples.
- Balances class counts to a target per label.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import random
from datetime import datetime

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "interview_intents.json")

TOPIC_POOLS = {
    "Java": {
        "core": ["oop", "jvm", "garbage collection", "multithreading", "collections", "exception handling", "stream api", "spring boot", "jpa", "concurrency"],
        "verbs": ["implemented", "optimized", "debugged", "designed", "refactored", "deployed"],
    },
    "Python": {
        "core": ["pandas", "numpy", "fastapi", "django", "flask", "decorators", "generators", "virtualenv", "asyncio", "data analysis"],
        "verbs": ["implemented", "automated", "analyzed", "debugged", "prototyped", "deployed"],
    },
    "JavaScript": {
        "core": ["event loop", "promises", "async await", "closures", "dom", "typescript", "node.js", "modules", "fetch api", "hoisting"],
        "verbs": ["implemented", "debugged", "optimized", "built", "refactored", "integrated"],
    },
    "React": {
        "core": ["hooks", "state management", "redux", "context api", "component lifecycle", "memoization", "react router", "forms", "suspense", "code splitting"],
        "verbs": ["implemented", "optimized", "built", "refactored", "debugged", "integrated"],
    },
    "SQL": {
        "core": ["joins", "indexing", "transactions", "normalization", "window functions", "query optimization", "cte", "stored procedures", "constraints", "execution plan"],
        "verbs": ["optimized", "designed", "wrote", "debugged", "migrated", "maintained"],
    },
    "Machine_Learning": {
        "core": ["feature engineering", "cross validation", "class imbalance", "random forest", "xgboost", "model evaluation", "precision recall", "hyperparameter tuning", "data leakage", "baseline model"],
        "verbs": ["trained", "evaluated", "improved", "validated", "tuned", "deployed"],
    },
    "Deep_Learning": {
        "core": ["cnn", "rnn", "lstm", "backpropagation", "dropout", "batch normalization", "learning rate scheduling", "transfer learning", "pytorch", "gradient clipping"],
        "verbs": ["trained", "fine tuned", "optimized", "debugged", "evaluated", "deployed"],
    },
}

TEMPLATES = [
    "i {verb} a {topic} project using {c1} and {c2}",
    "my hands on work in {topic} includes {c1}, {c2}, and production debugging",
    "in {topic}, i focused on {c1} to improve reliability and {c2} for performance",
    "i used {topic} in real projects, mainly around {c1} and {c2}",
    "for interview prep in {topic}, i revised {c1}, {c2}, and practical implementation",
    "i am confident in {topic} concepts such as {c1} and {c2}",
]


def normalize_text(text: str) -> str:
    return " ".join(text.lower().strip().split())


def generate_samples_for_topic(topic: str, needed: int, seen: set[str], seed: int) -> list[dict]:
    rnd = random.Random(seed)
    pool = TOPIC_POOLS[topic]
    generated = []

    # Generate enough candidates deterministically but with variety.
    attempts = 0
    while len(generated) < needed and attempts < needed * 200:
        attempts += 1
        c1, c2 = rnd.sample(pool["core"], 2)
        verb = rnd.choice(pool["verbs"])
        template = rnd.choice(TEMPLATES)
        text = template.format(topic=topic.lower().replace("_", " "), c1=c1, c2=c2, verb=verb)
        key = normalize_text(text)

        if key in seen:
            continue

        seen.add(key)
        generated.append({"text": text, "label": [topic]})

    if len(generated) < needed:
        raise RuntimeError(f"Could not generate enough unique samples for {topic}. Needed={needed}, got={len(generated)}")

    return generated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-per-label", type=int, default=120, help="Target final sample count per label")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    counts = collections.Counter()
    seen = set()
    for row in data:
        seen.add(normalize_text(row["text"]))
        for lb in row.get("label", []):
            counts[lb] += 1

    additions = []
    for topic in TOPIC_POOLS:
        need = max(0, args.target_per_label - counts[topic])
        if need > 0:
            samples = generate_samples_for_topic(topic, need, seen, seed=args.seed + hash(topic) % 1000)
            additions.extend(samples)
            counts[topic] += len(samples)

    if not additions:
        print("Dataset already meets target per label. No changes made.")
        return

    backup_path = DATA_PATH + f".bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    with open(backup_path, "w", encoding="utf-8") as bf:
        json.dump(data, bf, ensure_ascii=False, indent=2)

    data.extend(additions)

    with open(DATA_PATH, "w", encoding="utf-8") as wf:
        json.dump(data, wf, ensure_ascii=False, indent=2)

    print(f"Backup written: {backup_path}")
    print(f"Added samples: {len(additions)}")
    print(f"New total: {len(data)}")
    print(f"Final label counts: {dict(counts)}")


if __name__ == "__main__":
    main()
