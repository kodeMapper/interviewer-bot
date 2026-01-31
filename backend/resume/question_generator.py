"""
Question Generator
Generates industry-level interview questions from parsed resume data.

Produces 15-20 questions covering:
- Technical/Theoretical questions on skills
- Conceptual understanding questions
- Scenario-based questions
- Puzzle/Problem-solving questions
- Behavioral questions on experiences
- Project deep-dive questions
"""

import json
import random
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from .gpt_client import GPTClient, GPTClientError, GPTConfig
from .parser import ParsedResume


class QuestionType(Enum):
    """Types of interview questions."""
    THEORETICAL = "theoretical"
    CONCEPTUAL = "conceptual"
    SCENARIO = "scenario"
    PUZZLE = "puzzle"
    BEHAVIORAL = "behavioral"
    PROJECT = "project"
    EXPERIENCE = "experience"


class QuestionDifficulty(Enum):
    """Question difficulty levels."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


@dataclass
class GeneratedQuestion:
    """Represents a single generated question with metadata."""
    question: str
    question_type: QuestionType
    difficulty: QuestionDifficulty
    expected_answer: str
    section_source: str  # Which resume section this relates to
    follow_up_hints: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "question": self.question,
            "question_type": self.question_type.value,
            "difficulty": self.difficulty.value,
            "expected_answer": self.expected_answer,
            "section_source": self.section_source,
            "follow_up_hints": self.follow_up_hints,
            "keywords": self.keywords
        }


@dataclass
class ResumeQuestionSet:
    """Complete set of questions generated from resume."""
    questions: List[GeneratedQuestion]
    resume_summary: str
    generation_time: float = 0.0
    token_usage: Dict[str, int] = field(default_factory=dict)
    
    def get_by_type(self, q_type: QuestionType) -> List[GeneratedQuestion]:
        """Get questions of a specific type."""
        return [q for q in self.questions if q.question_type == q_type]
    
    def get_by_difficulty(self, difficulty: QuestionDifficulty) -> List[GeneratedQuestion]:
        """Get questions of a specific difficulty."""
        return [q for q in self.questions if q.difficulty == difficulty]
    
    def shuffle(self) -> None:
        """Randomly shuffle questions for variety."""
        random.shuffle(self.questions)
    
    def get_balanced_order(self) -> List[GeneratedQuestion]:
        """
        Get questions in balanced order:
        - Start with medium difficulty
        - Mix question types
        - End with harder questions
        """
        easy = self.get_by_difficulty(QuestionDifficulty.EASY)
        medium = self.get_by_difficulty(QuestionDifficulty.MEDIUM)
        hard = self.get_by_difficulty(QuestionDifficulty.HARD)
        
        random.shuffle(easy)
        random.shuffle(medium)
        random.shuffle(hard)
        
        # Interleave: medium -> easy -> medium -> hard
        ordered = []
        iterators = [iter(medium), iter(easy), iter(hard)]
        
        while True:
            added = False
            for it in iterators:
                try:
                    ordered.append(next(it))
                    added = True
                except StopIteration:
                    pass
            if not added:
                break
        
        return ordered


class QuestionGenerator:
    """
    Generates interview questions from parsed resume using GPT.
    
    Features:
    - Natural conversational flow like a real interviewer
    - Deep-dive questioning (why, what if, how to scale)
    - Adaptive follow-up generation
    - Industry-level depth
    """
    
    # System prompt - defines the interviewer's persona
    SYSTEM_PROMPT = """You are a senior technical interviewer with 15+ years at FAANG companies.
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

OUTPUT: Valid JSON. Each question must sound like something a real interviewer would say out loud."""

    # Main prompt for direct PDF upload
    DIRECT_PDF_PROMPT = """Read this resume THOROUGHLY. You are about to interview this candidate.

