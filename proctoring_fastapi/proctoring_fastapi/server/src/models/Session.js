/**
 * Session Model
 * Stores interview sessions and answers
 */

const mongoose = require('mongoose');

// Sub-schema for individual answers
const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  },
  questionText: String,
  topic: String,
  userAnswer: String,
  expectedAnswer: String,
  score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  isSkipped: {
    type: Boolean,
    default: false
  },
  responseTime: Number, // in seconds
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Sub-schema for resume questions
const resumeQuestionSchema = new mongoose.Schema({
  question: String,
  type: {
    type: String,
    enum: ['deep_dive', 'tradeoff', 'scaling', 'retrospective', 'behavioral', 'theoretical', 'conceptual', 'project', 'experience']
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard']
  },
  expectedAnswer: String,
  section: String,
  keywords: [String],
  asked: {
    type: Boolean,
    default: false
  }
}, { _id: true });

// Main session schema
const sessionSchema = new mongoose.Schema({
  // Session State
  state: {
    type: String,
    enum: ['INTRO', 'SKILL_PROMPT', 'RESUME_WARMUP', 'RESUME_DEEP_DIVE', 'DEEP_DIVE', 'MIX_ROUND', 'FINISHED'],
    default: 'INTRO'
  },
  
  // Connection Info
  socketId: String,
  
  // User-selected skills from main page (for warmup questions from MongoDB)
  userSelectedSkills: [{
    type: String
  }],
  
  // Skills extracted/detected from resume (for reference only, not for warmup)
  skillsDetected: [{
    type: String
  }],
  skillsQueue: [{
    type: String
  }],
  currentTopic: String,
  
  // Progress Tracking
  questionsAsked: {
    type: Number,
    default: 0
  },
  warmupQuestionsAsked: {
    type: Number,
    default: 0
  },
  askedQuestionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  
  // Answers
  answers: [answerSchema],
  
  // Resume Data
  resumePath: String,
  resumeSummary: String,
  resumeQuestions: [resumeQuestionSchema],
  resumeQuestionsAsked: {
    type: Number,
    default: 0
  },
  resumeQuestionsReady: {
    type: Boolean,
    default: false
  },
  
  // Context Keywords (for counter-questioning)
  contextKeywords: [String],
  usedKeywords: [String],
  
  // Timing
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  
  // Results
  finalScore: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // Last question (for reconnection recovery)
  lastQuestion: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // Metadata
  userAgent: String,
  ipAddress: String
}, {
  timestamps: true
});

// Virtual for duration in minutes
sessionSchema.virtual('durationMinutes').get(function() {
  if (!this.endedAt) return null;
  return Math.round((this.endedAt - this.startedAt) / 60000);
});

// Calculate final score
sessionSchema.methods.calculateFinalScore = function() {
  if (this.answers.length === 0) return 0;
  
  const totalScore = this.answers
    .filter(a => !a.isSkipped)
    .reduce((sum, a) => sum + a.score, 0);
  
  const answeredCount = this.answers.filter(a => !a.isSkipped).length;
  
  return answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0;
};

// Get next resume question
sessionSchema.methods.getNextResumeQuestion = function() {
  return this.resumeQuestions.find(q => !q.asked);
};

// Mark resume question as asked
sessionSchema.methods.markResumeQuestionAsked = function(questionId) {
  const question = this.resumeQuestions.id(questionId);
  if (question) {
    question.asked = true;
    this.resumeQuestionsAsked += 1;
  }
};

// Check if should transition to next state
sessionSchema.methods.shouldTransition = function(questionsPerTopic = 5) {
  if (this.state === 'DEEP_DIVE' && this.questionsAsked >= questionsPerTopic) {
    if (this.skillsQueue.length > 0) {
      return { action: 'NEXT_TOPIC', nextTopic: this.skillsQueue[0] };
    }
    return { action: 'MIX_ROUND' };
  }
  
  if (this.state === 'MIX_ROUND' && this.questionsAsked >= 5) {
    return { action: 'FINISH' };
  }
  
  if (this.state === 'RESUME_DEEP_DIVE') {
    const remaining = this.resumeQuestions.filter(q => !q.asked).length;
    if (remaining === 0) {
      return { action: 'DEEP_DIVE' };
    }
  }
  
  return { action: 'CONTINUE' };
};

// Ensure virtuals are included in JSON
sessionSchema.set('toJSON', { virtuals: true });
sessionSchema.set('toObject', { virtuals: true });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
