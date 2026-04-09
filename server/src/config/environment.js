/**
 * Environment Configuration
 * Loads and validates environment variables
 */

require('dotenv').config();

// Some platforms restrict env-var keys to alphanumeric characters only.
// Support both styles: FOO_BAR and FOOBAR.
const rawMongoUri = process.env.MONGODB_URI || process.env.MONGODBURI;
const rawClientUrl = process.env.CLIENT_URL || process.env.CLIENTURL;
const rawGeminiApiKey = process.env.GEMINI_API_KEY || process.env.GEMINIAPIKEY;
const rawGeminiApiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINIAPIKEYS;
const rawSessionSecret = process.env.SESSION_SECRET || process.env.SESSIONSECRET;

// Optional numbered keys for platforms where comma-separated values are hard to set.
// Accepts both GEMINI_API_KEY_1 and GEMINIAPIKEY1 styles.
const numberedGeminiKeys = [
  process.env.GEMINI_API_KEY_1 || process.env.GEMINIAPIKEY1,
  process.env.GEMINI_API_KEY_2 || process.env.GEMINIAPIKEY2,
  process.env.GEMINI_API_KEY_3 || process.env.GEMINIAPIKEY3,
  process.env.GEMINI_API_KEY_4 || process.env.GEMINIAPIKEY4,
  process.env.GEMINI_API_KEY_5 || process.env.GEMINIAPIKEY5,
].filter(Boolean);

const parsedGeminiPool = rawGeminiApiKeys
  ? rawGeminiApiKeys
      .split(/[,;\n]/)
      .map((k) => k.trim())
      .filter(Boolean)
  : [];

const effectiveGeminiKeys = parsedGeminiPool.length > 0
  ? parsedGeminiPool
  : (numberedGeminiKeys.length > 0 ? numberedGeminiKeys : (rawGeminiApiKey ? [rawGeminiApiKey] : []));

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongodbUri: rawMongoUri || 'mongodb://localhost:27017/interviewer-bot',
  
  // Client (for CORS)
  clientUrl: rawClientUrl || 'http://localhost:3000',
  
  // ML Service
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000',
  
  // Proctoring Service
  proctorUrl: process.env.PROCTOR_URL || 'http://127.0.0.1:5000',
  
  // Gemini API
  geminiApiKey: effectiveGeminiKeys[0],
  geminiApiKeys: effectiveGeminiKeys,
  
  // Session
  sessionSecret: rawSessionSecret || 'dev-secret-change-in-production',
  
  // Interview Settings
  questionsPerTopic: 5,
  maxWarmupQuestions: 3,
  resumeQuestionsTarget: 20,
  
  // Helpers
  get isDevelopment() {
    return this.nodeEnv !== 'production';
  },
};

// Validation
const missingVars = [];
if (!rawMongoUri) {
  missingVars.push('MONGODB_URI (or MONGODBURI)');
}

if (missingVars.length > 0 && config.nodeEnv === 'production') {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

module.exports = { config };
