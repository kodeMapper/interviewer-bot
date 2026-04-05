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
      if (data.speakText && ttsSupported) speak(data.speakText);
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
      setMessages(prev => [...prev, { type: 'complete', text: data.message }]);
      try { await proctoringAPI.stop(); } catch (err) {}
      if (data.speakText && ttsSupported) speak(data.speakText);
      setTimeout(() => navigate(`/interview/${sessionId}/complete`), 3000);
    });

    const unsubError = on('error', (data) => {
      setMessages(prev => [...prev, { type: 'error', text: data.message }]);
    });

    return () => {
      unsubJoined?.(); unsubMessage?.(); unsubQuestion?.(); unsubResult?.();
      unsubProgress?.(); unsubHint?.(); unsubComplete?.(); unsubError?.();
      proctoringAPI.stop().catch(() => {});
    };
  }, [isConnected, on, speak, ttsSupported, navigate, sessionId, currentQuestion, addAnswer, resetTranscript, setCurrentQuestion, setProgress]);

  const handleStart = useCallback(() => {
    setInterviewStarted(true);
    emit('start-interview');
  }, [emit]);

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
    if (window.confirm('End interview early? You will receive a report based on questions answered.')) {
      cancelSpeech();
      stopListening();
      try { await proctoringAPI.stop(); } catch (err) {}
      emit('end-interview');
    }
  }, [emit, cancelSpeech, stopListening]);

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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center selection:bg-primary/30 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-container/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel text-center max-w-xl p-10 rounded-3xl relative z-10 border border-white/10">
          <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-4">Initialize Session</h1>
          <p className="text-on-surface-variant font-body mb-8 leading-relaxed">
            The AI Proctoring engine is ready. The interview will adapt dynamically based on your performance. 
          </p>
          
          {!sttSupported && (
            <div className="p-4 bg-error-container/20 border border-error/30 rounded-xl mb-8 flex items-start gap-3">
              <span className="material-symbols-outlined text-error" style={{fontVariationSettings: "'FILL' 1"}}>warning</span>
              <p className="text-error font-body text-sm text-left">
                Speech recognition is not fully supported in your browser context. Audio transcription might be degraded.
              </p>
            </div>
          )}
          
          <button onClick={handleStart} className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-primary-container to-primary text-on-primary-container hover:scale-[1.02] active:scale-95 transition-all font-label text-xs uppercase tracking-widest shadow-xl shadow-primary/20">
            <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
            Launch Interview
          </button>
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
            <button onClick={handleEndInterview} className="px-5 py-1.5 text-[10px] font-label font-bold uppercase tracking-widest text-white bg-error/20 border border-error/50 rounded-full hover:bg-error/40 transition-all shadow-[0_0_15px_rgba(255,113,108,0.2)]">
              Terminate
            </button>
          </div>
        </header>

        {/* Side Nav Shell (Optional/Cosmetic) */}
        <nav className="fixed left-4 top-1/2 -translate-y-1/2 w-16 rounded-3xl border border-violet-500/15 bg-slate-950/40 backdrop-blur-2xl flex flex-col items-center py-8 z-40 shadow-2xl shadow-violet-900/20">
          <div className="flex flex-col items-center gap-4 w-full">
            <div onClick={handleEndInterview} className="flex flex-col items-center justify-center text-slate-500 p-2 w-full hover:bg-violet-500/10 hover:text-violet-200 transition-all cursor-pointer">
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
            
            {/* Question Card */}
            <div className="glass-panel rounded-xl p-8 md:p-10 flex flex-col justify-center min-h-[240px] md:min-h-[300px] relative overflow-hidden transition-all duration-500">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-30"></div>
              <div className="flex justify-between items-center mb-6">
                <span className="font-label text-[10px] uppercase tracking-[0.2em] text-primary">Current Objective</span>
                {currentQuestion?.type && (
                  <span className="bg-surface-container-highest px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-widest border border-outline-variant/30 text-on-surface-variant flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
                    {currentQuestion.type.replace('_', ' ')}
                  </span>
                )}
              </div>
              <h1 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight leading-normal text-white">
                {currentQuestion ? currentQuestion.question : 'Awaiting system prompt...'}
              </h1>
              {hint && (
                <div className="mt-6 flex items-start gap-3 p-4 bg-tertiary/10 border border-tertiary/20 rounded-xl animate-in fade-in slide-in-from-top-4">
                  <span className="material-symbols-outlined text-tertiary text-[18px]">lightbulb</span>
                  <p className="text-tertiary font-body text-sm">{hint}</p>
                </div>
              )}
            </div>

            {/* Real-time Transcript */}
            <div className="flex-1 glass-panel rounded-xl p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6" ref={transcriptRef}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 animate-in fade-in slide-in-from-bottom-2 ${msg.type === 'ai' ? '' : msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center border ${
                    msg.type === 'ai' ? 'bg-primary/20 border-primary/30' : 
                    msg.type === 'user' ? 'bg-secondary/20 border-secondary/30' : 
                    'bg-white/10 border-white/20'
                  }`}>
                    <span className={`material-symbols-outlined text-sm ${
                      msg.type === 'ai' ? 'text-primary' : 
                      msg.type === 'user' ? 'text-secondary' : 
                      'text-outline'
                    }`}>
                      {msg.type === 'ai' ? 'smart_toy' : msg.type === 'user' ? 'person' : 'info'}
                    </span>
                  </div>
                  <div className={`space-y-1 max-w-[80%] ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
                    <span className={`text-[10px] font-label uppercase tracking-widest ${
                      msg.type === 'ai' ? 'text-primary/70' : 
                      msg.type === 'user' ? 'text-secondary/70' : 
                      'text-outline-variant'
                    }`}>
                      {msg.type === 'ai' ? 'SkillWise AI' : msg.type === 'user' ? 'Candidate' : 'System'}
                    </span>
                    <p className={`text-sm leading-relaxed ${
                      msg.type === 'system' || msg.type === 'complete' ? 'text-emerald-400 italic font-medium' : 
                      msg.type === 'error' ? 'text-error font-medium' : 
                      'text-on-surface'
                    }`}>
                      {msg.text}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Active Transcript Overlay */}
              {(isListening || transcript || interimTranscript) && (
                <div className="flex gap-4 flex-row-reverse animate-in fade-in">
                  <div className="w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center border bg-secondary/10 border-white/5 relative">
                    <span className="material-symbols-outlined text-secondary/70 text-sm">more_horiz</span>
                    <div className="absolute inset-0 border-2 border-secondary/50 rounded-full animate-ping"></div>
                  </div>
                  <div className="bg-surface-container-low max-w-[80%] p-3 rounded-lg rounded-tr-sm border border-secondary/10 text-right">
                    <p className="text-on-surface text-sm">
                      {transcript} 
                      {interimTranscript && <span className="text-outline italic"> {interimTranscript}</span>}
                      {isListening && !transcript && !interimTranscript && <span className="text-outline/40 italic">Listening...</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* Answer Result Block */}
              {answerResult && (
                <div className="flex gap-4 animate-in fade-in slide-in-from-top-4 my-2">
                  <div className="w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center border bg-emerald-500/10 border-emerald-500/20">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-label uppercase tracking-widest text-emerald-400/80">AI Evaluation Engine</span>
                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                       <p className="text-sm text-emerald-300/90 font-medium">
                         Response securely captured. Integrity checks applied. Proceed to the next objective when ready.
                       </p>
                    </div>
                  </div>
                </div>
              )}
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
