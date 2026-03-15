/**
 * Interview Service
 * Core interview logic - state machine and flow control
 * Migrated from Python interview_controller.py
 * 
 * ORIGINAL FLOW (from Python interview_controller.py):
 * 1. INTRO: "Hello. I am your AI Interviewer. I have your resume and will ask personalized questions."
 * 2. SKILL_PROMPT: "Let's begin. Please introduce yourself and list your technical skills."
 * 3. User answers → IntentPredictor detects skills (e.g., ['Java'])
 * 4. RESUME_WARMUP: Ask warmup questions from local QB based on detected skills 
 *    (while Gemini processes resume in background)
 * 5. RESUME_DEEP_DIVE: When Gemini ready, ask personalized resume questions (target: 20)
 * 6. DEEP_DIVE: After resume questions, ask questions from local QB based on skills
 * 7. FINISHED: Generate feedback
 * 
 * KEY FEATURES:
 * - Background resume processing while asking warmup questions
 * - Keyword extraction from answers for counter-questioning
 * - Smooth transitions between phases
 */

const { Session, Question } = require('../models');
const { config } = require('../config/environment');
const answerService = require('./answer.service');

// Interview state constants - matching original Python InterviewState enum
const STATES = {
  INTRO: 'INTRO',                       // Initial greeting
  SKILL_PROMPT: 'SKILL_PROMPT',         // "Let's begin. Please introduce yourself..."
  RESUME_WARMUP: 'RESUME_WARMUP',       // Ask warmup from local QB (while Gemini processes)
  RESUME_DEEP_DIVE: 'RESUME_DEEP_DIVE', // Ask Gemini-generated resume questions
  DEEP_DIVE: 'DEEP_DIVE',               // Ask from local QB based on skills
  MIX_ROUND: 'MIX_ROUND',               // Mixed questions from all skills
  FINISHED: 'FINISHED'
};

// Config matching original Python constants
const MAX_WARMUP_QUESTIONS = config.maxWarmupQuestions || 3;
const QUESTIONS_PER_TOPIC = config.questionsPerTopic || 5;
const RESUME_QUESTIONS_TARGET = 20;

/**
 * Create a new interview session
 */
async function createSession(data) {
  const session = new Session({
    state: STATES.INTRO,
    userSelectedSkills: data.userSelectedSkills || data.skillsDetected || [], // User-selected from main page
    skillsDetected: [], // Will be populated from resume extraction
    skillsQueue: [],
    currentTopic: null,
    resumePath: data.resumePath || null,
    resumeQuestionsReady: false,
    resumeQuestions: [],
    warmupQuestionsAsked: 0,
    resumeQuestionsAsked: 0,
    questionsAsked: 0,
    contextKeywords: [],
    usedKeywords: [],
    userAgent: data.userAgent,
    ipAddress: data.ipAddress
  });

  await session.save();
  return session;
}

/**
 * Get next question based on current state
 * This is the main state machine - matches Python run_loop()
 */
async function getNextQuestion(session) {
  switch (session.state) {
    case STATES.INTRO:
      return getIntroMessage(session);

    case STATES.SKILL_PROMPT:
      return getSkillPrompt(session);

    case STATES.RESUME_WARMUP:
      return getResumeWarmupQuestion(session);

    case STATES.RESUME_DEEP_DIVE:
      return getResumeDeepDiveQuestion(session);

    case STATES.DEEP_DIVE:
      return getDeepDiveQuestion(session);

    case STATES.MIX_ROUND:
      return getMixRoundQuestion(session);

    case STATES.FINISHED:
      return getFinishMessage(session);

    default:
      return { type: 'error', message: 'Unknown interview state' };
  }
}

/**
 * INTRO: "Hello. I am your AI Interviewer..."
 * Matches: self.speak("Hello. I am your AI Interviewer. I have your resume...")
 * 
 * IMPROVEMENT: Since skills are already selected before upload,
 * we skip SKILL_PROMPT and go directly to RESUME_WARMUP
 */
