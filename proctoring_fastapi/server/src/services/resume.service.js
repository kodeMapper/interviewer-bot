/**
 * Resume Service
 * Resume parsing, skill detection, and question generation
 * Migrated from Python resume module
 */

const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { config } = require('../config/environment');

// Initialize Gemini client pool
let apiKeys = [];
let currentKeyIndex = 0;

if (config.geminiApiKeys && config.geminiApiKeys.length > 0) {
  apiKeys = config.geminiApiKeys;
  console.log(`✅ Loaded ${apiKeys.length} Gemini API Key(s)`);
} else if (config.geminiApiKey) {
  apiKeys = [config.geminiApiKey];
  console.log('✅ Loaded 1 Gemini API Key');
} else {
  console.warn('⚠️ GEMINI_API_KEY not found in environment variables');
}

/**
 * Get the current Gemini client
 * @returns {GoogleGenerativeAI}
 */
function getGenAIClient() {
  if (apiKeys.length === 0) return null;
  return new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
}

/**
 * Rotate to the next API key
 */
function rotateApiKey() {
  if (apiKeys.length <= 1) return false;
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  console.log(`🔄 Rotating Gemini API Key to index ${currentKeyIndex}`);
  return true;
}

// Skill detection patterns
const SKILL_PATTERNS = {
  Java: [
    /\bjava\b/i, /\bspring\b/i, /\bspring\s*boot\b/i, /\bhibernate\b/i,
    /\bjpa\b/i, /\bmaven\b/i, /\bgradle\b/i, /\bjunit\b/i, /\bjee\b/i
  ],
  Python: [
    /\bpython\b/i, /\bdjango\b/i, /\bflask\b/i, /\bfastapi\b/i,
    /\bpandas\b/i, /\bnumpy\b/i, /\bscikit/i, /\bpytest\b/i
  ],
  JavaScript: [
    /\bjavascript\b/i, /\bjs\b/i, /\bnode\.?js\b/i, /\bexpress\b/i,
    /\bnpm\b/i, /\byarn\b/i, /\btypescript\b/i, /\bts\b/i
  ],
  React: [
    /\breact\b/i, /\breact\.?js\b/i, /\bredux\b/i, /\bnext\.?js\b/i,
    /\bhooks\b/i, /\bjsx\b/i, /\breact\s*native\b/i
  ],
  SQL: [
    /\bsql\b/i, /\bmysql\b/i, /\bpostgres/i, /\boracle\b/i,
    /\bsqlite\b/i, /\bmssql\b/i, /\brelational\s*database/i
  ],
  Machine_Learning: [
    /\bmachine\s*learning\b/i, /\bml\b/i, /\bscikit/i, /\btensorflow\b/i,
    /\bkeras\b/i, /\brandom\s*forest/i, /\bsvm\b/i, /\bxgboost\b/i,
    /\bclassification\b/i, /\bregression\b/i, /\bclustering\b/i
  ],
  Deep_Learning: [
    /\bdeep\s*learning\b/i, /\bdl\b/i, /\bneural\s*network/i, /\bcnn\b/i,
    /\brnn\b/i, /\blstm\b/i, /\btransformer/i, /\bbert\b/i, /\bgpt\b/i,
    /\bpytorch\b/i, /\btensorflow\b/i
  ]
};

/**
 * Extract text from resume file (PDF or DOCX)
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

/**
 * Detect skills from resume text
 */
function detectSkills(resumeText) {
  const detectedSkills = [];

  for (const [skill, patterns] of Object.entries(SKILL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(resumeText)) {
        if (!detectedSkills.includes(skill)) {
          detectedSkills.push(skill);
        }
        break;
      }
    }
  }

  return detectedSkills;
}

/**
 * Parse resume into structured sections
 */
