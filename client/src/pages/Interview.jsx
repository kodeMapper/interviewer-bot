import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MicrophoneButton, 
  QuestionCard, 
  AnswerResult, 
  TranscriptDisplay,
  ProgressBar 
} from '../components';
import { useSpeechRecognition, useSpeechSynthesis, useSocket } from '../hooks';
import { useInterview } from '../context/InterviewContext';

function Interview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  // Context
  const { 
    setCurrentQuestion,
    currentQuestion,
    progress,
    setProgress,
    addAnswer
  } = useInterview();
  
  // Socket connection
  const { isConnected, on, emit } = useSocket(sessionId);
  
  // Speech hooks
  const { 
    isListening, 
    transcript, 
    interimTranscript, 
    startListening, 
    stopListening,
    resetTranscript,
    isSupported: sttSupported
  } = useSpeechRecognition();
  
  const { 
    isSpeaking, 
    speak, 
    cancel: cancelSpeech,
    isSupported: ttsSupported 
  } = useSpeechSynthesis();
  
  // Local state
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [hint, setHint] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStartedRef] = useState({ current: false }); // Track if interview was already started

  // Setup socket event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Session joined - handle reconnection
    const unsubJoined = on('session-joined', (data) => {
      console.log('Joined session:', data);
      // Apply all progress data from server
      setProgress(prev => ({
        ...prev,
        state: data.state,
        questionsAsked: data.questionsAsked || 0,
        totalAnswered: data.totalAnswered || 0,
        totalSkipped: data.totalSkipped || 0,
        averageScore: data.averageScore || 0,
        currentTopic: data.currentTopic
      }));
      
      // Handle reconnection - restore current question without speaking again
      if (data.isReconnect && data.currentQuestion) {
        console.log('[Interview] Reconnected - restoring current question (no TTS)');
        setCurrentQuestion(data.currentQuestion);
        setInterviewStarted(true);
        // Don't speak - user already heard this question
      } else if (data.state !== 'INTRO' && data.questionsAsked > 0) {
        // Interview already in progress from a previous connection
        setInterviewStarted(true);
      }
    });

    // Interview message (intro, transitions)
    const unsubMessage = on('interview-message', async (data) => {
      setMessages(prev => [...prev, { type: 'system', text: data.message }]);
      if (data.speakText && ttsSupported) {
        await speak(data.speakText);
      }
    });

    // New question - prevent duplicate speech on quick succession
    const unsubQuestion = on('question', async (data) => {
      // Cancel any ongoing speech before speaking new question
      cancelSpeech();
      
      setCurrentQuestion(data);
      setAnswerResult(null);
      setHint(null);
      resetTranscript();
      setIsProcessing(false);
      
      if (data.speakText && ttsSupported) {
        await speak(data.speakText);
      }
    });

    // Answer result - now comes immediately (evaluation happens in background)
    const unsubResult = on('answer-result', async (data) => {
      console.log('[Interview] Answer result received:', data);
      
      // For skipped questions, don't show the answer result block
      // Next question will come automatically from server
      if (data.isSkipped) {
        // Update progress for skip
        setProgress(prev => ({
          ...prev,
          questionsAsked: (prev.questionsAsked || 0) + 1,
          totalSkipped: (prev.totalSkipped || 0) + 1
        }));
        setIsProcessing(false);
        // Don't set answerResult - let next question replace current
        return;
      }
      
      // For answered questions, show the result and wait for "Next Question" click
      setAnswerResult(data);
      
      // Update local progress immediately (optimistic update)
      setProgress(prev => ({
        ...prev,
        questionsAsked: (prev.questionsAsked || 0) + 1,
        totalAnswered: (prev.totalAnswered || 0) + 1
      }));
      
      // Add to answers list
      if (currentQuestion) {
        addAnswer({ ...currentQuestion, result: data });
      }
      
      setIsProcessing(false);
      
      if (data.speakText && ttsSupported) {
        await speak(data.speakText);
      }
    });

    // Progress update from server (comes after background evaluation)
    const unsubProgress = on('progress', (data) => {
      console.log('[Interview] Progress update:', data);
      setProgress(prev => ({ ...prev, ...data }));
    });

    // Hint
    const unsubHint = on('hint', async (data) => {
      setHint(data.hint);
      if (data.speakText && ttsSupported) {
        await speak(data.speakText);
      }
    });

    // Interview complete
    const unsubComplete = on('interview-complete', async (data) => {
      console.log('[Interview] Interview complete received:', data);
      setMessages(prev => [...prev, { type: 'complete', text: data.message }]);
      
      if (data.speakText && ttsSupported) {
        await speak(data.speakText);
      }
      
      // Navigate to report after a delay
      setTimeout(() => {
        console.log('[Interview] Navigating to report...');
        navigate(`/report/${sessionId}`);
      }, 3000);
    });

    // Error
    const unsubError = on('error', (data) => {
      console.error('Socket error:', data);
      setMessages(prev => [...prev, { type: 'error', text: data.message }]);
    });

    return () => {
      unsubJoined?.();
      unsubMessage?.();
      unsubQuestion?.();
      unsubResult?.();
      unsubProgress?.();
      unsubHint?.();
      unsubComplete?.();
      unsubError?.();
    };
  }, [isConnected, on, speak, ttsSupported, navigate, sessionId, currentQuestion, addAnswer, resetTranscript, setCurrentQuestion, setProgress]);

  // Start interview
  const handleStart = useCallback(() => {
    setInterviewStarted(true);
    emit('start-interview');
    // Server handles sending intro + first question automatically
    // No need to call next-question here - it causes duplicate questions
  }, [emit]);

  // Request next question
  const handleNextQuestion = useCallback(() => {
    emit('next-question');
    setAnswerResult(null);
    setHint(null);
    resetTranscript();
  }, [emit, resetTranscript]);

  // Toggle listening
  const handleToggleListen = useCallback(async () => {
    if (isListening) {
      stopListening();
      
      // Get the current transcript value
      const currentTranscript = transcript.trim();
      console.log('[Interview] Stopped listening. Transcript:', currentTranscript || '(empty)');
      
      // Submit the answer after stopping (even if empty, let server handle it)
      if (currentTranscript) {
        setIsProcessing(true);
        
        // Check if this is a skill_prompt question - needs skill detection
        if (currentQuestion?.type === 'skill_prompt' || currentQuestion?.requiresSkillDetection) {
          console.log('🎯 Skill prompt answer - detecting skills...');
          
          try {
            // Call ML service to detect skills from the transcript
            const response = await fetch('http://localhost:8000/predict', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: currentTranscript,
                threshold: 0.3
              })
            });
            
            const result = await response.json();
            const detectedSkills = result.predictions?.map(p => p.topic) || [];
            
            console.log('🎯 Detected skills:', detectedSkills);
            
            // Submit answer with detected skills
            emit('submit-answer', { 
              answer: currentTranscript, 
              isTranscribed: true,
              detectedSkills: detectedSkills
            });
          } catch (error) {
            console.error('Failed to detect skills:', error);
            // Fallback: submit without skill detection
            emit('submit-answer', { 
              answer: currentTranscript, 
              isTranscribed: true,
              detectedSkills: ['Java'] // Default fallback
            });
          }
        } else {
          // Normal question - just submit answer
          console.log('[Interview] Submitting answer:', currentTranscript.substring(0, 50));
          emit('submit-answer', { answer: currentTranscript, isTranscribed: true });
        }
      } else {
        console.log('[Interview] Empty transcript - not submitting');
        // Show a message to the user that we didn't catch their answer
        setMessages(prev => [...prev, { 
          type: 'warning', 
          text: "I didn't catch that. Please try again or click Skip."
        }]);
      }
    } else {
      cancelSpeech();
      resetTranscript();
      startListening();
      console.log('[Interview] Started listening...');
    }
  }, [isListening, stopListening, startListening, transcript, emit, resetTranscript, cancelSpeech, currentQuestion]);

  // Skip question
  const handleSkip = useCallback(() => {
    cancelSpeech();
    stopListening();
    emit('submit-answer', { answer: 'skip', isTranscribed: false });
    setIsProcessing(true);
  }, [emit, cancelSpeech, stopListening]);

  // Request hint
  const handleHint = useCallback(() => {
    emit('request-hint');
  }, [emit]);

  // End interview early
  const handleEndInterview = useCallback(() => {
    if (window.confirm('Are you sure you want to end the interview? You will receive your report based on questions answered so far.')) {
      console.log('[Interview] Ending interview early...');
      cancelSpeech();
      stopListening();
      emit('end-interview');
      console.log('[Interview] end-interview event emitted');
    }
  }, [emit, cancelSpeech, stopListening]);

  // Not connected yet
  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-secondary-400">Connecting to interview session...</p>
        </div>
      </div>
    );
  }

  // Pre-interview screen
  if (!interviewStarted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card text-center"
        >
          <h1 className="text-2xl font-bold text-white mb-4">Ready to Begin?</h1>
          <p className="text-secondary-300 mb-6">
            The interview will start with a brief introduction, followed by questions 
            based on your selected skills and resume.
          </p>
          
          {!sttSupported && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-6">
              <p className="text-yellow-400 text-sm">
                ⚠️ Speech recognition is not supported in your browser. 
                You can still type your answers.
              </p>
            </div>
          )}
          
          <button
            onClick={handleStart}
            className="btn-primary py-4 px-8 text-lg"
          >
            Start Interview
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header with End Interview button */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex-1">
          <ProgressBar progress={progress} state={progress.state} />
        </div>
        <button
          onClick={handleEndInterview}
          className="ml-4 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
        >
          End Interview
        </button>
      </div>
      
      <div className="mt-8 space-y-6">
        {/* Question */}
        <AnimatePresence mode="wait">
          {currentQuestion && (
            <QuestionCard
              key={currentQuestion.questionId}
              question={currentQuestion.question}
              topic={currentQuestion.topic}
              type={currentQuestion.type}
              questionNumber={currentQuestion.questionNumber}
              total={currentQuestion.totalForTopic || currentQuestion.totalMixRound}
            />
          )}
        </AnimatePresence>

        {/* Hint */}
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
          >
            <p className="text-yellow-400 text-sm">💡 {hint}</p>
          </motion.div>
        )}

        {/* Transcript */}
        <TranscriptDisplay
          transcript={transcript}
          interimTranscript={interimTranscript}
          isListening={isListening}
        />

        {/* Answer Result */}
        <AnimatePresence>
          {answerResult && <AnswerResult result={answerResult} />}
        </AnimatePresence>

        {/* Microphone / Next Button */}
        <div className="flex justify-center py-8">
          {answerResult ? (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleNextQuestion}
              className="btn-primary py-4 px-8 text-lg"
            >
              Next Question
            </motion.button>
          ) : (
            <MicrophoneButton
              isListening={isListening}
              isSpeaking={isSpeaking}
              onToggleListen={handleToggleListen}
              onSkip={handleSkip}
              onHint={handleHint}
              disabled={!currentQuestion || isProcessing}
            />
          )}
        </div>

        {/* Processing indicator - only shows briefly while sending */}
        {isProcessing && (
          <div className="text-center">
            <div className="spinner mx-auto mb-2" />
            <p className="text-secondary-400">Recording your answer...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Interview;
