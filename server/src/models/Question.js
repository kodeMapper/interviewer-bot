/**
 * Question Model
 * Stores interview questions for all topics
 */

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
    enum: ['Java', 'Python', 'JavaScript', 'React', 'SQL', 'Machine_Learning', 'Deep_Learning'],
    index: true
  },
  question: {
    type: String,
    required: true
  },
  expectedAnswer: {
    type: String,
    required: true
  },
  keywords: [{
    type: String,
    lowercase: true,
    index: true
  }],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  timesAsked: {
    type: Number,
    default: 0
  },
  avgScore: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Text index for keyword search
questionSchema.index({ question: 'text', keywords: 'text' });

// Static method to get random question by topic
questionSchema.statics.getRandomByTopic = async function(topic, excludeIds = []) {
  const query = {
    topic,
    isActive: true,
    _id: { $nin: excludeIds }
  };
  
  const count = await this.countDocuments(query);
  if (count === 0) return null;
  
  const random = Math.floor(Math.random() * count);
  return this.findOne(query).skip(random);
};

// Static method to search by keyword
questionSchema.statics.searchByKeyword = async function(keyword, allowedTopics = []) {
  const query = {
    isActive: true,
    $or: [
      { keywords: { $regex: keyword, $options: 'i' } },
      { question: { $regex: keyword, $options: 'i' } }
    ]
  };
  
  if (allowedTopics.length > 0) {
    query.topic = { $in: allowedTopics };
  }
  
  return this.find(query).limit(10);
};

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
