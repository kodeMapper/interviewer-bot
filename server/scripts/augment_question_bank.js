/**
 * Augment MongoDB question bank with high-quality questions.
 * Inserts 50 new questions per topic (7 topics => 350 total) with duplicate protection.
 */

const path = require('path');
const dotenv = require('dotenv');

// Ensure server/.env is loaded when running from repo root.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { connectDatabase, disconnectDB } = require('../src/config/database');
const Question = require('../src/models/Question');

const TOPICS = ['Java', 'Python', 'JavaScript', 'React', 'SQL', 'Machine_Learning', 'Deep_Learning'];
const TARGET_NEW_PER_TOPIC = 50;

const SYSTEM_CONTEXTS = [
  'high-traffic e-commerce API',
  'real-time analytics pipeline',
  'multi-tenant SaaS platform',
  'interview evaluation backend',
  'notification processing service',
  'payment reconciliation workflow',
  'search and recommendation module',
  'resume parsing and scoring pipeline',
  'admin dashboard reporting stack',
  'batch processing data platform',
];

const FAILURE_MODES = [
  'latency spike under peak load',
  'memory growth after release',
  'inconsistent output for edge cases',
  'intermittent timeout errors',
  'high CPU usage in production',
  'duplicate processing after retry',
  'data drift impacting quality',
  'stale cache and incorrect responses',
  'race condition in concurrent requests',
  'failed rollback after bad deployment',
];

const TOPIC_KNOWLEDGE = {
  Java: {
    concepts: ['JVM memory model', 'Garbage Collector tuning', 'Thread pool sizing', 'JPA fetch strategies', 'Spring transaction propagation', 'ConcurrentHashMap behavior', 'Java Streams parallelism', 'JIT optimization', 'Exception hierarchy design', 'Immutable object design'],
    patterns: ['Builder pattern', 'Factory pattern', 'Strategy pattern', 'Observer pattern', 'Dependency Injection', 'Circuit Breaker'],
    tradeoffs: ['latency vs throughput', 'memory vs speed', 'consistency vs availability', 'simplicity vs flexibility', 'readability vs micro-optimization'],
  },
  Python: {
    concepts: ['GIL impact', 'asyncio event loop', 'generator pipelines', 'NumPy vectorization', 'Pandas memory optimization', 'decorator usage', 'context manager design', 'multiprocessing queues', 'FastAPI dependency injection', 'type hinting strategy'],
    patterns: ['factory function', 'adapter pattern', 'repository pattern', 'caching decorator', 'retry wrapper'],
    tradeoffs: ['readability vs performance', 'CPU vs I/O concurrency', 'memory vs convenience', 'strict typing vs rapid iteration'],
  },
  JavaScript: {
    concepts: ['event loop phases', 'Promise chaining', 'microtask vs macrotask', 'closure memory leaks', 'module bundling', 'tree shaking', 'debounce vs throttle', 'prototype chain lookup', 'error boundary in async flows', 'runtime type safety'],
    patterns: ['pub-sub pattern', 'module pattern', 'middleware chain', 'state reducer', 'command pattern'],
    tradeoffs: ['bundle size vs features', 'SSR vs CSR', 'runtime checks vs performance', 'developer speed vs robustness'],
  },
  React: {
    concepts: ['render reconciliation', 'useEffect dependency stability', 'state normalization', 'memoization boundaries', 'context re-render control', 'suspense loading states', 'code splitting', 'form state management', 'optimistic UI updates', 'error boundaries'],
    patterns: ['container-presentational split', 'custom hooks', 'compound components', 'render props', 'state machine driven UI'],
    tradeoffs: ['local state vs global state', 'DX vs performance', 'abstraction vs clarity', 'consistency vs flexibility'],
  },
  SQL: {
    concepts: ['index selectivity', 'query execution plans', 'transaction isolation', 'locking behavior', 'window functions', 'CTE optimization', 'partitioning strategy', 'materialized view refresh', 'normalization depth', 'deadlock handling'],
    patterns: ['star schema', 'audit table design', 'upsert strategy', 'soft delete pattern', 'idempotent migration'],
    tradeoffs: ['read speed vs write speed', 'normalization vs denormalization', 'strict constraints vs agility', 'storage vs query cost'],
  },
  Machine_Learning: {
    concepts: ['bias-variance control', 'feature engineering', 'class imbalance handling', 'cross-validation strategy', 'precision-recall tradeoff', 'model calibration', 'data leakage prevention', 'drift monitoring', 'error analysis workflow', 'hyperparameter search'],
    patterns: ['stacking ensemble', 'blending ensemble', 'feature store usage', 'time-aware validation', 'cost-sensitive learning'],
    tradeoffs: ['accuracy vs interpretability', 'training time vs performance', 'recall vs precision', 'complexity vs maintainability'],
  },
  Deep_Learning: {
    concepts: ['vanishing gradients', 'batch normalization', 'weight initialization', 'dropout regularization', 'learning rate scheduling', 'gradient clipping', 'transfer learning', 'attention mechanism', 'model quantization', 'early stopping'],
    patterns: ['encoder-decoder', 'residual blocks', 'multi-head attention', 'teacher forcing', 'two-stage fine-tuning'],
    tradeoffs: ['model size vs latency', 'accuracy vs cost', 'stability vs speed', 'generalization vs memorization'],
  },
};

