"""
Resume Processing Module for AI Smart Interviewer
Phase 2.75 - Resume Upload & Dynamic Question Generation

This module handles:
- Resume text extraction (PDF, DOCX)
- Resume section parsing (experiences, internships, skills, projects, leadership)
- GPT-based question generation
- Thread-safe resume question bank
"""

from .extractor import ResumeExtractor
from .parser import ResumeParser, ParsedResume
from .gpt_client import GPTClient, GPTConfig, GPTClientError
from .question_generator import (
    QuestionGenerator, 
    GeneratedQuestion, 
    ResumeQuestionSet,
    QuestionType,
    QuestionDifficulty
)
from .resume_question_bank import ResumeQuestionBank, HybridQuestionManager

__all__ = [
    # Extraction
    'ResumeExtractor',
    
    # Parsing
    'ResumeParser',
    'ParsedResume',
    
    # GPT Client
    'GPTClient',
    'GPTConfig',
    'GPTClientError',
    
    # Question Generation
    'QuestionGenerator',
    'GeneratedQuestion',
    'ResumeQuestionSet',
    'QuestionType',
    'QuestionDifficulty',
    
    # Question Bank
    'ResumeQuestionBank',
    'HybridQuestionManager'
]