async function parseResume(resumeText) {
  const sections = {
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: []
  };

  // Simple section detection using common headers
  const lines = resumeText.split('\n');
  let currentSection = 'summary';

  const sectionPatterns = {
    experience: /^(experience|work\s*history|employment)/i,
    education: /^(education|academic|qualification)/i,
    skills: /^(skills|technical\s*skills|technologies)/i,
    projects: /^(projects|portfolio|personal\s*projects)/i,
    certifications: /^(certifications?|certificates?|credentials)/i,
    summary: /^(summary|profile|objective|about)/i
  };

  let buffer = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line is a section header
    let newSection = null;
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      if (pattern.test(trimmedLine)) {
        newSection = section;
        break;
      }
    }

    if (newSection) {
      // Save current buffer to current section
      if (buffer.length > 0) {
        if (Array.isArray(sections[currentSection])) {
          sections[currentSection].push(buffer.join('\n'));
        } else {
          sections[currentSection] = buffer.join('\n');
        }
        buffer = [];
      }
      currentSection = newSection;
    } else if (trimmedLine) {
      buffer.push(trimmedLine);
    }
  }

  // Save remaining buffer
  if (buffer.length > 0) {
    if (Array.isArray(sections[currentSection])) {
      sections[currentSection].push(buffer.join('\n'));
    } else {
      sections[currentSection] = buffer.join('\n');
    }
  }

  return sections;
}

/**
 * Generate interview questions by uploading PDF directly to Gemini
 * This gives better results as Gemini can read the original formatting
 * Matches Python: question_generator.generate_from_file()
 */