async function getIntroMessage(session) {
  // Check if user has pre-selected skills (from main page)
  // If yes, skip SKILL_PROMPT and go directly to RESUME_WARMUP
  const userSkills = session.userSelectedSkills || [];
  
  if (userSkills.length > 0) {
    // Skills already known - skip to warmup
    session.state = STATES.RESUME_WARMUP;
    session.skillsQueue = [...userSkills]; // Use user-selected skills for warmup
    session.currentTopic = userSkills[0];
    await session.save();
    
    const skillList = userSkills.join(', ');
    const introMessage = `Hello! I am your AI Interviewer. Based on your selection, I will be asking you questions on ${skillList}. Let me start with a few warmup questions while I analyze your resume in the background. Get ready!`;
    
    return {
      type: 'intro',
      message: introMessage,
      speakText: introMessage,
      detectedSkills: userSkills,
      skipSkillPrompt: true
    };
  }
  
  // No skills detected yet - ask for intro (legacy flow)
  session.state = STATES.SKILL_PROMPT;
  await session.save();
  
  return {
    type: 'intro',
    message: "Hello. I am your AI Interviewer. I have your resume and will ask personalized questions.",
    speakText: "Hello. I am your AI Interviewer. I have your resume and will ask personalized questions."
  };
}

/**
 * SKILL_PROMPT: "Let's begin. Please introduce yourself and list your technical skills."
 * This is the CRITICAL first question that triggers skill detection
 */
function getSkillPrompt(session) {
  return {
    type: 'skill_prompt',
    question: "Let's begin. Please introduce yourself and list your technical skills.",
    speakText: "Let's begin. Please introduce yourself and list your technical skills.",
    expectsIntro: true,  // Flag: frontend should run IntentPredictor on this answer
    requiresSkillDetection: true
  };
}

/**
 * Process the intro answer and detect skills
 * Called after user responds to skill prompt (legacy flow)
 * Matches: conf_topics = self.router.predict_with_scores(intro_text, threshold=0.3)
 */
async function processIntroAnswer(session, userAnswer, detectedSkills) {
  console.log(`[Interview] Processing intro. User said: "${userAnswer.substring(0, 50)}..."`);
  console.log(`[Interview] Detected skills: ${detectedSkills.join(', ')}`);
  
  // Default to Java if no skills detected (matches Python: if not skills_queue: skills_queue = ["Java"])
  if (!detectedSkills || detectedSkills.length === 0) {
    detectedSkills = ['Java'];
  }
  
  // Update session - use detected skills as user-selected skills for warmup
  session.userSelectedSkills = detectedSkills;
  session.skillsQueue = [...detectedSkills];
  session.currentTopic = detectedSkills[0];
  
  // Transition to RESUME_WARMUP
  session.state = STATES.RESUME_WARMUP;
  await session.save();
  
  // Build transition message
  const skillList = detectedSkills.slice(0, 3).join(', ');
  
  return {
    type: 'transition',
    message: `I see you know ${skillList}. Let me ask a few warmup questions while I analyze your resume.`,
    speakText: `I see you know ${skillList}. Let me ask a few warmup questions while I analyze your resume.`,
    detectedSkills: detectedSkills,
    nextState: STATES.RESUME_WARMUP
  };
}

/**
 * RESUME_WARMUP: Ask warmup questions from local QB while Gemini processes resume
 * Matches Python: while warmup_count < self.max_warmup_questions and self.is_running
 */
