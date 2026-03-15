/**
 * Answer Service
 * Answer evaluation and keyword extraction
 * Migrated from Python answer_evaluator.py
 */

const axios = require('axios');
const { config } = require('../config/environment');

// Common words to ignore when extracting keywords
const COMMON_IGNORE_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'must', 'shall', 'need', 'dare',
  'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'beneath', 'under',
  'above', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
  'either', 'neither', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'also', 'now', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'any', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me',
  'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our',
  'their', 'what', 'which', 'who', 'whom', 'whose', 'if', 'then',
  'else', 'because', 'while', 'although', 'though', 'unless',
  'until', 'before', 'after', 'since', 'during', 'through'
]);

/**
 * Evaluate user answer against expected answer
 * Uses ML microservice for embedding-based similarity
 */
async function evaluate(userAnswer, expectedAnswer, keywords = []) {
  try {
    // Handle null/undefined inputs
    if (!userAnswer) userAnswer = '';
    if (!expectedAnswer) expectedAnswer = '';
    
    // Basic preprocessing
    const cleanUserAnswer = userAnswer.trim().toLowerCase();
    const cleanExpectedAnswer = expectedAnswer.trim().toLowerCase();

    // Quick check for empty or very short answers
    if (cleanUserAnswer.length < 5) {
      return {
        score: 0,
        feedback: 'Your answer was too short. Please provide more detail.',
        showCorrect: true
      };
    }

    // Check for "I don't know" type responses
    const dontKnowPatterns = [
      "i don't know", "i dont know", "no idea", "not sure",
      "skip", "pass", "next question", "can't answer"
    ];
    
    if (dontKnowPatterns.some(pattern => cleanUserAnswer.includes(pattern))) {
      return {
        score: 0,
        feedback: "That's okay! Let me tell you the answer.",
        showCorrect: true
      };
    }

    // Try to use ML service for semantic similarity
    let semanticScore = 0;
    try {
      console.log(`🎯 Evaluating answer via ML service: ${config.mlServiceUrl}/evaluate`);
      const response = await axios.post(
        `${config.mlServiceUrl}/evaluate`,
        {
          user_answer: userAnswer,
          expected_answer: expectedAnswer,
          keywords: keywords
        },
        { timeout: 2000 } // Reduced timeout for faster fallback
      );
      semanticScore = response.data.score || 0;
      console.log(`🎯 ML service score: ${semanticScore}`);
    } catch (mlError) {
      // Fallback to keyword-based scoring if ML service is unavailable
      console.log('⚠️ ML service unavailable, using fallback evaluation:', mlError.message);
      semanticScore = keywordBasedScore(cleanUserAnswer, cleanExpectedAnswer, keywords);
    }

    // Generate feedback based on score
    const feedback = generateFeedback(semanticScore, keywords, cleanUserAnswer);

    return {
      score: Math.round(semanticScore),
      feedback,
      showCorrect: semanticScore < 60
    };
  } catch (error) {
    console.error('Error evaluating answer:', error);
    // Return a neutral score on error
    return {
      score: 50,
      feedback: 'Could not fully evaluate your answer, but you made some good points.',
      showCorrect: false
    };
  }
}

/**
 * Fallback keyword-based scoring when ML service is unavailable
 */