async function generateQuestionsFromFile(filePath) {
  if (!getGenAIClient()) {
    console.warn('⚠️ Gemini API not configured, using fallback questions');
    const resumeText = await extractText(filePath);
    return generateFallbackQuestions(resumeText);
  }

  const NUM_QUESTIONS = 20;
  
  // Check if file is PDF
  const isPdf = filePath.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    console.log('📝 File is not PDF, using text extraction mode');
    const resumeText = await extractText(filePath);
    return generateQuestions(resumeText);
  }

  console.log(`📝 Uploading PDF directly to Gemini: ${path.basename(filePath)}`);
  
  // Read file as base64
  const fileBuffer = await fs.readFile(filePath);
  const base64Data = fileBuffer.toString('base64');
  
  // System prompt (same as text-based)
  const systemPrompt = `You are a senior technical interviewer with 15+ years at FAANG companies.
You conduct interviews like a REAL human - conversational, curious, and deeply probing.

YOUR INTERVIEWING STYLE:
1. You DON'T ask robotic, one-line questions
2. You GO DEEP on each topic - "Why did you choose that?", "What if we used X instead?", "How would you scale this?"
3. You CONNECT questions naturally - one answer leads to the next question
4. You sound like a curious colleague, NOT a checklist reader
5. You CHALLENGE the candidate respectfully - "That's interesting, but what about...?"

QUESTION FLOW PHILOSOPHY:
- Start with their MOST IMPRESSIVE achievement and dig deep
- Move from "what you did" → "why you did it" → "what you learned" → "what you'd do differently"
- For each technology/project, ask: implementation → challenges → alternatives → scaling
- End each topic with a forward-looking question: "How would you improve this now?"

FORBIDDEN PATTERNS (NEVER use these):
❌ "Tell me about your roles and responsibilities"
❌ "Describe your experience with X"
❌ "What projects have you worked on?"
❌ "Can you explain your experience?"
❌ Any question that could apply to ANY resume

REQUIRED PATTERNS (ALWAYS use these):
✅ Reference EXACT project names, company names, tech stack, metrics from resume
✅ Ask "Why did you choose [specific tech] over [alternative]?"
✅ Ask "You achieved [specific metric]. Walk me through how."
✅ Ask "What would break first if this scaled 10x?"
✅ Ask "If you rebuilt [project] today, what would you change?"

OUTPUT: Valid JSON. Each question must sound like something a real interviewer would say out loud.`;

  const userPrompt = `Read this resume PDF THOROUGHLY. You are about to interview this candidate.

Generate ${NUM_QUESTIONS} interview questions that form a NATURAL CONVERSATION FLOW.

CRITICAL INSTRUCTIONS:

1. QUESTION STRUCTURE - Each question should explore depth, not breadth:
   Instead of: "Tell me about Project X" (surface level)
   Do this:
   - "In your [Project X] using [Tech Y], you mentioned [specific achievement]. 
      What was the most counterintuitive decision you made, and why did it work?"

2. FOLLOW THE THREAD - Questions should connect:
   Q1: About their main project's architecture
   Q2: "You mentioned using [service]. Why not [alternative]? What tradeoffs did you consider?"
   Q3: "That's a good point about [their reasoning]. But what happens when [edge case]?"
   Q4: "Interesting. How would you redesign this knowing what you know now?"

3. QUESTION TYPES TO MIX:

   DEEP-DIVE (40%): Explore ONE thing deeply
   - "In [Project], you used [Tech]. Walk me through a specific bug you encountered and how you debugged it."
   - "You achieved [X% improvement]. What metrics did you track? What surprised you?"
   
   TRADEOFF (25%): Test decision-making
   - "Why [Tech A] over [Tech B] for [this specific use case in their project]?"
   - "You chose [Architecture]. What would you sacrifice to make it 10x faster?"
   
   SCALING/EDGE CASES (20%): Test systems thinking
   - "Your [system] handles [current load]. What breaks first at 100x scale?"
   - "What's the failure mode you're most worried about in [their project]?"
   
   RETROSPECTIVE (15%): Test growth mindset
   - "If you rebuilt [Project] from scratch today, what would you do differently?"
   - "What's the one thing you learned at [Company] that you couldn't have learned elsewhere?"

4. DIFFICULTY PROGRESSION:
   - Start MEDIUM (establish rapport with achievable questions)
   - Go HARD (challenge them on specifics)
   - Mix in EASY (let them recover and show strengths)
   - End MEDIUM-HARD (leave strong impression)

5. SECTION COVERAGE (MANDATORY - STRICT REQUIREMENT):
   You MUST generate EXACTLY ${NUM_QUESTIONS} questions covering ALL these sections.
   
   MINIMUM QUESTIONS PER SECTION (if section exists in resume):
   - WORK EXPERIENCES: 3-4 questions (Professional roles, impact, challenges faced)
   - INTERNSHIPS: 2-3 questions (Learning, contributions, what you'd do differently)  
   - PROJECTS: 4-5 questions (Architecture, tech stacks, challenges, scaling)
   - TECHNICAL SKILLS: 3-4 questions (Conceptual depth, "how does X work under the hood?", "explain Y to a junior")
   - LEADERSHIP/EXTRACURRICULAR: 2 questions (Team dynamics, initiative, conflict resolution)
   - ACHIEVEMENTS/AWARDS: 1-2 questions ("What did you do to earn X?", "How did you stand out?")
   - EDUCATION: 1-2 questions (Relevant coursework, thesis, foundational knowledge)
   
   CRITICAL RULES:
   - Do NOT skip ANY section that exists in the resume!
   - Do NOT generate only 10-12 questions - you MUST hit ${NUM_QUESTIONS}!
   - If the resume mentions technical skills like Python, AWS, Docker - ask conceptual questions about them!
   - If the resume mentions leadership/volunteer work - ask about team experiences!
   - If the resume mentions achievements/awards - ask what they did to earn them!
   - Spread questions across ALL available sections, not just projects and experience!

6. PERSONALIZATION REQUIREMENTS:
   Every single question MUST contain at least ONE of:
   - Exact company name from their resume
   - Exact project name from their resume
   - Exact technology/tool from their resume
   - Exact metric/achievement from their resume
   
   If the resume mentions "Improved API latency by 40%", your question should say "40%", not "improved latency"

OUTPUT FORMAT (JSON) - KEEP IT CONCISE:
{
    "summary": "1-2 sentence candidate profile",
    "questions": [
        {
            "question": "The full question text",
            "type": "deep_dive|tradeoff|scaling|retrospective|behavioral",
            "difficulty": "easy|medium|hard",
            "expectedAnswer": "2-3 key points only",
            "section": "experience|projects|skills|internships|leadership|achievements|education",
            "keywords": ["3-5 keywords max"],
            "followUps": ["1 follow-up question"]
        }
    ]
}

CRITICAL: Generate ALL ${NUM_QUESTIONS} questions. Do NOT stop early. Output complete valid JSON.

NOW READ THE RESUME AND GENERATE ${NUM_QUESTIONS} QUESTIONS.`;

  // Gemini models to try in order (updated Feb 2026)
  // See: https://ai.google.dev/models
  const modelNames = [
    'gemini-2.5-flash',       // Latest stable - 65k output tokens!
    'gemini-flash-latest',    // Auto-latest flash
    'gemini-2.0-flash',       // Fallback 2.0
    'gemini-pro-latest'       // Pro as final fallback
  ];

  let lastError = null;

  for (const modelName of modelNames) {
    let success = false;
    let attempts = 0;
    const maxAttempts = Math.max(1, apiKeys.length);

    while (!success && attempts < maxAttempts) {
      attempts++;
      
      try {
        console.log(`📝 Trying Gemini model: ${modelName} (Attempt ${attempts}/${maxAttempts}, Key Index: ${currentKeyIndex})...`);
        
        const genAI = getGenAIClient();
        if (!genAI) throw new Error("Gemini API not configured");

        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            maxOutputTokens: 32768, // gemini-2.5-flash supports up to 65k
            temperature: 0.7,
            responseMimeType: "application/json",
          }
        });

        // Build request with inline PDF data
        const parts = [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data
            }
          },
          { text: systemPrompt + '\n\n' + userPrompt }
        ];

        console.log(`📝 Sending PDF to Gemini (model: ${modelName})...`);
        const result = await model.generateContent(parts);
        
        const responseText = result.response.text();
        console.log(`📝 ✅ Gemini response received (${responseText.length} chars)`);

        // Parse JSON response
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          // Try to clean up the response
          let cleanResponse = responseText.trim();
          if (cleanResponse.includes('```json')) {
            cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          }
          let jsonStart = cleanResponse.indexOf('{');
          let jsonEnd = cleanResponse.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
          }
          cleanResponse = cleanResponse.replace(/,\s*([}\]])/g, '$1');
          data = JSON.parse(cleanResponse);
        }

        const rawQuestions = data.questions || [];
        console.log(`📝 Parsed ${rawQuestions.length} questions from Gemini (PDF mode)`);

        // Normalize questions
        const questions = rawQuestions.map((q, index) => ({
          question: q.question || `Question ${index + 1}`,
          type: q.type || 'theoretical',
          difficulty: q.difficulty || 'medium',
          expectedAnswer: q.expectedAnswer || q.expected_answer || '',
          section: q.section || 'general',
          keywords: q.keywords || [],
          asked: false
        })).filter(q => q.question && q.question.length > 10);

        if (questions.length < 5) {
          console.warn('⚠️ Too few questions from Gemini, using fallback');
          throw new Error('Too few questions generated');
        }

        console.log(`✅ Generated ${questions.length} resume-based questions using ${modelName} (PDF mode)`);
        
        // Store the summary for report generation
        if (data.summary) {
          questions.resumeSummary = data.summary;
        }
        
        return questions;

      } catch (error) {
        const errorStr = error.message || '';
        console.error(`❌ Gemini model ${modelName} failed (Attempt ${attempts}/${maxAttempts}):`, errorStr);
        lastError = error;
        
        if (errorStr.includes('429') || errorStr.includes('rate') || errorStr.includes('quota')) {
           if (rotateApiKey()) {
               console.log('🔄 Rate limited. Switched API key and retrying immediately...');
               continue;
           } else {
               const retryMatch = errorStr.match(/retry in (\d+(?:\.\d+)?)/i);
               const suggestedWait = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 0;
               const waitTime = Math.max(suggestedWait, 10 + (modelNames.indexOf(modelName) * 15));
               console.log(`⏳ Rate limited (Single Key). Waiting ${waitTime}s before next model...`);
               await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
               break; 
           }
        } else if (errorStr.includes('404') || errorStr.includes('not found')) {
           console.log(`⚠️ Model ${modelName} not found, trying next...`);
           break;
        } else {
           break;
        }
      }
    }
  }

  // All models failed - use fallback
  console.error('❌ All Gemini models failed (PDF mode), using fallback:', lastError?.message);
  const resumeText = await extractText(filePath);
  return generateFallbackQuestions(resumeText);
}