async function getResumeWarmupQuestion(session) {
  // Check if we should transition to resume questions
  if (session.resumeQuestionsReady && session.resumeQuestions && session.resumeQuestions.length > 0) {
    console.log('[Interview] Resume questions ready! Transitioning to RESUME_DEEP_DIVE...');
    session.state = STATES.RESUME_DEEP_DIVE;
    session.questionsAsked = 0;
    await session.save();
    
    return {
      type: 'transition',
      message: "I've analyzed your resume. Let's dive deeper into your experience.",
      speakText: "I've analyzed your resume. Let's dive deeper into your experience.",
      nextState: STATES.RESUME_DEEP_DIVE
    };
  }
  
  // Check if we've asked enough warmup questions
  if (session.warmupQuestionsAsked >= MAX_WARMUP_QUESTIONS) {
    // If resume still not ready, keep asking from next skill
    if (session.skillsQueue.length > 1) {
      session.skillsQueue.shift();
      session.currentTopic = session.skillsQueue[0];
      session.warmupQuestionsAsked = 0;
      await session.save();
    }
    
    // If resume is ready now, transition
    if (session.resumeQuestionsReady && session.resumeQuestions.length > 0) {
      session.state = STATES.RESUME_DEEP_DIVE;
      await session.save();
      return {
        type: 'transition',
        message: "I've analyzed your resume. Let's dive deeper into your experience.",
        speakText: "I've analyzed your resume. Let's dive deeper into your experience."
      };
    }
  }
  
  const topic = session.currentTopic || session.skillsQueue[0] || 'General';
  
  // Get random question from local question bank
  const question = await Question.getRandomByTopic(topic, session.askedQuestionIds || []);
  
  if (!question) {
    // No questions for this topic, try next
    if (session.skillsQueue.length > 1) {
      session.skillsQueue.shift();
      session.currentTopic = session.skillsQueue[0];
      await session.save();
      return getResumeWarmupQuestion(session);
    }
    
    // No more warmup questions, force transition
    if (session.resumeQuestionsReady && session.resumeQuestions.length > 0) {
      session.state = STATES.RESUME_DEEP_DIVE;
    } else {
      session.state = STATES.DEEP_DIVE;
    }
    await session.save();
    return getNextQuestion(session);
  }
  
  // Track asked question
  if (!session.askedQuestionIds) session.askedQuestionIds = [];
  session.askedQuestionIds.push(question._id);
  session.warmupQuestionsAsked += 1;
  await session.save();
  
  return {
    type: 'warmup',
    topic: topic,
    question: question.question,
    questionId: question._id,
    expectedAnswer: question.expectedAnswer,
    keywords: question.keywords,
    speakText: question.question,
    warmupNumber: session.warmupQuestionsAsked,
    maxWarmup: MAX_WARMUP_QUESTIONS
  };
}

/**
 * RESUME_DEEP_DIVE: Ask Gemini-generated personalized resume questions
 * Matches Python: if self.state == InterviewState.RESUME_DEEP_DIVE
 */
async function getResumeDeepDiveQuestion(session) {
  // Find next unasked resume question
  const unaskedQuestions = (session.resumeQuestions || []).filter(q => !q.asked);
  
  if (unaskedQuestions.length === 0 || session.resumeQuestionsAsked >= RESUME_QUESTIONS_TARGET) {
    // Resume round complete
    const totalAsked = session.resumeQuestionsAsked || 0;
    console.log(`[Interview] Resume questions exhausted. Total asked: ${totalAsked}`);
    
    // Transition to DEEP_DIVE for local QB questions
    // Matches: self.speak("Now let me ask you some more questions from our side.")
    session.state = STATES.DEEP_DIVE;
    session.questionsAsked = 0;
    session.currentTopic = session.userSelectedSkills[0] || 'General';
    await session.save();
    
    return {
      type: 'transition',
      message: "Now let me ask you some more questions from our side.",
      speakText: "Now let me ask you some more questions from our side.",
      nextState: STATES.DEEP_DIVE
    };
  }
  
  // Get next resume question
  const question = unaskedQuestions[0];
  
  // Mark as asked
  const questionIndex = session.resumeQuestions.findIndex(q => q.question === question.question);
  if (questionIndex !== -1) {
    session.resumeQuestions[questionIndex].asked = true;
  }
  session.resumeQuestionsAsked = (session.resumeQuestionsAsked || 0) + 1;
  await session.save();
  
  // Add variety with transition phrases (matches Python transitions array)
  const transitions = [
    "",
    "Let me ask you about ",
    "Regarding your experience, ",
    "Based on your resume, ",
  ];
  const prefix = Math.random() < 0.3 ? transitions[Math.floor(Math.random() * transitions.length)] : "";
  const fullQuestion = prefix + question.question;
  
  return {
    type: 'resume',
    question: question.question,
    fullQuestion: fullQuestion,
    questionId: question._id || `resume_${session.resumeQuestionsAsked}`,
    section: question.section,
    difficulty: question.difficulty,
    expectedAnswer: question.expectedAnswer,
    keywords: question.keywords,
    speakText: fullQuestion,
    resumeNumber: session.resumeQuestionsAsked,
    totalResume: Math.min(session.resumeQuestions.length, RESUME_QUESTIONS_TARGET)
  };
}

