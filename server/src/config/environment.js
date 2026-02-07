/**
 * Environment Configuration
 * Loads and validates environment variables
 */

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/interviewer-bot',
  
  // Client (for CORS)
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  
  // ML Service
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  
  // Gemini API
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiApiKeys: process.env.GEMINI_API_KEYS 
    ? process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()) 
    : (process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : []),
  
  // Session
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  
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
const requiredEnvVars = ['MONGODB_URI'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && config.nodeEnv === 'production') {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

module.exports = { config };