function cleanKeyword(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);
}

function makeQuestion(topic, concept, pattern, tradeoff, context, failure, idx) {
  const qType = idx % 5;
  const scenarioId = idx + 1;

  if (qType === 0) {
    return {
      question: `[Scenario ${scenarioId}] In a ${topic} ${context}, how would you apply ${concept} and monitor ${failure} before it impacts users?`,
      expectedAnswer: `Candidate should explain practical use of ${concept} in ${context}, identify a realistic failure mode like ${failure}, and describe observability metrics/alerts.`,
    };
  }

  if (qType === 1) {
    return {
      question: `[Scenario ${scenarioId}] In your ${topic} ${context}, you used ${pattern}. Why choose it, and which alternative would you reject under ${failure}?`,
      expectedAnswer: `Candidate should justify ${pattern} for ${context}, compare with an alternative, and discuss maintainability/performance implications under ${failure}.`,
    };
  }

  if (qType === 2) {
    return {
      question: `[Scenario ${scenarioId}] Suppose your ${topic} ${context} hits ${failure}. How would you investigate using ${concept}?`,
      expectedAnswer: `Candidate should propose a structured debugging plan using ${concept} in ${context}, include measurements, and define rollback/mitigation for ${failure}.`,
    };
  }

  if (qType === 3) {
    return {
      question: `[Scenario ${scenarioId}] For ${topic} in ${context}, explain tradeoff ${tradeoff} and your decision criteria when ${failure} appears.`,
      expectedAnswer: `Candidate should define both sides of ${tradeoff}, provide a concrete scenario in ${context}, and state decision criteria under ${failure}.`,
    };
  }

  return {
    question: `[Scenario ${scenarioId}] If you had to redesign a ${topic} module for ${context}, what would you change around ${concept} and why?`,
    expectedAnswer: `Candidate should propose a redesign around ${concept}, discuss risk reduction against ${failure}, and mention measurable impact.`,
  };
}

function generateTopicQuestions(topic, count, startOffset = 0) {
  const knowledge = TOPIC_KNOWLEDGE[topic];
  const out = [];
  let i = startOffset;

  while (out.length < count) {
    const concept = knowledge.concepts[i % knowledge.concepts.length];
    const pattern = knowledge.patterns[i % knowledge.patterns.length];
    const tradeoff = knowledge.tradeoffs[i % knowledge.tradeoffs.length];
    const context = SYSTEM_CONTEXTS[i % SYSTEM_CONTEXTS.length];
    const failure = FAILURE_MODES[(i * 3) % FAILURE_MODES.length];
    const qa = makeQuestion(topic, concept, pattern, tradeoff, context, failure, i);

    const keywords = Array.from(
      new Set([
        ...cleanKeyword(concept),
        ...cleanKeyword(pattern),
        ...cleanKeyword(tradeoff),
        ...cleanKeyword(context),
        ...cleanKeyword(failure),
      ])
    );

    out.push({
      topic,
      question: qa.question,
      expectedAnswer: qa.expectedAnswer,
      keywords,
      difficulty: i % 3 === 0 ? 'hard' : i % 3 === 1 ? 'medium' : 'easy',
      isActive: true,
    });

    i += 1;
  }

  return out;
}

async function main() {
  await connectDatabase();

  try {
    let grandInserted = 0;

    for (const topic of TOPICS) {
      const existing = await Question.find({ topic }, { question: 1 }).lean();
      const seen = new Set(existing.map((x) => x.question.trim().toLowerCase()));
      const startOffset = existing.length + 1;

      const candidates = generateTopicQuestions(topic, TARGET_NEW_PER_TOPIC * 12, startOffset);
      const toInsert = [];

      for (const c of candidates) {
        const key = c.question.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          toInsert.push(c);
        }
        if (toInsert.length >= TARGET_NEW_PER_TOPIC) {
          break;
        }
      }

      if (toInsert.length < TARGET_NEW_PER_TOPIC) {
        throw new Error(`Could only generate ${toInsert.length} unique questions for ${topic}`);
      }

      const inserted = await Question.insertMany(toInsert, { ordered: false });
      grandInserted += inserted.length;
      console.log(`[${topic}] inserted=${inserted.length}`);
    }

    const total = await Question.countDocuments();
    console.log(`Done. Inserted total=${grandInserted}. Current question count=${total}`);
  } finally {
    await disconnectDB();
  }
}

main().catch(async (err) => {
  console.error('augment_question_bank failed:', err.message);
  try {
    await disconnectDB();
  } catch (_) {}
  process.exit(1);
});