/**
 * DEEP_DIVE: Ask questions from local question bank based on detected skills
 * Matches Python: if self.state == InterviewState.DEEP_DIVE
 */
async function getDeepDiveQuestion(session) {
  const topic = session.currentTopic || session.skillsQueue[0] || 'General';
  
  // Check if we should move to next topic
  if (session.questionsAsked >= QUESTIONS_PER_TOPIC) {
    // Remove current topic from queue
    session.skillsQueue = (session.skillsQueue || []).filter(s => s !== topic);
    
    if (session.skillsQueue.length > 0) {
      // Move to next topic
      session.currentTopic = session.skillsQueue[0];
      session.questionsAsked = 0;
      await session.save();
      
      return {
        type: 'transition',
        message: `Great work on ${topic}! Now let's move to ${session.currentTopic}.`,
        speakText: `Great work on ${topic}! Now let's move to ${session.currentTopic}.`
      };
    } else {
      // All topics covered, go to MIX_ROUND
      session.state = STATES.MIX_ROUND;
      session.questionsAsked = 0;
      await session.save();
      
      return {
        type: 'transition',
        message: "Excellent! We've covered all your main skills. Now let's do a quick mixed round.",
        speakText: "Excellent! We've covered all your main skills. Now let's do a quick mixed round."
      };
    }
  }
  
  let question = null;
  let transitionPhrase = "";
  
  // ADAPTIVE LOGIC: Check context keywords for counter-questioning
  // Matches Python: if not self.context_keywords.empty()
  if (session.contextKeywords && session.contextKeywords.length > 0) {
    const keyword = session.contextKeywords[0];
    
    if (!session.usedKeywords || !session.usedKeywords.includes(keyword)) {
      // Try to find a question related to this keyword
      const keywordQuestion = await Question.findOne({
        $or: [
          { keywords: { $in: [keyword.toLowerCase()] } },
          { question: { $regex: keyword, $options: 'i' } }
        ],
        topic: { $in: session.userSelectedSkills || [topic] },
        _id: { $nin: session.askedQuestionIds || [] }
      });
      
      if (keywordQuestion) {
        console.log(`[Interview] 🔀 [Adapt] Counter-questioning on '${keyword}'`);
        question = keywordQuestion;
        
        // Add transition phrase
        const transitions = [
          `Going back to what you mentioned about ${keyword}. `,
          `You touched on ${keyword} earlier. `,
          `Related to your point about ${keyword}. `,
          `Speaking of ${keyword}. `
        ];
        transitionPhrase = transitions[Math.floor(Math.random() * transitions.length)];
        
        // Mark keyword as used
        if (!session.usedKeywords) session.usedKeywords = [];
        session.usedKeywords.push(keyword);
        session.contextKeywords.shift();
      } else {
        // No question for this keyword, skip it
        console.log(`[Interview] ⏭️ [Adapt] No question found for keyword: '${keyword}'`);
        session.contextKeywords.shift();
      }
    } else {
      console.log(`[Interview] ⏭️ [Adapt] Skipping already used keyword: '${keyword}'`);
      session.contextKeywords.shift();
    }
  }
  
  // Default: get random question for topic if no counter-question
  if (!question) {
    question = await Question.getRandomByTopic(topic, session.askedQuestionIds || []);
  }
  
  if (!question) {
    // Topic exhausted, force move to next
    session.questionsAsked = QUESTIONS_PER_TOPIC + 1;
    await session.save();
    return getDeepDiveQuestion(session);
  }
  
  // Track asked question
  if (!session.askedQuestionIds) session.askedQuestionIds = [];
  session.askedQuestionIds.push(question._id);
  session.questionsAsked = (session.questionsAsked || 0) + 1;
  await session.save();
  
  const fullQuestion = transitionPhrase + question.question;
  
  return {
    type: 'deep_dive',
    topic: topic,
    question: question.question,
    fullQuestion: fullQuestion,
    questionId: question._id,
    expectedAnswer: question.expectedAnswer,
    keywords: question.keywords,
    speakText: fullQuestion,
    questionNumber: session.questionsAsked,
    totalForTopic: QUESTIONS_PER_TOPIC
  };
}

