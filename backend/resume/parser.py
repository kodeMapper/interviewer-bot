"""
Resume Parser
Parses extracted resume text into structured sections.

Sections detected:
- Education
- Experience (Work History)
- Internships
- Projects
- Skills (Technical Skills)
- Certifications
- Achievements/Awards
- Leadership/Extracurricular Activities
- Hobbies/Interests
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime


@dataclass
class ResumeSection:
    """Represents a section of the resume."""
    name: str
    content: str
    raw_content: str
    keywords: List[str] = field(default_factory=list)
    entries: List[Dict] = field(default_factory=list)  # Parsed entries within section
    question_potential: int = 0  # 0-10 score for how many questions can be generated


@dataclass
class ParsedResume:
    """Structured representation of a resume."""
    raw_text: str
    
    # Contact Info
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    location: Optional[str] = None
    
    # Main Sections
    education: List[ResumeSection] = field(default_factory=list)
    experience: List[ResumeSection] = field(default_factory=list)
    internships: List[ResumeSection] = field(default_factory=list)
    projects: List[ResumeSection] = field(default_factory=list)
    skills: List[str] = field(default_factory=list)
    certifications: List[str] = field(default_factory=list)
    achievements: List[str] = field(default_factory=list)
    leadership: List[ResumeSection] = field(default_factory=list)
    hobbies: List[str] = field(default_factory=list)
    
    # Additional Sections (catch-all)
    other_sections: Dict[str, ResumeSection] = field(default_factory=dict)
    
    # Computed Properties
    total_experience_years: float = 0.0
    seniority_level: str = "entry"  # entry, mid, senior
    question_capacity: int = 0  # How many meaningful questions can be generated
    extraction_confidence: float = 0.0
    
    def is_thin_resume(self) -> bool:
        """Check if resume has enough content for meaningful questions."""
        return self.question_capacity < 8
    
    def get_summary(self) -> Dict:
        """Get a summary of parsed content."""
        return {
            "name": self.name,
            "email": self.email,
            "skills_count": len(self.skills),
            "experience_entries": len(self.experience),
            "internship_entries": len(self.internships),
            "project_entries": len(self.projects),
            "education_entries": len(self.education),
            "certifications_count": len(self.certifications),
            "leadership_entries": len(self.leadership),
            "question_capacity": self.question_capacity,
            "seniority": self.seniority_level,
            "is_thin": self.is_thin_resume()
        }


class ResumeParser:
    """
    Parses extracted text into structured resume sections.
    Uses regex patterns and heuristics for section detection.
    """
    
    # Section header patterns (case-insensitive)
    SECTION_PATTERNS = {
        'education': r'(?i)^\s*(education|academic\s*background|academic\s*qualifications?|degrees?|schooling)\s*:?\s*$',
        'experience': r'(?i)^\s*(work\s*experience|professional\s*experience|employment(\s*history)?|work\s*history|career|experience)\s*:?\s*$',
        'internships': r'(?i)^\s*(internships?|training|industrial\s*training|summer\s*training)\s*:?\s*$',
        'projects': r'(?i)^\s*(projects?|personal\s*projects?|academic\s*projects?|portfolio|key\s*projects?)\s*:?\s*$',
        'skills': r'(?i)^\s*(skills?|technical\s*skills?|technologies?|tools?|proficienc(y|ies)|expertise|competenc(y|ies)|tech\s*stack)\s*:?\s*$',
        'certifications': r'(?i)^\s*(certifications?|certificates?|credentials?|licenses?|professional\s*development)\s*:?\s*$',
        'achievements': r'(?i)^\s*(achievements?|awards?|honors?|recognitions?|accomplishments?)\s*:?\s*$',
        'leadership': r'(?i)^\s*(leadership|extracurricular|activities|volunteer(ing)?|positions?\s*of\s*responsibility|roles?)\s*:?\s*$',
        'hobbies': r'(?i)^\s*(hobbies|interests?|personal\s*interests?|passions?)\s*:?\s*$',
        'summary': r'(?i)^\s*(summary|objective|profile|about\s*me|professional\s*summary|career\s*objective)\s*:?\s*$',
    }
    
    # Patterns for extracting specific information
    EMAIL_PATTERN = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    PHONE_PATTERN = r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    LINKEDIN_PATTERN = r'(?:linkedin\.com/in/|linkedin:?\s*)([a-zA-Z0-9_-]+)'
    GITHUB_PATTERN = r'(?:github\.com/|github:?\s*)([a-zA-Z0-9_-]+)'
    
    # Common skill keywords for extraction
    COMMON_SKILLS = [
        # Programming Languages
        'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'ruby', 'go', 'rust',
        'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl', 'sql', 'bash', 'shell',
        
        # Web Technologies
        'html', 'css', 'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask',
        'spring', 'spring boot', 'asp.net', 'jquery', 'bootstrap', 'tailwind', 'next.js',
        
        # Databases
        'mysql', 'postgresql', 'mongodb', 'redis', 'oracle', 'sql server', 'sqlite',
        'dynamodb', 'cassandra', 'elasticsearch', 'firebase',
        
        # Cloud & DevOps
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible',
        'ci/cd', 'git', 'github', 'gitlab', 'bitbucket', 'linux', 'nginx', 'apache',
        
        # Data Science & ML
        'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras', 'scikit-learn',
        'pandas', 'numpy', 'matplotlib', 'nlp', 'computer vision', 'data analysis',
        
        # Other
        'rest api', 'graphql', 'microservices', 'agile', 'scrum', 'jira', 'confluence',
    ]
    
    def __init__(self):
        self._compiled_patterns = {
            name: re.compile(pattern, re.MULTILINE)
            for name, pattern in self.SECTION_PATTERNS.items()
        }
    
    def parse(self, raw_text: str, extraction_confidence: float = 1.0) -> ParsedResume:
        """
        Main parsing method.
        
        Args:
            raw_text: Raw extracted text from resume
            extraction_confidence: Confidence from extraction phase
            
        Returns:
            Structured ParsedResume object
        """
        resume = ParsedResume(raw_text=raw_text)
        resume.extraction_confidence = extraction_confidence
        
        # Step 1: Extract contact information
        self._extract_contact_info(resume, raw_text)
        
        # Step 2: Split into sections
        sections = self._split_into_sections(raw_text)
        
        # Step 3: Parse each section
        for section_name, content in sections.items():
            self._parse_section(resume, section_name, content)
        
        # Step 4: Extract skills from text (even if not in dedicated section)
        self._extract_skills_from_text(resume, raw_text)
        
        # Step 5: Calculate metadata
        resume.total_experience_years = self._calculate_experience_years(resume)
        resume.seniority_level = self._determine_seniority(resume)
        resume.question_capacity = self._calculate_question_capacity(resume)
        
        return resume
    
    def _extract_contact_info(self, resume: ParsedResume, text: str):
        """Extract contact information from resume."""
        # Email
        email_match = re.search(self.EMAIL_PATTERN, text)
        if email_match:
            resume.email = email_match.group()
        
        # Phone
        phone_match = re.search(self.PHONE_PATTERN, text)
        if phone_match:
            resume.phone = phone_match.group()
        
        # LinkedIn
        linkedin_match = re.search(self.LINKEDIN_PATTERN, text, re.IGNORECASE)
        if linkedin_match:
            resume.linkedin = linkedin_match.group(1)
        
        # GitHub
        github_match = re.search(self.GITHUB_PATTERN, text, re.IGNORECASE)
        if github_match:
            resume.github = github_match.group(1)
        
        # Name (usually first non-empty line, often in larger font/caps)
        lines = text.strip().split('\n')
        for line in lines[:5]:  # Check first 5 lines
            line = line.strip()
            if line and len(line) < 50 and not re.search(self.EMAIL_PATTERN, line):
                # Likely a name - no email, reasonable length
                if not any(char.isdigit() for char in line):  # Names usually don't have numbers
                    resume.name = line
                    break
    
    def _split_into_sections(self, text: str) -> Dict[str, str]:
        """Split resume text into sections based on headers."""
        sections = {}
        lines = text.split('\n')
        
        current_section = 'header'
        current_content = []
        
        for line in lines:
            section_found = None
            
            # Check if line matches any section pattern
            for section_name, pattern in self._compiled_patterns.items():
                if pattern.match(line.strip()):
                    section_found = section_name
                    break
            
            if section_found:
                # Save previous section
                if current_content:
                    sections[current_section] = '\n'.join(current_content)
                
                # Start new section
                current_section = section_found
                current_content = []
            else:
                current_content.append(line)
        
        # Save last section
        if current_content:
            sections[current_section] = '\n'.join(current_content)
        
        return sections
    
    def _parse_section(self, resume: ParsedResume, section_name: str, content: str):
        """Parse content of a specific section."""
        content = content.strip()
        if not content:
            return
        
        if section_name == 'education':
            section = self._parse_education(content)
            if section:
                resume.education.append(section)
                
        elif section_name == 'experience':
            sections = self._parse_experience_entries(content)
            resume.experience.extend(sections)
            
        elif section_name == 'internships':
            sections = self._parse_experience_entries(content, is_internship=True)
            resume.internships.extend(sections)
            
        elif section_name == 'projects':
            sections = self._parse_projects(content)
            resume.projects.extend(sections)
            
        elif section_name == 'skills':
            skills = self._parse_skills(content)
            resume.skills.extend(skills)
            
        elif section_name == 'certifications':
            certs = self._parse_list_items(content)
            resume.certifications.extend(certs)
            
        elif section_name == 'achievements':
            achievements = self._parse_list_items(content)
            resume.achievements.extend(achievements)
            
        elif section_name == 'leadership':
            sections = self._parse_leadership(content)
            resume.leadership.extend(sections)
            
        elif section_name == 'hobbies':
            hobbies = self._parse_list_items(content)
            resume.hobbies.extend(hobbies)
            
        elif section_name not in ['header', 'summary']:
            # Store unknown sections
            resume.other_sections[section_name] = ResumeSection(
                name=section_name,
                content=content,
                raw_content=content
            )
    
    def _parse_education(self, content: str) -> Optional[ResumeSection]:
        """Parse education section."""
        entries = []
        
        # Try to extract degree, institution, year
        lines = content.strip().split('\n')
        current_entry = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                if current_entry:
                    entries.append(current_entry)
                    current_entry = {}
                continue
            
            # Look for year patterns
            year_match = re.search(r'(19|20)\d{2}', line)
            
            # Look for degree keywords
            degree_keywords = ['bachelor', 'master', 'phd', 'b.tech', 'm.tech', 'b.e.', 'm.e.',
                              'b.sc', 'm.sc', 'bba', 'mba', 'diploma', 'b.com', 'm.com']
            
            has_degree = any(kw in line.lower() for kw in degree_keywords)
            
            if has_degree:
                current_entry['degree'] = line
            elif year_match:
                current_entry['year'] = year_match.group()
                if 'details' not in current_entry:
                    current_entry['details'] = line
            else:
                if 'institution' not in current_entry:
                    current_entry['institution'] = line
                else:
                    current_entry['details'] = current_entry.get('details', '') + ' ' + line
        
        if current_entry:
            entries.append(current_entry)
        
        keywords = self._extract_keywords_from_text(content)
        
        return ResumeSection(
            name='education',
            content=content,
            raw_content=content,
            keywords=keywords,
            entries=entries,
            question_potential=min(5, len(entries) * 2)
        )
    
    def _parse_experience_entries(self, content: str, is_internship: bool = False) -> List[ResumeSection]:
        """Parse work experience or internship entries."""
        sections = []
        
        # Split by common patterns (company names, dates, etc.)
        # Look for patterns like "Company Name | Role | Date"
        entries = self._split_experience_entries(content)
        
        for entry in entries:
            if not entry.strip():
                continue
            
            keywords = self._extract_keywords_from_text(entry)
            
            sections.append(ResumeSection(
                name='internship' if is_internship else 'experience',
                content=entry.strip(),
                raw_content=entry,
                keywords=keywords,
                question_potential=3  # Each experience entry can generate ~3 questions
            ))
        
        return sections
    
    def _split_experience_entries(self, content: str) -> List[str]:
        """Split experience section into individual entries."""
        lines = content.strip().split('\n')
        entries = []
        current_entry = []
        
        for line in lines:
            # Check if this looks like a new entry (has date pattern at end or beginning)
            is_new_entry = bool(re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}', line, re.IGNORECASE))
            is_new_entry = is_new_entry or bool(re.search(r'\d{4}\s*[-–]\s*(Present|\d{4})', line))
            
            # Also check for bullet points indicating continuation
            is_bullet = line.strip().startswith(('•', '-', '*', '–', '○'))
            
            if is_new_entry and current_entry and not is_bullet:
                entries.append('\n'.join(current_entry))
                current_entry = [line]
            else:
                current_entry.append(line)
        
        if current_entry:
            entries.append('\n'.join(current_entry))
        
        return entries if entries else [content]
    
    def _parse_projects(self, content: str) -> List[ResumeSection]:
        """Parse projects section."""
        sections = []
        
        # Split by project entries
        entries = self._split_project_entries(content)
        
        for entry in entries:
            if not entry.strip():
                continue
            
            keywords = self._extract_keywords_from_text(entry)
            
            sections.append(ResumeSection(
                name='project',
                content=entry.strip(),
                raw_content=entry,
                keywords=keywords,
                question_potential=2  # Each project can generate ~2 questions
            ))
        
        return sections
    
    def _split_project_entries(self, content: str) -> List[str]:
        """Split projects into individual entries."""
        lines = content.strip().split('\n')
        entries = []
        current_entry = []
        
        for line in lines:
            stripped = line.strip()
            
            # New project indicators
            is_new_project = (
                stripped and 
                not stripped.startswith(('•', '-', '*', '–', '○')) and
                len(stripped) < 100 and
                current_entry and
                current_entry[-1].strip().startswith(('•', '-', '*', '–', '○'))
            )
            
            if is_new_project:
                entries.append('\n'.join(current_entry))
                current_entry = [line]
            else:
                current_entry.append(line)
        
        if current_entry:
            entries.append('\n'.join(current_entry))
        
        return entries if entries else [content]
    
    def _parse_skills(self, content: str) -> List[str]:
        """Parse skills section and extract individual skills."""
        skills = []
        
        # Common delimiters
        delimiters = [',', '|', '•', '·', '\n', ';']
        
        # Replace delimiters with a common one
        text = content
        for d in delimiters:
            text = text.replace(d, '|||')
        
        # Split and clean
        raw_skills = text.split('|||')
        
        for skill in raw_skills:
            skill = skill.strip()
            # Clean up common prefixes
            skill = re.sub(r'^[-•*]\s*', '', skill)
            
            if skill and len(skill) < 50:  # Skills are usually short
                skills.append(skill)
        
        return list(set(skills))  # Remove duplicates
    
    def _parse_leadership(self, content: str) -> List[ResumeSection]:
        """Parse leadership/activities section."""
        sections = []
        
        entries = content.split('\n\n')
        if len(entries) == 1:
            entries = content.split('\n')
        
        for entry in entries:
            entry = entry.strip()
            if not entry or len(entry) < 10:
                continue
            
            keywords = self._extract_keywords_from_text(entry)
            
            sections.append(ResumeSection(
                name='leadership',
                content=entry,
                raw_content=entry,
                keywords=keywords,
                question_potential=1
            ))
        
        return sections
    
    def _parse_list_items(self, content: str) -> List[str]:
        """Parse a section that contains a list of items."""
        items = []
        
        lines = content.strip().split('\n')
        for line in lines:
            line = line.strip()
            # Remove common bullet points
            line = re.sub(r'^[-•*○]\s*', '', line)
            if line and len(line) > 3:
                items.append(line)
        
        return items
    
    def _extract_skills_from_text(self, resume: ParsedResume, text: str):
        """Extract skills mentioned anywhere in the resume."""
        text_lower = text.lower()
        
        for skill in self.COMMON_SKILLS:
            if skill.lower() in text_lower and skill not in resume.skills:
                resume.skills.append(skill)
    
    def _extract_keywords_from_text(self, text: str) -> List[str]:
        """Extract relevant keywords from text for adaptive questioning."""
        keywords = []
        text_lower = text.lower()
        
        # Check for common technical terms
        for skill in self.COMMON_SKILLS:
            if skill.lower() in text_lower:
                keywords.append(skill)
        
        # Add action verbs that indicate achievements
        action_verbs = ['developed', 'designed', 'implemented', 'led', 'managed', 
                       'created', 'built', 'optimized', 'improved', 'achieved']
        for verb in action_verbs:
            if verb in text_lower:
                keywords.append(verb)
        
        return list(set(keywords))[:10]  # Limit to 10 keywords
    
    def _calculate_experience_years(self, resume: ParsedResume) -> float:
        """Calculate total years of experience."""
        # Count experience entries
        # This is a rough estimate based on entries
        experience_count = len(resume.experience)
        internship_count = len(resume.internships)
        
        # Rough estimate: 2 years per job, 0.5 years per internship
        return (experience_count * 2.0) + (internship_count * 0.5)
    
    def _determine_seniority(self, resume: ParsedResume) -> str:
        """Determine seniority level based on experience."""
        years = resume.total_experience_years
        
        if years < 2:
            return "entry"
        elif years < 5:
            return "mid"
        else:
            return "senior"
    
    def _calculate_question_capacity(self, resume: ParsedResume) -> int:
        """
        Estimate how many meaningful questions can be generated.
        Used to determine if fallback to local questions is needed.
        """
        capacity = 0
        
        # Each experience entry = 3-4 potential questions
        capacity += len(resume.experience) * 3
        
        # Each internship = 2-3 potential questions
        capacity += len(resume.internships) * 2
        
        # Each project = 2-3 potential questions
        capacity += len(resume.projects) * 2
        
        # Skills = 1 question per 3 skills
        capacity += len(resume.skills) // 3
        
        # Certifications = 1 question each
        capacity += len(resume.certifications)
        
        # Leadership = 1-2 questions each
        capacity += len(resume.leadership)
        
        # Education = 1-2 questions
        capacity += min(2, len(resume.education))
        
        return capacity


# Standalone testing
if __name__ == "__main__":
    sample_resume = """
    John Doe
    john.doe@email.com | (123) 456-7890
    LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe
    
    EDUCATION
    Bachelor of Technology in Computer Science
    XYZ University, 2020
    CGPA: 8.5/10
    
    EXPERIENCE
    Software Engineer | ABC Tech | Jan 2021 - Present
    • Developed RESTful APIs using Python and Flask
    • Implemented microservices architecture
    • Improved system performance by 40%
    
    Junior Developer | StartupXYZ | Jun 2020 - Dec 2020
    • Built frontend components using React
    • Collaborated with design team
    
    INTERNSHIPS
    Summer Intern | BigCorp | May 2019 - Jul 2019
    • Worked on data analysis using Python
    • Created dashboards with Tableau
    
    PROJECTS
    E-commerce Platform
    • Built full-stack application using MERN stack
    • Implemented payment integration
    
    ML-based Recommendation System
    • Developed using Python, TensorFlow
    • Achieved 85% accuracy
    
    SKILLS
    Python, Java, JavaScript, React, Node.js, SQL, MongoDB, AWS, Docker, Git
    
    CERTIFICATIONS
    AWS Certified Developer
    Google Cloud Professional
    
    ACHIEVEMENTS
    Winner, National Hackathon 2020
    Dean's List 2019-2020
    
    LEADERSHIP
    Technical Lead, Coding Club
    • Organized workshops and hackathons
    • Mentored 50+ students
    """
    
    parser = ResumeParser()
    result = parser.parse(sample_resume)
    
    print("=== Parsed Resume ===")
    print(f"Name: {result.name}")
    print(f"Email: {result.email}")
    print(f"Phone: {result.phone}")
    print(f"\nExperience entries: {len(result.experience)}")
    print(f"Internship entries: {len(result.internships)}")
    print(f"Project entries: {len(result.projects)}")
    print(f"Skills: {result.skills[:10]}...")
    print(f"\nQuestion capacity: {result.question_capacity}")
    print(f"Seniority: {result.seniority_level}")
    print(f"Is thin resume: {result.is_thin_resume()}")