/**
 * Generate interview questions from resume using Gemini
 * Ported from Python question_generator.py
 */
async function generateQuestions(resumeText) {
  if (!getGenAIClient()) {
    console.warn('⚠️ Gemini API not configured, using fallback questions');
    return generateFallbackQuestions(resumeText);
  }

  const NUM_QUESTIONS = 20;

  // System prompt - defines the interviewer's persona (from Python)
  const systemPrompt = `You are a senior technical interviewer with 15+ years at FAANG companies.
You conduct interviews like a REAL human - conversational, curious, and deeply probing.

YOUR INTERVIEWING STYLE:
1. You DON'T ask robotic, one-line questions
2. You GO DEEP on each topic - "Why did you choose that?", "What if we used X instead?", "How would you scale this?"
3. You CONNECT questions naturally - one answer leads to the next question
4. You sound like a curious colleague, NOT a checklist reader
5. You CHALLENGE the candidate respectfully - "That's interesting, but what about...?"

QUESTION FLOW PHILOSOPHY:
- Start with their MOST IMPRESSIVE achievement and dig deep
- Move from "what you did" → "why you did it" → "what you learned" → "what you'd do differently"
- For each technology/project, ask: implementation → challenges → alternatives → scaling
- End each topic with a forward-looking question: "How would you improve this now?"

FORBIDDEN PATTERNS (NEVER use these):
❌ "Tell me about your roles and responsibilities"
❌ "Describe your experience with X"
❌ "What projects have you worked on?"
❌ "Can you explain your experience?"
❌ Any question that could apply to ANY resume

REQUIRED PATTERNS (ALWAYS use these):
✅ Reference EXACT project names, company names, tech stack, metrics from resume
✅ Ask "Why did you choose [specific tech] over [alternative]?"
✅ Ask "You achieved [specific metric]. Walk me through how."
✅ Ask "What would break first if this scaled 10x?"
✅ Ask "If you rebuilt [project] today, what would you change?"

OUTPUT: Valid JSON. Each question must sound like something a real interviewer would say out loud.`;
  const userPrompt = `You are interviewing a candidate. Here is their resume:

RESUME CONTENT:
${resumeText.substring(0, 10000)}

Generate ${NUM_QUESTIONS} questions following the NATURAL INTERVIEW FLOW approach.

Remember:
1. Go DEEP, not wide - multiple questions on the SAME topic exploring different angles
2. EVERY question must reference SPECIFIC names/numbers from this resume
3. Sound like a real human interviewer, not a robot reading a checklist
4. Include follow-ups for each question
5. Test: implementation → decision-making → scaling → learning

QUESTION DISTRIBUTION:
- 40% Deep-dive into specific projects/experiences  
- 25% Tradeoff and decision questions
- 20% Scaling and edge case scenarios
- 15% Retrospective and growth questions

SECTION COVERAGE:
Ensure the questions span across all available sections:
- Work Experience & Internships
- Personal & Academic Projects
- Technical Skills (Theoretical & Practical)
- Leadership & Soft Skills
- Educational Background

OUTPUT FORMAT (JSON):
{
    "summary": "1-2 sentence candidate profile",
    "questions": [
        {
            "question": "The full question text",
            "type": "deep_dive|tradeoff|scaling|retrospective|behavioral",
            "difficulty": "easy|medium|hard",
            "expectedAnswer": "2-3 key points only",
            "section": "experience|projects|skills|internships|leadership|achievements|education",
            "keywords": ["3-5 keywords max"],
            "followUps": ["1 follow-up question"]
        }
    ]
}

Generate ALL ${NUM_QUESTIONS} questions. Return ONLY valid JSON.`;

  // Gemini models to try in order (updated Feb 2026)
  const modelNames = [
    'gemini-2.5-flash',       // Latest stable - 65k output tokens!
    'gemini-flash-latest',    // Auto-latest flash
    'gemini-2.0-flash',       // Fallback 2.0 
    'gemini-pro-latest'       // Pro as final fallback
  ];

  let lastError = null;
  
  for (const modelName of modelNames) {
    let success = false;
    let attempts = 0;
    // Allow retries with different keys (if available) for the same model
    const maxAttempts = Math.max(1, apiKeys.length);

    while (!success && attempts < maxAttempts) {
      attempts++;
      
      try {
        console.log(`📝 Trying Gemini model: ${modelName} (Attempt ${attempts}/${maxAttempts}, Key Index: ${currentKeyIndex})...`);
        
        const genAI = getGenAIClient();
        if (!genAI) throw new Error("Gemini API not configured");

        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            maxOutputTokens: 32768,  // gemini-2.5-flash supports up to 65k
            temperature: 0.7,
            responseMimeType: "application/json", 
          }
        });

        // Combine system prompt and user prompt into a single string
        const fullPrompt = systemPrompt + '\n\n' + userPrompt;
        
        console.log(`📝 Sending request to Gemini (model: ${modelName})...`);
        const result = await model.generateContent(fullPrompt);
        
        const responseText = result.response.text();
        console.log(`📝 ✅ Gemini response received (${responseText.length} chars)`);

        // Extract JSON from response - handle various formats Gemini might return
        let data;
        try {
          // Clean response (remove markdown code blocks if present)
          let cleanResponse = responseText.trim();
          
          // Remove markdown code blocks
          if (cleanResponse.includes('```json')) {
            cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          } else if (cleanResponse.includes('```')) {
            cleanResponse = cleanResponse.replace(/```\s*/g, '');
          }
          
          // Trim again after removing markdown
          cleanResponse = cleanResponse.trim();
          
          // Try to find JSON object or array
          let jsonStart = cleanResponse.indexOf('{');
          let jsonEnd = cleanResponse.lastIndexOf('}');
          
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            cleanResponse = cleanResponse.substring(jsonStart, jsonEnd + 1);
          }
  
          // Fix common JSON issues from LLMs
          // 1. Remove trailing commas before } or ]
          cleanResponse = cleanResponse.replace(/,\s*([}\]])/g, '$1');
          // 2. Fix unescaped newlines in strings (improved)
          cleanResponse = cleanResponse.replace(/(["'])([^"']*?)\n([^"']*?)\1/g, (match, quote, before, after) => {
            return quote + before + '\\n' + after + quote;
          });
          // 3. Fix truncated JSON - ensure array closes properly
          if (cleanResponse.includes('"questions"')) {
            // Count brackets to check if balanced
            const openBrackets = (cleanResponse.match(/\[/g) || []).length;
            const closeBrackets = (cleanResponse.match(/\]/g) || []).length;
            const openBraces = (cleanResponse.match(/\{/g) || []).length;
            const closeBraces = (cleanResponse.match(/\}/g) || []).length;
            
            // Add missing closing brackets
            if (openBrackets > closeBrackets) {
              cleanResponse = cleanResponse + ']'.repeat(openBrackets - closeBrackets);
            }
            if (openBraces > closeBraces) {
              cleanResponse = cleanResponse + '}'.repeat(openBraces - closeBraces);
            }
            
            // Remove incomplete last object if needed
            cleanResponse = cleanResponse.replace(/,\s*\{[^}]*$/g, '');
          }
          
          // Try to parse as object first
          data = JSON.parse(cleanResponse);
        } catch (parseError) {
          console.error('Failed to parse cleaned JSON, trying to extract questions array...', parseError.message);
          
          // Try to find just the questions array
          const questionsMatch = responseText.match(/"questions"\s*:\s*\[([\s\S]*?)\](?=\s*[,}]|$)/);
          if (questionsMatch) {
            try {
              let questionsJson = '[' + questionsMatch[1] + ']';
              // Fix trailing commas and incomplete objects
              questionsJson = questionsJson.replace(/,\s*([}\]])/g, '$1');
              questionsJson = questionsJson.replace(/,\s*\{[^}]*$/g, ''); // Remove incomplete last object
              // Balance brackets
              const openBraces = (questionsJson.match(/\{/g) || []).length;
              const closeBraces = (questionsJson.match(/\}/g) || []).length;
              if (openBraces > closeBraces) {
                questionsJson = questionsJson.replace(/,\s*\{[^}]*$/g, ''); // Try again
              }
              const questions = JSON.parse(questionsJson);
              data = { questions, summary: 'Resume-based questions' };
            } catch (e2) {
              console.error('Questions array parse failed:', e2.message);
              // Try extracting individual question objects
              const questionObjectsRegex = /\{\s*"question"\s*:\s*"[^"]+"[^}]*\}/g;
              const questionMatches = responseText.match(questionObjectsRegex);
              if (questionMatches && questionMatches.length >= 5) {
                const questions = [];
                for (const qMatch of questionMatches) {
                  try {
                    const qObj = JSON.parse(qMatch.replace(/,\s*([}\]])/g, '$1'));
                    if (qObj.question) questions.push(qObj);
                  } catch (e3) {
                    // Skip malformed object
                  }
                }
                if (questions.length >= 5) {
                  data = { questions, summary: 'Resume-based questions' };
                } else {
                  throw new Error('Not enough valid questions extracted');
                }
              } else {
                throw new Error('No valid JSON found in response');
              }
            }
          } else {
            throw new Error('No questions array found in response');
          }
        }
  
        const rawQuestions = data.questions || [];
        console.log(`📝 Parsed ${rawQuestions.length} questions from Gemini`);
  
        // Validate and normalize questions
        const questions = rawQuestions.map((q, index) => ({
          question: q.question || `Question ${index + 1}`,
          type: q.type || 'theoretical',
          difficulty: q.difficulty || 'medium',
          expectedAnswer: q.expectedAnswer || q.expected_answer || '',
          section: q.section || 'general',
          keywords: q.keywords || [],
          followUps: q.followUps || q.follow_ups || [],
          asked: false
        })).filter(q => q.question && q.question.length > 10);
  
        if (questions.length < 5) {
          console.warn('⚠️ Too few questions from Gemini, using fallback');
          throw new Error('Too few questions generated');
        }
  
        console.log(`✅ Generated ${questions.length} resume-based questions using ${modelName}`);
        return questions;

      } catch (error) {
        const errorStr = error.message || '';
        console.error(`❌ Gemini model ${modelName} failed (Attempt ${attempts}/${maxAttempts}):`, errorStr);
        lastError = error;
        
        // If rate limited (429), try rotating key
        if (errorStr.includes('429') || errorStr.includes('rate') || errorStr.includes('quota')) {
          if (rotateApiKey()) {
             console.log('🔄 Rate limited. Switched API key and retrying immediately...');
             continue; // Retry inner loop (same model, new key)
          } else {
             // Single key case - wait
             const retryMatch = errorStr.match(/retry in (\d+(?:\.\d+)?)/i);
             const suggestedWait = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 0;
             const waitTime = Math.max(suggestedWait, 10 + (modelNames.indexOf(modelName) * 15));
             console.log(`⏳ Rate limited (Single Key). Waiting ${waitTime}s before next model...`);
             await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
             break; // Break logic to try next model
          }
        } else if (errorStr.includes('404') || errorStr.includes('not found')) {
          console.log(`⚠️ Model ${modelName} not found, trying next...`);
          break;
        } else {
          break; // Other error, try next model
        }
      }
    }
  }

  // All models failed
  console.error('❌ All Gemini models failed, using fallback:', lastError?.message);
  return generateFallbackQuestions(resumeText);
}

/**
 * Generate fallback questions when Gemini is unavailable
 */
function generateFallbackQuestions(resumeText) {
  const detectedSkills = detectSkills(resumeText);
  const questions = [];

  // Generic project questions
  questions.push({
    question: "Can you walk me through the most challenging project you've worked on?",
    type: 'project',
    difficulty: 'medium',
    expectedAnswer: 'Describe the project, challenges faced, solutions implemented, and outcomes',
    section: 'experience',
    keywords: ['challenge', 'solution', 'outcome'],
    asked: false
  });

  questions.push({
    question: "What was a significant technical decision you made in your last project?",
    type: 'tradeoff',
    difficulty: 'medium',
    expectedAnswer: 'Describe the decision, alternatives considered, and reasoning',
    section: 'experience',
    keywords: ['decision', 'alternative', 'tradeoff'],
    asked: false
  });

  // Add skill-specific questions
  detectedSkills.forEach(skill => {
    questions.push({
      question: `Tell me about your experience with ${skill}. What projects have you used it in?`,
      type: 'experience',
      difficulty: 'easy',
      expectedAnswer: `Describe practical experience with ${skill}`,
      section: 'skills',
      keywords: [skill.toLowerCase()],
      asked: false
    });

    questions.push({
      question: `What are some best practices you follow when working with ${skill}?`,
      type: 'theoretical',
      difficulty: 'medium',
      expectedAnswer: `Describe best practices and standards for ${skill}`,
      section: 'skills',
      keywords: ['best practices', skill.toLowerCase()],
      asked: false
    });
  });

  // Add behavioral questions
  questions.push({
    question: "Describe a time when you had to learn a new technology quickly. How did you approach it?",
    type: 'behavioral',
    difficulty: 'easy',
    expectedAnswer: 'Describe learning approach, resources used, and outcome',
    section: 'general',
    keywords: ['learning', 'approach', 'adapt'],
    asked: false
  });

  questions.push({
    question: "Tell me about a time when you disagreed with a team member about a technical approach.",
    type: 'behavioral',
    difficulty: 'medium',
    expectedAnswer: 'Describe the situation, how you handled it, and the resolution',
    section: 'general',
    keywords: ['disagreement', 'resolution', 'team'],
    asked: false
  });

  // Add scaling question
  questions.push({
    question: "If you had to scale one of your past projects to handle 10x the load, what would you change?",
    type: 'scaling',
    difficulty: 'hard',
    expectedAnswer: 'Discuss caching, database optimization, horizontal scaling, etc.',
    section: 'experience',
    keywords: ['scaling', 'performance', 'optimization'],
    asked: false
  });

  // Add retrospective question
  questions.push({
    question: "Looking back at a past project, what would you do differently if you could start over?",
    type: 'retrospective',
    difficulty: 'medium',
    expectedAnswer: 'Discuss lessons learned and improvements',
    section: 'experience',
    keywords: ['improvement', 'lesson', 'differently'],
    asked: false
  });

  return questions.slice(0, 20);
}

module.exports = {
  extractText,
  detectSkills,
  parseResume,
  generateQuestions,
  generateQuestionsFromFile,  // Direct PDF upload to Gemini
  generateFallbackQuestions,
  SKILL_PATTERNS
};