/**
 * MIX_ROUND: Random questions from all detected skills
 * Matches Python MIX_ROUND logic
 */
async function getMixRoundQuestion(session) {
  if (session.questionsAsked >= 5) {
    // End interview
    session.state = STATES.FINISHED;
    session.endedAt = new Date();
    await session.save();
    return getFinishMessage(session);
  }
  
  // Pick random topic from user-selected skills (from main page)
  const skills = session.userSelectedSkills || ['General'];
  const topic = skills[Math.floor(Math.random() * skills.length)];
  
  const question = await Question.getRandomByTopic(topic, session.askedQuestionIds || []);
  
  if (!question) {
    session.state = STATES.FINISHED;
    session.endedAt = new Date();
    await session.save();
    return getFinishMessage(session);
  }
  
  if (!session.askedQuestionIds) session.askedQuestionIds = [];
  session.askedQuestionIds.push(question._id);
  session.questionsAsked = (session.questionsAsked || 0) + 1;
  await session.save();
  
  return {
    type: 'mix_round',
    topic: topic,
    question: question.question,
    questionId: question._id,
    expectedAnswer: question.expectedAnswer,
    keywords: question.keywords,
    speakText: question.question,
    questionNumber: session.questionsAsked,
    totalMixRound: 5
  };
}

/**
 * FINISHED: Generate final feedback
 * Matches: self.speak("Interview complete. Generating feedback...")
 */
function getFinishMessage(session) {
  const answers = session.answers || [];
  const totalScore = answers.reduce((sum, a) => sum + (a.score || 0), 0);
  const avgScore = answers.length > 0 ? Math.round(totalScore / answers.length) : 0;
  
  let feedback = '';
  if (avgScore >= 80) {
    feedback = 'Outstanding performance! You demonstrated excellent knowledge.';
  } else if (avgScore >= 60) {
    feedback = 'Good job! You showed solid understanding with room for improvement.';
  } else if (avgScore >= 40) {
    feedback = 'Decent effort. Consider strengthening your fundamentals.';
  } else {
    feedback = 'Keep practicing! Review the core concepts and try again.';
  }
  
  return {
    type: 'finished',
    message: "Interview complete. Generating feedback...",
    speakText: feedback,
    summary: {
      finalScore: avgScore,
      questionsAnswered: answers.filter(a => !a.isSkipped).length,
      questionsSkipped: answers.filter(a => a.isSkipped).length,
      topicsCovered: [...new Set(answers.map(a => a.topic))],
      resumeQuestionsAsked: session.resumeQuestionsAsked || 0,
      warmupQuestionsAsked: session.warmupQuestionsAsked || 0
    }
  };
}

/**
 * Mark resume questions as ready (called when Gemini finishes processing)
 * Matches: self.resume_generation_complete.set()
 */
async function setResumeQuestionsReady(session, questions) {
  session.resumeQuestions = questions.map((q, i) => ({
    ...q,
    _id: q._id || `resume_${i}`,
    asked: false
  }));
  session.resumeQuestionsReady = true;
  await session.save();
  
  console.log(`[Interview] 🎯 Resume questions ready! ${questions.length} questions loaded.`);
  console.log(`[Interview] 📁 Questions stored in session.resumeQuestions`);
  
  return session;
}

/**
 * Process user answer
 * Matches Python background processor: _background_processor()
 */
