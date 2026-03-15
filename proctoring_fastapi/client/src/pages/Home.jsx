import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, FileText, Sparkles, Mic, Brain, BarChart } from 'lucide-react';
import { SkillSelector, ResumeUpload } from '../components';
import { interviewAPI, resumeAPI } from '../services/api';

function Home() {
  const navigate = useNavigate();
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [step, setStep] = useState(1); // 1: Select skills, 2: Upload resume (optional)

  const handleStartSession = async () => {
    if (selectedSkills.length === 0) {
      alert('Please select at least one skill');
      return;
    }

    setIsCreatingSession(true);
    try {
      const result = await interviewAPI.startSession(selectedSkills);
      setSessionId(result.data.sessionId);
      setStep(2);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleResumeUpload = async (file) => {
    if (!sessionId) return;

    setIsUploadingResume(true);
    setUploadError(null);
    try {
      const result = await resumeAPI.upload(file, sessionId);
      setUploadResult(result.data);
      // Update skills if resume detected new ones
      if (result.data.skillsDetected) {
        setSelectedSkills([...new Set([...selectedSkills, ...result.data.skillsDetected])]);
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      setUploadError('Failed to process resume. Please try again.');
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleStartInterview = () => {
    if (sessionId) {
      navigate(`/interview/${sessionId}`);
    }
  };

  const features = [
    {
      icon: Mic,
      title: 'Voice Interaction',
      description: 'Answer questions naturally using your voice with real-time speech recognition'
    },
    {
      icon: Brain,
      title: 'AI-Powered Evaluation',
      description: 'Semantic analysis and ML-based scoring for accurate feedback'
    },
    {
      icon: FileText,
      title: 'Resume-Based Questions',
      description: 'Upload your resume to get personalized interview questions'
    },
    {
      icon: BarChart,
      title: 'Detailed Reports',
      description: 'Track your progress with comprehensive performance analytics'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-primary-500/20 rounded-2xl">
            <Sparkles className="w-12 h-12 text-primary-400" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          AI Smart Interviewer
        </h1>
        <p className="text-xl text-secondary-300 max-w-2xl mx-auto">
          Practice technical interviews with AI-powered voice interaction, 
          instant feedback, and personalized questions based on your resume.
        </p>
      </motion.div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-8 mb-12">
        {/* Left: Setup Steps */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {step === 1 && (
            <>
              <SkillSelector 
                selectedSkills={selectedSkills}
                onSkillsChange={setSelectedSkills}
              />
              
              <button
                onClick={handleStartSession}
                disabled={selectedSkills.length === 0 || isCreatingSession}
                className="w-full btn-primary flex items-center justify-center gap-2 py-4 text-lg disabled:opacity-50"
              >
                {isCreatingSession ? (
                  <>
                    <div className="spinner w-5 h-5" />
                    Creating Session...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Continue
                  </>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <ResumeUpload
                onUpload={handleResumeUpload}
                isUploading={isUploadingResume}
                uploadResult={uploadResult}
                error={uploadError}
              />
              
              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 btn-secondary py-4"
                >
                  Back
                </button>
                <button
                  onClick={handleStartInterview}
                  className="flex-1 btn-primary flex items-center justify-center gap-2 py-4"
                >
                  <Play className="w-5 h-5" />
                  {uploadResult ? 'Start Interview' : 'Skip & Start'}
                </button>
              </div>
            </>
          )}
        </motion.div>

        {/* Right: Features */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-2 gap-4"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="card hover:border-secondary-600 transition-colors"
            >
              <div className="p-3 bg-primary-500/20 rounded-xl w-fit mb-3">
                <feature.icon className="w-6 h-6 text-primary-400" />
              </div>
              <h3 className="font-medium text-white mb-1">{feature.title}</h3>
              <p className="text-sm text-secondary-400">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Selected Skills Preview */}
      {selectedSkills.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <p className="text-secondary-400 mb-3">Selected topics:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {selectedSkills.map((skill) => (
              <span key={skill} className="skill-badge">
                {skill.replace('_', ' ')}
              </span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default Home;
