import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSpeechRecognition, useSpeechSynthesis, useSocket } from '../hooks';
import { useInterview } from '../context/InterviewContext';
import { ProctoringProvider } from '../context/ProctoringContext';
import ProctoringPanel from '../components/proctoring/ProctoringPanel';
import AlertOverlay from '../components/proctoring/AlertOverlay';
import { proctoringAPI } from '../services/api';

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
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initCountdown, setInitCountdown] = useState(3);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [hint, setHint] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Auto-scroll transcript
  const transcriptRef = useRef(null);
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, transcript, interimTranscript, answerResult]);

  // Timer logic
  useEffect(() => {
    let interval;
    if (interviewStarted) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [interviewStarted]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Socket event listeners
  useEffect(() => {
    if (!isConnected) return;

    const unsubJoined = on('session-joined', (data) => {
      setProgress(prev => ({
        ...prev,
        state: data.state,
        questionsAsked: data.questionsAsked || 0,
        totalAnswered: data.totalAnswered || 0,
        totalSkipped: data.totalSkipped || 0,
        averageScore: data.averageScore || 0,
        currentTopic: data.currentTopic
      }));
      
      if (data.isReconnect && data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion);
        setInterviewStarted(true);
      } else if (data.state !== 'INTRO' && data.questionsAsked > 0) {
        setInterviewStarted(true);
      }
    });

    const unsubMessage = on('interview-message', async (data) => {
      setMessages(prev => [...prev, { type: 'system', text: data.message }]);
      if (data.speakText && ttsSupported) {
        speak(data.speakText).then(() => {
          // Signal server that intro speech has finished
          if (data.type === 'intro') {
            emit('intro-complete');
          }
        }).catch(() => {
          // TTS failed — still signal server so the interview isn't stuck
          if (data.type === 'intro') {
            emit('intro-complete');
          }
        });
      } else if (data.type === 'intro') {
        // TTS not supported — signal immediately
        emit('intro-complete');
      }
    });

    const unsubQuestion = on('question', async (data) => {
      cancelSpeech();
      setCurrentQuestion(data);
      setAnswerResult(null);
      setHint(null);
      resetTranscript();
      setIsProcessing(false);
      setMessages(prev => [...prev, { type: 'ai', text: data.question }]);
      
      if (data.speakText && ttsSupported) speak(data.speakText);
    });

    const unsubResult = on('answer-result', async (data) => {
      if (data.isSkipped) {
        setProgress(prev => ({ ...prev, questionsAsked: (prev.questionsAsked || 0) + 1, totalSkipped: (prev.totalSkipped || 0) + 1 }));
        setIsProcessing(false);
        return;
      }
      
      setAnswerResult(data);
      setProgress(prev => ({ ...prev, questionsAsked: (prev.questionsAsked || 0) + 1, totalAnswered: (prev.totalAnswered || 0) + 1 }));
      
      if (currentQuestion) {
        addAnswer({ ...currentQuestion, result: data });
      }
      
      setIsProcessing(false);
      if (data.speakText && ttsSupported) speak(data.speakText);
    });

    const unsubProgress = on('progress', (data) => {
      setProgress(prev => ({ ...prev, ...data }));
    });

    const unsubHint = on('hint', async (data) => {
      setHint(data.hint);
      if (data.speakText && ttsSupported) speak(data.speakText);
    });

    const unsubComplete = on('interview-complete', async (data) => {
      // Clear the fallback navigation timer so TTS isn't interrupted
      if (endFallbackRef.current) {
        clearTimeout(endFallbackRef.current);
        endFallbackRef.current = null;
      }
      
      setMessages(prev => [...prev, { type: 'complete', text: data.message }]);
      // Show the "Finalizing Session" overlay immediately
      setInterviewComplete(true);
      try { await proctoringAPI.stop(); } catch (err) {}
      if (data.speakText && ttsSupported) {
        speak(data.speakText).then(() => {
          // Navigate after TTS finishes, with a minimum 2s for the overlay animation
          setTimeout(() => {
            cancelSpeech();
            navigate(`/interview/${sessionId}/complete`);
          }, 2000);
        }).catch(() => {
          setTimeout(() => navigate(`/interview/${sessionId}/complete`), 3000);
        });
      } else {
        // No TTS — give the overlay 5 seconds to show
        setTimeout(() => navigate(`/interview/${sessionId}/complete`), 5000);
      }
    });

    const unsubError = on('error', (data) => {
      setMessages(prev => [...prev, { type: 'error', text: data.message }]);
    });

    return () => {
      unsubJoined?.(); unsubMessage?.(); unsubQuestion?.(); unsubResult?.();
      unsubProgress?.(); unsubHint?.(); unsubComplete?.(); unsubError?.();
    };
  }, [isConnected, on, speak, ttsSupported, navigate, sessionId, currentQuestion, addAnswer, resetTranscript, setCurrentQuestion, setProgress]);

  // Track whether interview actually started for cleanup guard
  const interviewStartedRef = useRef(false);
  useEffect(() => {
    interviewStartedRef.current = interviewStarted;
  }, [interviewStarted]);

  // Fallback timer ref for early termination
  const endFallbackRef = useRef(null);

  // Separate cleanup — stop proctoring ONLY when leaving the page AND interview was started
  useEffect(() => {
    return () => {
      if (interviewStartedRef.current) {
        proctoringAPI.stop().catch(() => {});
      }
    };
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setIsInitializing(true);
      setInitCountdown(10);
      
      // Tell server/proctoring to start
      await proctoringAPI.setMeta(sessionId, { name: 'Candidate' });
      await proctoringAPI.start();

      // Countdown for camera initialization & backend setup
      const timer = setInterval(() => {
        setInitCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Wait 10 seconds before entering the room
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Start the interview on the server only AFTER entering the room
      emit('start-interview');
      
      setInterviewStarted(true);
      setIsInitializing(false);
    } catch (err) {
      console.error("Proctoring failed to start:", err);
      setIsInitializing(false);
      alert('Failed to connect to proctoring service. Please ensure the proctoring server is running.');
    }
  }, [emit, sessionId]);

  const handleNextQuestion = useCallback(() => {
    emit('next-question');
    setAnswerResult(null);
    setHint(null);
    resetTranscript();
  }, [emit, resetTranscript]);

  const handleToggleListen = useCallback(async () => {
    if (isListening) {
      stopListening();
      const currentTranscript = transcript.trim();
      
      if (currentTranscript) {
        setIsProcessing(true);
        setMessages(prev => [...prev, { type: 'user', text: currentTranscript }]);
        
        if (currentQuestion?.type === 'skill_prompt' || currentQuestion?.requiresSkillDetection) {
          try {
            const response = await fetch('http://localhost:8000/predict', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: currentTranscript, threshold: 0.3 })
            });
            const result = await response.json();
            const detectedSkills = result.predictions?.map(p => p.topic) || [];
            emit('submit-answer', { answer: currentTranscript, isTranscribed: true, detectedSkills });
          } catch (error) {
            emit('submit-answer', { answer: currentTranscript, isTranscribed: true, detectedSkills: ['Java'] });
          }
        } else {
          emit('submit-answer', { answer: currentTranscript, isTranscribed: true });
        }
      }
    } else {
      cancelSpeech();
      resetTranscript();
      startListening();
    }
  }, [isListening, stopListening, startListening, transcript, emit, resetTranscript, cancelSpeech, currentQuestion]);

  const handleSkip = useCallback(() => {
    cancelSpeech();
    stopListening();
    emit('submit-answer', { answer: 'skip', isTranscribed: false });
    setIsProcessing(true);
  }, [emit, cancelSpeech, stopListening]);

  const handleHint = useCallback(() => emit('request-hint'), [emit]);

  const handleEndInterview = useCallback(async () => {
    cancelSpeech();
    stopListening();
    
    // Immediate UI feedback
    setInterviewComplete(true);
    setShowExitConfirm(false);
    
    try {
      // Non-blocking proctoring stop
      proctoringAPI.stop().catch(console.error);
      
      // Emit event to server
      emit('end-interview');
      
      // Fallback navigation if socket/server is slow (5 seconds — allows overlay animation)
      endFallbackRef.current = setTimeout(() => {
        console.log('[Interview] Fallback navigation triggered');
        navigate(`/interview/${sessionId}/complete`);
      }, 5000);
    } catch (err) {
      console.error('Error during end interview:', err);
      navigate(`/interview/${sessionId}/complete`);
    }
  }, [emit, cancelSpeech, stopListening, navigate, sessionId]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="spinner border-t-secondary w-12 h-12 rounded-full animate-spin border-4 border-surface-container-highest"></div>
        <p className="mt-4 font-label text-xs uppercase tracking-widest text-secondary animate-pulse">Establishing Secure Uplink</p>
      </div>
    );
  }

  if (!interviewStarted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center selection:bg-primary/30 relative overflow-hidden font-body text-on-surface">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-container/15 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="glass-panel text-center max-w-xl w-full mx-4 p-12 rounded-3xl relative z-10 border border-white/10"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>
          
          <h1 className="text-4xl font-headline font-extrabold text-on-surface mb-4 tracking-tight">
            {isInitializing ? "Initializing Camera" : "Ready to Begin"}
          </h1>
          <p className="text-on-surface-variant text-lg mb-10 max-w-md mx-auto leading-relaxed">
            {isInitializing 
              ? `Please wait while we secure your environment and prepare the camera feed. Starting in ${initCountdown}s...`
              : "Welcome to your SkillWise Technical Interview. Please ensure you are in a quiet, well-lit environment and your camera is unobstructed."
            }
          </p>

          {!isInitializing && !sttSupported && (
            <div className="p-4 bg-error-container/20 border border-error/30 rounded-xl mb-8 flex items-start gap-3">
              <span className="material-symbols-outlined text-error" style={{fontVariationSettings: "'FILL' 1"}}>warning</span>
              <p className="text-error font-body text-sm text-left">
                Speech recognition is not fully supported in your browser context. Audio transcription might be degraded.
              </p>
            </div>
          )}

          {isInitializing ? (
            <div className="flex flex-col items-center gap-8 py-4">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="48" cy="48" r="44"
                    fill="none" stroke="currentColor" strokeWidth="6"
                    className="text-white/5"
                  />
                  <motion.circle
                    cx="48" cy="48" r="44"
                    fill="none" stroke="currentColor" strokeWidth="6"
                    strokeDasharray={276}
                    initial={{ strokeDashoffset: 276 }}
                    animate={{ strokeDashoffset: 276 - (276 * (10 - initCountdown) / 10) }}
                    className="text-primary"
                    transition={{ duration: 0.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-headline text-3xl font-black text-primary">
                  {initCountdown}
                </div>
              </div>
              <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-primary/10 border border-primary/20 text-xs font-label uppercase tracking-widest text-primary animate-pulse">
                <span className="material-symbols-outlined text-sm">videocam</span>
                Securing Live Feed
              </div>
            </div>
          ) : (
            <button
              onClick={handleStart}
              className="group relative flex items-center justify-center gap-4 px-12 py-5 w-full rounded-2xl bg-gradient-to-r from-primary-container to-primary text-on-primary-container font-label text-xs uppercase tracking-[0.2em] font-black hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-primary/20 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="material-symbols-outlined relative z-10">rocket_launch</span>
              <span className="relative z-10">Launch Interview</span>
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <ProctoringProvider>
      <AlertOverlay />
      <div className="bg-background text-on-surface font-body min-h-screen relative overflow-hidden flex flex-col pt-4">
        {/* Ambient Glows */}
        <div className="fixed -top-[10%] -right-[10%] w-[50%] h-[50%] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
        <div className="fixed -bottom-[10%] left-[10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

        {/* Top Navbar HUD */}
        <header className="fixed top-4 left-1/2 -translate-x-1/2 w-auto min-w-[600px] rounded-full border border-secondary/30 px-8 py-3 bg-slate-950/80 backdrop-blur-md flex justify-between items-center gap-12 z-50 shadow-[0_0_20px_rgba(0,218,243,0.2)]">
          <div className="flex items-center gap-6">
            <span className="font-label text-xs tracking-widest font-bold text-secondary">INTERVIEW_HUD_V1</span>
            <div className="h-4 w-[1px] bg-outline-variant/30"></div>
            <div className="flex items-center gap-6 font-label text-[10px] uppercase tracking-[0.15em] text-on-surface-variant">
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-secondary/60">Elapsed</span>
                <span className="text-on-surface font-mono">{formatTime(elapsedTime)}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-secondary/60">Progress</span>
                <span className="text-on-surface font-mono">Q {(progress.questionsAsked || 0)}/{(currentQuestion?.totalForTopic || 10)}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-primary/60">Stage</span>
                <span className="text-primary font-bold">{progress.state ? progress.state.replace('_', ' ') : 'ACTIVE'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowExitConfirm(true)} className="px-5 py-1.5 text-[10px] font-label font-bold uppercase tracking-widest text-white bg-error/20 border border-error/50 rounded-full hover:bg-error/40 transition-all shadow-[0_0_15px_rgba(255,113,108,0.2)]">
              Terminate
            </button>
          </div>
        </header>

        {/* Custom Confirmation Modal */}
        <AnimatePresence>
          {showExitConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 onClick={() => setShowExitConfirm(false)}
                 className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               />
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.9, y: 20 }}
                 className="relative w-full max-w-md glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl"
               >
                 <div className="w-16 h-16 rounded-full bg-error/10 border border-error/20 flex items-center justify-center mb-6 mx-auto">
                    <span className="material-symbols-outlined text-error text-3xl font-bold">warning</span>
                 </div>
                 <h2 className="text-2xl font-headline font-black text-center mb-2">End Interview?</h2>
                 <p className="text-on-surface-variant text-center mb-8 leading-relaxed">
                    You are about to terminate the session early. Your performance report will be generated based on the responses provided so far.
                 </p>
                 <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleEndInterview}
                      className="w-full py-4 rounded-xl bg-error text-white font-label text-xs uppercase tracking-widest font-black hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-error/20"
                    >
                      Yes, End Session
                    </button>
                    <button 
                      onClick={() => setShowExitConfirm(false)}
                      className="w-full py-4 rounded-xl bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-bold hover:bg-surface-container-highest transition-all"
                    >
                      Continue Interview
                    </button>
                 </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Finalizing Overlay */}
        <AnimatePresence>
          {interviewComplete && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="fixed inset-0 z-[110] bg-background flex flex-col items-center justify-center"
            >
               <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
               <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[150px] pointer-events-none"></div>
               
               <div className="relative text-center space-y-8">
                 <div className="w-24 h-24 mx-auto relative">
                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
                    <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-4xl text-primary animate-pulse">analytics</span>
                 </div>
                 
                 <div className="space-y-2">
                    <h2 className="text-3xl font-headline font-black tracking-tight text-white">Finalizing Session</h2>
                    <p className="text-secondary/60 font-label text-xs uppercase tracking-[0.3em] font-bold">Compiling Reports & Intelligence</p>
                 </div>
                 
                 <div className="max-w-xs mx-auto space-y-4">
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }} animate={{ width: "100%" }}
                         transition={{ duration: 2 }}
                         className="h-full bg-gradient-to-r from-primary to-secondary"
                       />
                    </div>
                    <p className="text-on-surface-variant text-[10px] leading-relaxed">
                       Securely uploading telemetry logs...
                    </p>
                 </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Side Nav Shell (Optional/Cosmetic) */}
        <nav className="fixed left-4 top-1/2 -translate-y-1/2 w-16 rounded-3xl border border-violet-500/15 bg-slate-950/40 backdrop-blur-2xl flex flex-col items-center py-8 z-40 shadow-2xl shadow-violet-900/20">
          <div className="flex flex-col items-center gap-4 w-full">
            <div onClick={() => setShowExitConfirm(true)} className="flex flex-col items-center justify-center text-slate-500 p-2 w-full hover:bg-violet-500/10 hover:text-violet-200 transition-all cursor-pointer">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="font-label uppercase tracking-[0.1em] text-[8px] mt-1">Exit</span>
            </div>
            <div className="flex flex-col items-center justify-center bg-secondary/20 text-secondary rounded-xl p-2 w-12 shadow-[0_0_10px_rgba(0,218,243,0.2)]">
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>video_chat</span>
              <span className="font-label uppercase tracking-[0.1em] text-[8px] mt-1">Live</span>
            </div>
          </div>
        </nav>

        {/* Main Content: Split Screen */}
        <main className="flex-1 mt-24 mb-6 md:pl-[100px] px-8 flex flex-col md:flex-row gap-8 w-full max-w-[1600px] mx-auto z-10 relative">
          
          {/* Left Panel: 70% Interview Native Interface */}
          <section className="w-full md:w-[70%] flex flex-col gap-6 h-[calc(100vh-140px)]">
            
            {/* Single Conversation Window */}
            <div className="flex-1 glass-panel rounded-3xl p-8 md:p-12 flex flex-col gap-8 relative overflow-y-auto transition-all duration-500 custom-scrollbar m-2">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-primary to-transparent opacity-30"></div>
               
               {/* Current Context Meta */}
               <div className="flex justify-between items-center mb-4">
                 <span className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant flex items-center gap-2">
                   <span className="material-symbols-outlined text-[16px]">forum</span>
                   Active Dialogue
                 </span>
                 {currentQuestion?.type && (
                   <span className="bg-surface-container-highest px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-widest border border-outline-variant/30 text-primary flex items-center gap-1.5">
                     <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse"></span>
                     {currentQuestion.type.replace('_', ' ')}
                   </span>
                 )}
               </div>

               {/* Virtual AI Interviewer Bubble */}
               <div className="flex gap-6 animate-in fade-in slide-in-from-top-4">
                  <div className="w-14 h-14 rounded-full flex shrink-0 items-center justify-center border-2 bg-primary/20 border-primary/40 shadow-[0_0_20px_rgba(166,140,255,0.2)]">
                     <span className="material-symbols-outlined text-primary text-[28px]">smart_toy</span>
                  </div>
                  <div className="flex-1 bg-surface-container-high/50 border border-white/5 rounded-3xl rounded-tl-sm p-8 shadow-xl">
                     <h1 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight leading-relaxed text-white">
                        {currentQuestion ? currentQuestion.question : 'Awaiting system prompt...'}
                     </h1>
                     {hint && (
                        <div className="mt-6 flex items-start gap-3 p-4 bg-tertiary/10 border border-tertiary/20 rounded-xl animate-in fade-in slide-in-from-top-4">
                           <span className="material-symbols-outlined text-tertiary text-[18px]">lightbulb</span>
                           <p className="text-tertiary font-body text-sm font-medium">{hint}</p>
                        </div>
                     )}
                     {!currentQuestion && !isProcessing && (
                        <div className="mt-4 flex gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary animate-bounce"></span>
                          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{animationDelay: '150ms'}}></span>
                          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{animationDelay: '300ms'}}></span>
                        </div>
                     )}
                  </div>
               </div>

               {/* Current Candidate Answer Bubble (Only shows if typing/speaking or processing or just submitted) */}
               <div className="flex gap-6 flex-row-reverse animate-in fade-in slide-in-from-bottom-4 mt-auto">
                  <div className={`w-14 h-14 rounded-full flex shrink-0 items-center justify-center border-2 transition-all ${isListening ? 'bg-secondary/20 border-secondary shadow-[0_0_20px_rgba(0,218,243,0.3)] scale-110' : 'bg-surface-container border-white/10'}`}>
                     <span className={`material-symbols-outlined text-[28px] ${isListening ? 'text-secondary animate-pulse' : 'text-on-surface-variant'}`}>person</span>
                  </div>
                  <div className={`flex-1 border rounded-3xl rounded-tr-sm p-6 md:p-8 shadow-xl transition-all ${isListening ? 'bg-secondary/5 border-secondary/30' : 'bg-surface-container border-white/5'}`}>
                     {isProcessing ? (
                        <div className="flex flex-col gap-4">
                           <p className="text-on-surface font-body italic text-lg leading-relaxed opacity-60">"{(messages && messages.length > 0 && messages[messages.length - 1]?.type === 'user') ? messages[messages.length - 1].text : transcript}"</p>
                           <p className="text-primary font-label text-xs uppercase tracking-widest flex items-center gap-2 mt-4 mt-auto">
                              <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                              Evaluating Response...
                           </p>
                        </div>
                     ) : answerResult ? (
                        <div className="flex flex-col gap-4">
                           <p className="text-on-surface font-body italic text-lg leading-relaxed opacity-40 line-through">"{(messages && messages.length > 0 && messages.some(m => m.type === 'user')) ? [...messages].reverse().find(m => m.type === 'user')?.text : ''}"</p>
                           <div className="flex bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl items-center gap-3">
                              <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                              <p className="text-sm text-emerald-400 font-medium">Capture confirmed. Awaiting advancement.</p>
                           </div>
                        </div>
                     ) : (
                        <div>
                           {isListening ? (
                              <p className="text-on-surface font-body text-xl md:text-2xl leading-relaxed font-light">
                                 {transcript}
                                 {interimTranscript && <span className="text-outline italic"> {interimTranscript}</span>}
                                 {!transcript && !interimTranscript && <span className="opacity-30 italic">Listening to your response...</span>}
                              </p>
                           ) : (
                              <p className="text-on-surface-variant opacity-60 font-body text-center italic mt-2">
                                 Activate microphone to begin responding.
                              </p>
                           )}
                        </div>
                     )}
                  </div>
               </div>
            </div>

            {/* Voice Controls */}
            <div className="flex items-center justify-center gap-8 md:gap-16 py-2 pb-6 md:pb-0 shrink-0">
              {answerResult ? (
                <button
                  onClick={handleNextQuestion}
                  className="px-8 py-3 bg-white text-black font-label text-sm uppercase tracking-widest font-extrabold rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                  Confirm & Advance
                </button>
              ) : (
                <>
                  <button onClick={handleSkip} disabled={isProcessing} className="group flex flex-col items-center gap-2 disabled:opacity-50">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-outline-variant flex items-center justify-center group-hover:bg-surface-container-high group-active:scale-90 transition-all">
                      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">fast_forward</span>
                    </div>
                    <span className="text-[9px] md:text-[10px] font-label uppercase tracking-widest text-on-surface-variant group-hover:text-white transition-colors">Skip</span>
                  </button>
                  
                  <div className="relative">
                    {isProcessing && <div className="absolute inset-0 bg-secondary/30 blur-2xl rounded-full scale-150 animate-pulse"></div>}
                    {!isProcessing && isListening && <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full scale-150 animate-pulse"></div>}
                    
                    <button 
                      onClick={handleToggleListen}
                      disabled={!currentQuestion || isProcessing}
                      className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:grayscale ${
                        isProcessing ? 'bg-secondary-container border border-secondary shadow-[0_0_30px_rgba(0,218,243,0.4)]' :
                        isListening ? 'bg-primary border border-white shadow-[0_0_40px_rgba(166,140,255,0.6)]' :
                        'bg-surface-container-high border-2 border-outline-variant hover:border-primary/50'
                      }`}
                    >
                      {isProcessing ? (
                        <div className="spinner border-t-secondary w-8 h-8 rounded-full animate-spin border-[3px] border-secondary/20"></div>
                      ) : (
                        <>
                          <span className={`material-symbols-outlined text-4xl md:text-5xl transition-colors ${isListening ? 'text-primary-container' : 'text-primary'} ${isSpeaking ? 'text-secondary animate-pulse' : ''}`} style={{fontVariationSettings: "'FILL' 1"}}>
                            {isSpeaking ? 'volume_up' : isListening ? 'mic' : 'mic_none'}
                          </span>
                          {isListening && <div className="absolute inset-[-4px] rounded-full border-2 border-primary animate-ping opacity-30"></div>}
                        </>
                      )}
                    </button>
                    {!isListening && !isProcessing && (
                      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] md:text-[10px] font-label uppercase tracking-widest text-primary whitespace-nowrap opacity-80">
                        {isSpeaking ? 'AI is speaking' : 'Tap to Answer'}
                      </span>
                    )}
                  </div>

                  <button onClick={handleHint} disabled={isProcessing} className="group flex flex-col items-center gap-2 disabled:opacity-50">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-outline-variant flex items-center justify-center group-hover:bg-tertiary/20 group-hover:border-tertiary/50 group-active:scale-90 transition-all">
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-tertiary text-[18px]">lightbulb</span>
                    </div>
                    <span className="text-[9px] md:text-[10px] font-label uppercase tracking-widest text-on-surface-variant group-hover:text-tertiary transition-colors">Hint</span>
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Right Panel: 30% Proctoring Telemetry */}
          <aside className="w-full md:w-[30%] h-[calc(100vh-140px)]">
            <ProctoringPanel />
          </aside>
          
        </main>
      </div>
    </ProctoringProvider>
  );
}

export default Interview;