async function processAnswer(session, userAnswer, questionData) {
  // Handle null/undefined inputs
  if (!userAnswer) userAnswer = '';
  if (!questionData) questionData = {};
  
  // Evaluate answer
  const evaluation = await answerService.evaluate(
    userAnswer,
    questionData.expectedAnswer || '',
    questionData.keywords || []
  );

  // Store answer
  if (!session.answers) session.answers = [];
  session.answers.push({
    questionId: questionData.questionId,
    questionText: questionData.question,
    topic: questionData.topic || questionData.section || 'Resume',
    userAnswer: userAnswer,
    expectedAnswer: questionData.expectedAnswer,
    score: evaluation.score,
    isCorrect: evaluation.score >= 60,
    isSkipped: false,
    responseTime: questionData.responseTime || 0
  });

  // Extract keywords for counter-questioning (CRITICAL for adaptive questioning)
  // Matches Python: found_keywords = []; for kw in KEYWORD_INDEX.keys()...
  const newKeywords = answerService.extractKeywords(userAnswer);
  if (newKeywords.length > 0) {
    console.log(`[Interview] 🔍 [Context] Keywords: [${newKeywords.map(k => `'${k}'`).join(', ')}] -> Queued`);
    
    // Add to context keywords (matching Python: self.context_keywords.put(best_kw))
    if (!session.contextKeywords) session.contextKeywords = [];
    
    // Pick the longest keyword as most specific (matches Python logic)
    const bestKeyword = newKeywords.reduce((a, b) => a.length > b.length ? a : b);
    if (!session.contextKeywords.includes(bestKeyword)) {
      session.contextKeywords.push(bestKeyword);
    }
  }

  await session.save();

  const qText = questionData.question || 'Unknown';
  const aText = userAnswer || '';
  console.log(`[Interview] [Processed] Q: ${qText.substring(0, 30)}... | Ans: ${aText.substring(0, 30)}... | Score: ${evaluation.score}`);

  return {
    score: evaluation.score,
    isCorrect: evaluation.score >= 60,
    feedback: evaluation.feedback,
    correctAnswer: evaluation.showCorrect ? questionData.expectedAnswer : null
  };
}

/**
 * Handle skip question
 */
async function skipQuestion(session, questionData) {
  if (!session.answers) session.answers = [];
  session.answers.push({
    questionId: questionData.questionId,
    questionText: questionData.question,
    topic: questionData.topic || questionData.section || 'Resume',
    userAnswer: '[SKIPPED]',
    expectedAnswer: questionData.expectedAnswer,
    score: 0,
    isCorrect: false,
    isSkipped: true
  });

  await session.save();

  return {
    message: 'Question skipped. Moving to the next one.',
    correctAnswer: questionData.expectedAnswer
  };
}

/**
 * Generate detailed interview report
 * Matches: generate_report() in Python
 */