Generate {num_questions} interview questions that form a NATURAL CONVERSATION FLOW.

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
   You MUST generate EXACTLY {num_questions} questions covering ALL these sections.
   
   MINIMUM QUESTIONS PER SECTION (if section exists in resume):
   - WORK EXPERIENCES: 3-4 questions (Professional roles, impact, challenges faced)
   - INTERNSHIPS: 2-3 questions (Learning, contributions, what you'd do differently)  
   - PROJECTS: 4-5 questions (Architecture, tech stacks, challenges, scaling)
   - TECHNICAL SKILLS: 3-4 questions (Conceptual depth, "how does X work under the hood?", "explain Y to a junior")
   - LEADERSHIP/EXTRACURRICULAR: 2 questions (Team dynamics, initiative, conflict resolution)
   - ACHIEVEMENTS/AWARDS: 1-2 questions ("What did you do to earn X?", "How did you stand out?")
   - EDUCATION: 1-2 questions (Relevant coursework, thesis, foundational knowledge)
   
   CRITICAL RULES:
   ❌ Do NOT skip ANY section that exists in the resume!
   ❌ Do NOT generate only 10-12 questions - you MUST hit {num_questions}!
   ✅ If the resume mentions technical skills like Python, AWS, Docker - ask conceptual questions about them!
   ✅ If the resume mentions leadership/volunteer work - ask about team experiences!
   ✅ If the resume mentions achievements/awards - ask what they did to earn them!
   ✅ Spread questions across ALL available sections, not just projects and experience!

6. PERSONALIZATION REQUIREMENTS:
   Every single question MUST contain at least ONE of:
   - Exact company name from their resume
   - Exact project name from their resume
   - Exact technology/tool from their resume
   - Exact metric/achievement from their resume
   
   If the resume mentions "Improved API latency by 40%", your question should say "40%", not "improved latency"

OUTPUT FORMAT (JSON) - KEEP IT CONCISE:
{{
    "summary": "1-2 sentence candidate profile",
    "questions": [
        {{
            "question": "The full question text",
            "type": "deep_dive|tradeoff|scaling|retrospective|behavioral",
            "difficulty": "easy|medium|hard",
            "expected_answer": "2-3 key points only",
            "section": "experience|projects|skills|internships|leadership|achievements|education",
            "keywords": ["3-5 keywords max"],
            "follow_ups": ["1 follow-up question"]
        }}
    ]
}}

CRITICAL: Generate ALL {num_questions} questions. Do NOT stop early. Output complete valid JSON.

NOW READ THE RESUME AND GENERATE {num_questions} QUESTIONS:"""

    # Text-based prompt (when PDF upload not available)
    GENERATION_PROMPT_TEMPLATE = """
You are interviewing a candidate. Here is their resume:

RESUME CONTENT:
{resume_text}

PARSED INFORMATION:
- Skills: {skills}
- Experience Entries: {experience_count}
- Projects: {project_count}
- Education: {education}
- Apparent Seniority: {seniority}

Generate {num_questions} questions following the NATURAL INTERVIEW FLOW approach.

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

OUTPUT as JSON with the structure specified above."""

    def __init__(self, gpt_client: Optional[GPTClient] = None):
        """
        Initialize question generator.
        
        Args:
            gpt_client: Optional GPT client. Creates one if not provided.
        """
        self.gpt_client = gpt_client or GPTClient()
        self._fallback_enabled = True
        self._direct_pdf_mode = True
    
    def generate_from_file(
        self,
        file_path: str,
        parsed_resume: Optional[ParsedResume] = None,
        num_questions: int = 10
    ) -> ResumeQuestionSet:
        """
        Generate interview questions by uploading the resume file directly to Gemini.
        This is more accurate as Gemini can read the original formatting.
        """
        import time
        import os
        start_time = time.time()
        
        if not file_path.lower().endswith('.pdf'):
            print(f"   [Generator] File is not PDF, using text extraction mode")
            if parsed_resume:
                return self.generate(parsed_resume, num_questions)
            raise ValueError("Non-PDF files require parsed_resume parameter")
        
        print(f"   [Generator] Uploading resume directly to Gemini...")
        
        prompt = self.DIRECT_PDF_PROMPT.format(num_questions=num_questions)
        
        try:
            response = self.gpt_client.generate_with_file(
                prompt=prompt,
                file_path=file_path,
                system_prompt=self.SYSTEM_PROMPT,
                json_mode=True
            )
            
            # --- DEBUG: Log Raw Response (overwritten each run for debugging) ---
            import os
            debug_log_path = os.path.join(os.path.dirname(file_path), "gemini_raw_response.txt")
            try:
                with open(debug_log_path, "w", encoding="utf-8") as f:
                    f.write(f"=== GEMINI RAW RESPONSE ({num_questions} questions requested) ===\n")
                    f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                    f.write(f"Response length: {len(response)} chars\n")
                    f.write("=" * 60 + "\n\n")
                    f.write(response)
                print(f"   [Generator] 📝 Raw response saved to '{debug_log_path}'")
            except Exception as e:
                print(f"   [Generator] ⚠️ Could not save debug log: {e}")
            # ---------------------------------------------------------------------
            
            questions, summary = self._parse_response(response, parsed_resume)
            
            generation_time = time.time() - start_time
            print(f"   [Generator] Generated {len(questions)} questions in {generation_time:.1f}s (direct PDF mode)")
            
            if not questions and parsed_resume and self._fallback_enabled:
                print(f"   [Generator] No questions extracted, using fallback...")
                return self._generate_fallback(parsed_resume)
            
            return ResumeQuestionSet(
                questions=questions,
                resume_summary=summary,
                generation_time=generation_time,
                token_usage=self.gpt_client.get_token_usage()
            )
            
        except Exception as e:
            print(f"   [Generator] Direct PDF mode failed: {e}")
            if parsed_resume and self._fallback_enabled:
                print(f"   [Generator] Falling back to personalized questions...")
                return self._generate_fallback(parsed_resume)
            raise

    def generate(
        self,
        parsed_resume: ParsedResume,
        num_questions: int = 18,
        raw_text: str = ""
    ) -> ResumeQuestionSet:
        """
        Generate interview questions from parsed resume (text-based mode).
        
        Args:
            parsed_resume: Structured resume data
            num_questions: Target number of questions (default 18 for 15-20 range)
            raw_text: Original resume text for context
            
        Returns:
            ResumeQuestionSet with generated questions
        """
        import time
        start_time = time.time()
        
        # Build the prompt with resume details
        prompt = self._build_prompt(parsed_resume, num_questions, raw_text)
        
        try:
            # Call GPT for question generation
            print(f"   [Generator] Generating {num_questions} questions...")
            
            response = self.gpt_client.generate(
                prompt=prompt,
                system_prompt=self.SYSTEM_PROMPT,
                json_mode=True
            )
            
            # Parse the response
            questions, summary = self._parse_response(response, parsed_resume)
            
            generation_time = time.time() - start_time
            print(f"   [Generator] Generated {len(questions)} questions in {generation_time:.1f}s")
            
            return ResumeQuestionSet(
                questions=questions,
                resume_summary=summary,
                generation_time=generation_time,
                token_usage=self.gpt_client.get_token_usage()
            )
            
        except GPTClientError as e:
            print(f"   [Generator] GPT Error: {e}")
            
            # Return fallback questions if GPT fails
            if self._fallback_enabled:
                return self._generate_fallback(parsed_resume)
            raise
    
    def _build_prompt(
        self,
        parsed: ParsedResume,
        num_questions: int,
        raw_text: str
    ) -> str:
        """Build the generation prompt with resume details."""
        
        # Collect skills
        skills_list = ", ".join(parsed.skills[:15]) if parsed.skills else "Not specified"
        
        # Determine sections to cover
        sections = []
        if parsed.skills:
            sections.append("skills")
        if parsed.experience:
            sections.append("work experience")
        if parsed.internships:
            sections.append("internships")
        if parsed.projects:
            sections.append("projects")
        if parsed.education:
            sections.append("education")
        if parsed.leadership:
            sections.append("leadership")
        
        # Format education
        education_text = parsed.education[0] if parsed.education else "Not specified"
        
        # Use raw text or reconstruct from parsed sections
        if not raw_text:
            raw_text = self._reconstruct_resume_text(parsed)
        
        return self.GENERATION_PROMPT_TEMPLATE.format(
            num_questions=num_questions,
            resume_text=raw_text[:4000],  # Limit to avoid token overflow
            skills=skills_list,
            experience_count=len(parsed.experience) + len(parsed.internships),
            project_count=len(parsed.projects),
            education=education_text,
            seniority=parsed.seniority_level,
            sections_to_cover=", ".join(sections)
        )
    
    def _reconstruct_resume_text(self, parsed: ParsedResume) -> str:
        """Reconstruct resume text from parsed sections."""
        parts = []
        
        if parsed.name:
            parts.append(f"Name: {parsed.name}")
        
        if parsed.education:
            parts.append("EDUCATION:\n" + "\n".join(parsed.education))
        
        if parsed.experience:
            parts.append("EXPERIENCE:\n" + "\n".join(parsed.experience))
        
        if parsed.internships:
            parts.append("INTERNSHIPS:\n" + "\n".join(parsed.internships))
        
        if parsed.projects:
            parts.append("PROJECTS:\n" + "\n".join(parsed.projects))
        
        if parsed.skills:
            parts.append("SKILLS: " + ", ".join(parsed.skills))
        
        if parsed.leadership:
            parts.append("LEADERSHIP:\n" + "\n".join(parsed.leadership))
        
        return "\n\n".join(parts)
    
    def _parse_response(
        self,
        response: str,
        parsed_resume: ParsedResume
    ) -> Tuple[List[GeneratedQuestion], str]:
        """Parse GPT response into structured questions with robust error handling."""
        
        try:
            # Clean response (remove markdown if present)
            response = response.strip()
            if response.startswith("```"):
                response = re.sub(r'^```json?\n?', '', response)
                response = re.sub(r'\n?```$', '', response)
            
            # Try to repair truncated JSON
            response = self._repair_json(response)
            
            data = json.loads(response)
            
            summary = data.get("summary", "Resume-based interview questions")
            raw_questions = data.get("questions", [])

            # --- DEBUG: Print JSON Keys ---
            print(f"   [Generator] JSON parsed. Found {len(raw_questions)} raw questions.")
            if len(raw_questions) == 0:
                print(f"   [Generator] WARNING: 'questions' list is empty. Keys found: {list(data.keys())}")
            # ------------------------------
            
            questions = []
            
            # Type mapping to handle prompt vs code mismatch
            type_mapping = {
                # Prompt specific types (from FAANG prompt)
                "deep_dive": QuestionType.PROJECT,
                "tradeoff": QuestionType.SCENARIO,
                "scaling": QuestionType.CONCEPTUAL,
                "retrospective": QuestionType.EXPERIENCE,
                "behavioral": QuestionType.BEHAVIORAL,
                # Standard enum types
                "theoretical": QuestionType.THEORETICAL,
                "conceptual": QuestionType.CONCEPTUAL,
                "scenario": QuestionType.SCENARIO,
                "puzzle": QuestionType.PUZZLE,
                "project": QuestionType.PROJECT,
                "experience": QuestionType.EXPERIENCE,
                "general": QuestionType.THEORETICAL
            }

            for q in raw_questions:
                try:
                    # Safely map types
                    raw_type = q.get("type", "theoretical").lower()
                    q_type = type_mapping.get(raw_type, QuestionType.THEORETICAL)
                    
                    # Safely map difficulty
                    raw_diff = q.get("difficulty", "medium").lower()
                    try:
                        q_diff = QuestionDifficulty(raw_diff)
                    except ValueError:
                        q_diff = QuestionDifficulty.MEDIUM

                    question = GeneratedQuestion(
                        question=q.get("question", ""),
                        question_type=q_type,
                        difficulty=q_diff,
                        expected_answer=q.get("expected_answer", ""),
                        section_source=q.get("section", "general"),
                        follow_up_hints=q.get("follow_ups", []),
                        keywords=q.get("keywords", [])
                    )
                    if question.question:  # Only add if question text exists
                        questions.append(question)
                except Exception as e:
                    # Log detail about why it failed
                    print(f"   [Generator] Skipping malformed question: {e} | Data: {str(q)[:50]}...")
                    continue
            
            if questions:
                return questions, summary
            else:
                # JSON parsed but no valid questions, try extraction
                print(f"   [Generator] No valid questions in JSON after processing, trying extraction...")
                return self._extract_questions_fallback(response, parsed_resume), summary
            
        except json.JSONDecodeError as e:
            print(f"   [Generator] JSON parse error: {e}")
            # Try to extract questions from non-JSON response
            extracted = self._extract_questions_fallback(response, parsed_resume)
            if extracted:
                return extracted, "Resume-based questions"
            # If extraction also fails, return empty (will trigger fallback)
            return [], "Resume-based questions"
    
    def _repair_json(self, response: str) -> str:
        """Attempt to repair truncated, malformed, or noisy JSON responses."""
        # 1. basic cleanup of markdown code blocks
        if "```" in response:
            response = re.sub(r'```(?:json)?', '', response)
        response = response.strip()

        # 2. Extract the outermost JSON object
        # Find the first '{' and the last '}'
        start_idx = response.find('{')
        end_idx = response.rfind('}')

        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            # We have a potential candidate
            candidate = response[start_idx : end_idx + 1]
            try:
                # specific check for generic "Extra data" error:
                # if this candidate parses, it's the correct one.
                json.loads(candidate)
                return candidate
            except json.JSONDecodeError:
                # If the candidate itself is invalid (e.g. truncated inside), 
                # we fall through to the repair logic below
                response = candidate 
        
        # 3. Handle Truncation (Missing closing braces/brackets)
        open_braces = response.count('{')
        close_braces = response.count('}')
        open_brackets = response.count('[')
        close_brackets = response.count(']')
        
        # If truncated, try to close it properly
        if open_braces > close_braces or open_brackets > close_brackets:
            # Find the last complete question object in the questions array
            # This is a heuristic: it assumes a structure like {"questions": [{...}, {...
            last_close_brace = response.rfind('}')
            if last_close_brace > 0:
                # Slice up to the last known object closure
                response = response[:last_close_brace + 1]
                
                # Re-calculate counts for the sliced string
                open_brackets = response.count('[')
                close_brackets = response.count(']')
                open_braces = response.count('{')
                close_braces = response.count('}')
                
                # Add missing closing brackets/braces
                response += ']' * (open_brackets - close_brackets)
                response += '}' * (open_braces - close_braces)
        
        # 4. Fix common JSON Syntax issues via Regex
        # Remove trailing commas before ] or }
        response = re.sub(r',\s*([\]\}])', r'\1', response)
        
        return response
    
    def _extract_questions_fallback(
        self,
        response: str,
        parsed_resume: ParsedResume
    ) -> List[GeneratedQuestion]:
        """Extract questions from non-JSON response with better patterns."""
        questions = []
        
        # Pattern 1: Look for "question": "..." patterns
        pattern1 = r'"question"\s*:\s*"([^"]+(?:\\.[^"]*)*)"'
        matches = re.findall(pattern1, response, re.IGNORECASE)
        
        for match in matches[:20]:
            q_text = match.replace('\\"', '"').replace('\\n', ' ').strip()
            if q_text and len(q_text) > 10:
                questions.append(GeneratedQuestion(
                    question=q_text,
                    question_type=QuestionType.THEORETICAL,
                    difficulty=QuestionDifficulty.MEDIUM,
                    expected_answer="",
                    section_source="general",
                    follow_up_hints=[],
                    keywords=[]
                ))
        
        if questions:
            return questions
        
        # Pattern 2: Look for numbered questions ending with ?
        pattern2 = r'(?:\d+[\.\)]\s*)(.+\?)'
        matches = re.findall(pattern2, response, re.MULTILINE)
        
        for match in matches[:20]:
            q_text = match.strip()
            if q_text and len(q_text) > 10:
                questions.append(GeneratedQuestion(
                    question=q_text,
                    question_type=QuestionType.THEORETICAL,
                    difficulty=QuestionDifficulty.MEDIUM,
                    expected_answer="",
                    section_source="general",
                    follow_up_hints=[],
                    keywords=[]
                ))
        
        if questions:
            return questions
        
        # Pattern 3: Any sentence ending with ?
        pattern3 = r'([A-Z][^.!?]*\?)'
        matches = re.findall(pattern3, response)
        
        for match in matches[:20]:
            q_text = match.strip()
            if q_text and len(q_text) > 20:  # Require longer questions
                questions.append(GeneratedQuestion(
                    question=q_text,
                    question_type=QuestionType.THEORETICAL,
                    difficulty=QuestionDifficulty.MEDIUM,
                    expected_answer="",
                    section_source="general",
                    follow_up_hints=[],
                    keywords=[]
                ))
        
        return questions
    
    def _generate_fallback(self, parsed_resume: ParsedResume) -> ResumeQuestionSet:
        """Generate fallback questions when GPT fails - uses SPECIFIC names from resume."""
        print("   [Generator] Using fallback question generation")
        
        questions = []
        
        # Generate skill-based questions - SPECIFIC
        for skill in parsed_resume.skills[:5]:
            questions.append(GeneratedQuestion(
                question=f"You listed {skill} in your resume. Can you walk me through a specific project where you applied {skill} and what challenges you faced?",
                question_type=QuestionType.THEORETICAL,
                difficulty=QuestionDifficulty.MEDIUM,
                expected_answer=f"Should describe practical experience with {skill}, specific use cases and challenges",
                section_source="skills",
                keywords=[skill]
            ))
        
        # Generate project questions - SPECIFIC with project names
        for project in parsed_resume.projects[:3]:
            # project is a ResumeSection object, extract name from content
            if hasattr(project, 'name') and project.name:
                project_name = project.name[:50]
            elif hasattr(project, 'content') and project.content:
                project_name = project.content.split('.')[0][:50]
            else:
                project_name = str(project).split('.')[0][:50] if project else "your project"
            
            questions.append(GeneratedQuestion(
                question=f"In your {project_name} project, what was the most technically challenging problem you solved? Walk me through your approach.",
                question_type=QuestionType.PROJECT,
                difficulty=QuestionDifficulty.MEDIUM,
                expected_answer="Should discuss technical challenges, decision-making process, and solutions",
                section_source="projects",
                keywords=[]
            ))
        
        # Generate experience questions - SPECIFIC with company names
        for exp in parsed_resume.experience[:2]:
            # exp is a ResumeSection object
            if hasattr(exp, 'name') and exp.name:
                exp_name = exp.name[:50]
            elif hasattr(exp, 'content') and exp.content:
                exp_name = exp.content[:50]
            else:
                exp_name = str(exp)[:50] if exp else "your previous role"
            
            questions.append(GeneratedQuestion(
                question=f"At {exp_name}, what was a specific technical decision you made that had significant impact? Why did you choose that approach?",
                question_type=QuestionType.EXPERIENCE,
                difficulty=QuestionDifficulty.EASY,
                expected_answer="Should describe specific decision, alternatives considered, and measurable impact",
                section_source="experience",
                keywords=[]
            ))
        
        # Generate internship questions - SPECIFIC
        for intern in parsed_resume.internships[:2]:
            if hasattr(intern, 'name') and intern.name:
                intern_name = intern.name[:50]
            elif hasattr(intern, 'content') and intern.content:
                intern_name = intern.content.split('.')[0][:50]
            else:
                intern_name = str(intern)[:50] if intern else "your internship"
            
            questions.append(GeneratedQuestion(
                question=f"During your {intern_name} internship, what was the biggest thing you learned that you couldn't have learned in a classroom?",
                question_type=QuestionType.BEHAVIORAL,
                difficulty=QuestionDifficulty.EASY,
                expected_answer="Should describe practical learnings, real-world exposure, and growth",
                section_source="internships",
                keywords=[]
            ))
        
        # Add scenario questions based on skills
        if len(parsed_resume.skills) >= 2:
            skill1 = parsed_resume.skills[0]
            skill2 = parsed_resume.skills[1] if len(parsed_resume.skills) > 1 else parsed_resume.skills[0]
            questions.append(GeneratedQuestion(
                question=f"Given your experience with {skill1} and {skill2}, how would you design a system that needs to handle 1 million requests per day?",
                question_type=QuestionType.SCENARIO,
                difficulty=QuestionDifficulty.HARD,
                expected_answer="Should demonstrate system design thinking, scalability considerations",
                section_source="skills",
                keywords=[skill1, skill2]
            ))
        
        return ResumeQuestionSet(
            questions=questions[:18],
            resume_summary="Fallback questions based on resume sections (personalized with specific names)",
            generation_time=0.0,
            token_usage={}
        )
    
    def generate_follow_up(
        self,
        original_question: str,
        candidate_answer: str,
        context: str = ""
    ) -> str:
        """
        Generate a follow-up question based on candidate's answer.
        
        Args:
            original_question: The question that was asked
            candidate_answer: What the candidate answered
            context: Additional context (resume section, etc.)
            
        Returns:
            A probing follow-up question
        """
        prompt = f"""
Based on this interview exchange, generate ONE probing follow-up question:

Question Asked: {original_question}
Candidate's Answer: {candidate_answer}
{f'Context: {context}' if context else ''}

Generate a follow-up question that:
1. Digs deeper into their answer
2. Tests for genuine understanding
3. Is natural and conversational

Respond with just the follow-up question, nothing else.
"""
        
        try:
            return self.gpt_client.generate(
                prompt=prompt,
                system_prompt="You are a technical interviewer. Generate one follow-up question."
            ).strip()
        except:
            # Fallback follow-ups
            return random.choice([
                "Can you elaborate on that?",
                "What specific challenges did you face?",
                "How did you measure the success of that?",
                "What would you do differently next time?"
            ])


# Testing
if __name__ == "__main__":
    from .parser import ResumeParser
    
    # Sample resume text for testing
    sample_resume = """
    John Doe
    Software Engineer
    
    EDUCATION:
    B.Tech in Computer Science, IIT Delhi, 2023
    
    EXPERIENCE:
    Software Engineer at Google (2023-Present)
    - Developed microservices using Python and Go
    - Optimized database queries reducing latency by 40%
    
    INTERNSHIP:
    SDE Intern at Amazon (Summer 2022)
    - Built real-time analytics dashboard
    
    PROJECTS:
    1. ML-based Recommendation System
       - Built using Python, TensorFlow, deployed on AWS
    
    SKILLS:
    Python, Go, TensorFlow, AWS, Docker, Kubernetes
    """
    
    # Parse and generate
    parser = ResumeParser()
    parsed = parser.parse(sample_resume)
    
    print(f"Parsed resume: {parsed.name}")
    print(f"Skills: {parsed.skills}")
    
    generator = QuestionGenerator()
    question_set = generator.generate(parsed, num_questions=10, raw_text=sample_resume)
    
    print(f"\nGenerated {len(question_set.questions)} questions:")
    for i, q in enumerate(question_set.questions, 1):
        print(f"{i}. [{q.difficulty.value}] [{q.question_type.value}] {q.question}")