function keywordBasedScore(userAnswer, expectedAnswer, keywords) {
  let score = 0;
  const userWords = new Set(userAnswer.split(/\s+/));
  const expectedWords = new Set(expectedAnswer.split(/\s+/));

  // Check keyword matches (40% weight)
  if (keywords.length > 0) {
    const matchedKeywords = keywords.filter(k => 
      userAnswer.includes(k.toLowerCase())
    );
    score += (matchedKeywords.length / keywords.length) * 40;
  }

  // Check word overlap (30% weight)
  const overlap = [...userWords].filter(w => 
    expectedWords.has(w) && !COMMON_IGNORE_WORDS.has(w)
  );
  const significantExpected = [...expectedWords].filter(w => !COMMON_IGNORE_WORDS.has(w));
  if (significantExpected.length > 0) {
    score += (overlap.length / significantExpected.length) * 30;
  }

  // Length bonus (15% weight) - reward detailed answers
  const expectedLength = expectedAnswer.length;
  const userLength = userAnswer.length;
  if (userLength >= expectedLength * 0.5) {
    score += 15;
  } else if (userLength >= expectedLength * 0.25) {
    score += 7.5;
  }

  // Coherence bonus (15% weight) - basic check for sentence structure
  if (userAnswer.includes(' ') && userAnswer.length > 20) {
    score += 15;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Generate feedback message based on score
 */
function generateFeedback(score, keywords, userAnswer) {
  if (score >= 85) {
    return 'Excellent! You demonstrated a thorough understanding of the concept.';
  }
  
  if (score >= 70) {
    return 'Good answer! You covered the main points well.';
  }
  
  if (score >= 50) {
    // Find missing keywords
    const missingKeywords = keywords.filter(k => !userAnswer.includes(k.toLowerCase()));
    if (missingKeywords.length > 0) {
      return `Decent answer, but you could have mentioned: ${missingKeywords.slice(0, 3).join(', ')}.`;
    }
    return 'Partial answer. Consider adding more specific details.';
  }
  
  if (score >= 30) {
    return 'Your answer was on the right track but missed some key concepts.';
  }
  
  return 'This answer needs improvement. Review the concept and try to be more specific.';
}

/**
 * Extract keywords from user answer for counter-questioning
 */
function extractKeywords(text) {
  // Technical terms that might be interesting for follow-up questions
  const technicalPatterns = [
    /\b[A-Z][a-zA-Z]*(?:Service|Controller|Manager|Factory|Builder|Pattern|Algorithm)\b/g,
    /\b(?:API|REST|GraphQL|SQL|NoSQL|AWS|Azure|GCP|Docker|Kubernetes)\b/gi,
    /\b(?:React|Angular|Vue|Node|Express|Django|Flask|Spring)\b/gi,
    /\b(?:MongoDB|PostgreSQL|MySQL|Redis|Elasticsearch)\b/gi,
    /\b(?:microservices?|serverless|distributed|scalable|async|concurrent)\b/gi
  ];

  const keywords = new Set();
  
  technicalPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(m => keywords.add(m.toLowerCase()));
  });

  // Also extract capitalized terms (likely proper nouns or tech terms)
  const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) || [];
  capitalizedWords.forEach(w => keywords.add(w.toLowerCase()));

  // Extract words that appear in technical context
  const words = text.toLowerCase().split(/\s+/);
  words.forEach(word => {
    if (word.length > 4 && !COMMON_IGNORE_WORDS.has(word)) {
      // Check if it looks like a technical term
      if (/^[a-z]+(?:ing|tion|ment|ness|ity|ize|ify)$/.test(word)) {
        keywords.add(word);
      }
    }
  });

  return [...keywords].slice(0, 10);
}

/**
 * Check if answer mentions a concept that could be explored further
 */
function findFollowUpOpportunities(userAnswer) {
  const opportunities = [];
  
  // Patterns that suggest deeper knowledge
  const patterns = [
    { regex: /(?:use|using|used)\s+(\w+)/gi, type: 'technology' },
    { regex: /(?:implement|implementing|implemented)\s+(\w+)/gi, type: 'implementation' },
    { regex: /(?:like|such as|for example)\s+(\w+)/gi, type: 'example' },
    { regex: /(?:because|since|due to)\s+(.+?)(?:\.|,|$)/gi, type: 'reasoning' }
  ];

  patterns.forEach(({ regex, type }) => {
    let match;
    while ((match = regex.exec(userAnswer)) !== null) {
      opportunities.push({
        type,
        term: match[1].trim(),
        context: match[0]
      });
    }
  });

  return opportunities.slice(0, 3);
}

module.exports = {
  evaluate,
  extractKeywords,
  findFollowUpOpportunities,
  keywordBasedScore,
  COMMON_IGNORE_WORDS
};