function generateReport(session) {
  const answers = session.answers || [];
  
  // Calculate topic-wise scores
  const topicScores = {};
  answers.forEach(a => {
    const topic = a.topic || 'General';
    if (!topicScores[topic]) {
      topicScores[topic] = { total: 0, count: 0, correct: 0 };
    }
    if (!a.isSkipped) {
      topicScores[topic].total += a.score || 0;
      topicScores[topic].count += 1;
      if (a.isCorrect) topicScores[topic].correct += 1;
    }
  });

  const topicBreakdown = Object.entries(topicScores).map(([topic, data]) => ({
    topic,
    averageScore: data.count > 0 ? Math.round(data.total / data.count) : 0,
    questionsAnswered: data.count,
    correctAnswers: data.correct,
    accuracy: data.count > 0 ? Math.round((data.correct / data.count) * 100) : 0
  }));

  // Calculate resume vs local scores
  const resumeAnswers = answers.filter(a => a.topic.startsWith('Resume:') || a.topic === 'Resume');
  const localAnswers = answers.filter(a => !a.topic.startsWith('Resume:') && a.topic !== 'Resume');
  
  const resumeScore = resumeAnswers.length > 0 
    ? Math.round(resumeAnswers.reduce((s, a) => s + a.score, 0) / resumeAnswers.length) 
    : 0;
  const localScore = localAnswers.length > 0 
    ? Math.round(localAnswers.reduce((s, a) => s + a.score, 0) / localAnswers.length) 
    : 0;

  const totalScore = answers.length > 0
    ? Math.round(answers.reduce((s, a) => s + a.score, 0) / answers.length)
    : 0;

  // Generate question-wise feedback for final report
  const questionFeedback = answers.map((a, index) => ({
    questionNumber: index + 1,
    question: a.questionText,
    topic: a.topic,
    userAnswer: a.isSkipped ? '[SKIPPED]' : (a.userAnswer || ''),
    expectedAnswer: a.expectedAnswer || null,
    score: a.score,
    maxScore: 100,
    isCorrect: a.isCorrect,
    isSkipped: a.isSkipped,
    feedback: a.feedback || null,
    responseTime: a.responseTime || null
  }));

  // Calculate strengths (topics with avg score >= 70)
  const strengths = topicBreakdown
    .filter(t => t.averageScore >= 70 && t.questionsAnswered >= 1)
    .map(t => t.topic);
  
  // Calculate weaknesses (topics with avg score < 50)
  const weaknesses = topicBreakdown
    .filter(t => t.averageScore < 50 && t.questionsAnswered >= 1)
    .map(t => t.topic);
  
  // Generate recommendations based on performance
  const recommendations = [];
  
  if (weaknesses.length > 0) {
    recommendations.push(`Focus on improving your knowledge in: ${weaknesses.join(', ')}`);
  }
  
  const skippedCount = answers.filter(a => a.isSkipped).length;
  if (skippedCount > 2) {
    recommendations.push(`You skipped ${skippedCount} questions. Try to attempt all questions in real interviews.`);
  }
  
  if (totalScore < 50) {
    recommendations.push('Review fundamental concepts and practice more mock interviews.');
  } else if (totalScore < 70) {
    recommendations.push('Good foundation! Focus on advanced topics and edge cases.');
  } else {
    recommendations.push('Excellent performance! Keep practicing to maintain your skills.');
  }
  
  if (resumeScore < localScore && resumeAnswers.length > 0) {
    recommendations.push('Practice explaining your projects and experiences more clearly.');
  }
  
  // Add topic-specific recommendations
  weaknesses.forEach(topic => {
    const topicRecs = {
      'Java': 'Review Java core concepts: OOP, Collections, Multithreading, and Exception Handling.',
      'Python': 'Practice Python fundamentals: Data structures, OOP, and common libraries.',
      'JavaScript': 'Strengthen JavaScript basics: Closures, Promises, async/await, and ES6+ features.',
      'React': 'Review React concepts: Hooks, State Management, and Component Lifecycle.',
      'SQL': 'Practice SQL queries: JOINs, Aggregations, Subqueries, and Indexing.',
      'Machine_Learning': 'Study ML algorithms, evaluation metrics, and practical applications.',
      'Deep_Learning': 'Review neural network architectures and deep learning frameworks.'
    };
    if (topicRecs[topic]) {
      recommendations.push(topicRecs[topic]);
    }
  });

  return {
    sessionId: session._id,
    candidateProfile: session.resumeSummary || null,
    summary: {
      finalScore: totalScore,
      resumeQuestionsScore: resumeScore,
      localQuestionsScore: localScore,
      totalQuestions: answers.length,
      answered: answers.filter(a => !a.isSkipped).length,
      skipped: answers.filter(a => a.isSkipped).length,
      correct: answers.filter(a => a.isCorrect).length,
      duration: session.durationMinutes,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      userSelectedSkills: session.userSelectedSkills || [],
      resumeDetectedSkills: session.skillsDetected || []
    },
    topicBreakdown,
    strengths,
    weaknesses,
    recommendations,
    questionFeedback,
    detailedAnswers: answers.map(a => ({
      question: a.questionText || a.question || 'Question',
      topic: a.topic || 'General',
      userAnswer: a.isSkipped ? '[SKIPPED]' : (a.userAnswer || '').substring(0, 200),
      score: a.score || 0,
      isCorrect: a.isCorrect || false,
      isSkipped: a.isSkipped || false
    }))
  };
}

module.exports = {
  STATES,
  createSession,
  getNextQuestion,
  processAnswer,
  processIntroAnswer,
  setResumeQuestionsReady,
  skipQuestion,
  generateReport
};
