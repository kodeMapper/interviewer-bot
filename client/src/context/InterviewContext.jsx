import { createContext, useContext, useState, useCallback } from 'react';

const InterviewContext = createContext(null);

export function InterviewProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [progress, setProgress] = useState({
    state: 'INTRO',
    questionsAsked: 0,
    totalAnswered: 0,
    totalSkipped: 0,
    averageScore: 0
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');

  const updateSession = useCallback((data) => {
    setSession(prev => ({ ...prev, ...data }));
  }, []);

  const addAnswer = useCallback((answer) => {
    setAnswers(prev => [...prev, answer]);
  }, []);

  const resetInterview = useCallback(() => {
    setSession(null);
    setCurrentQuestion(null);
    setAnswers([]);
    setProgress({
      state: 'INTRO',
      questionsAsked: 0,
      totalAnswered: 0,
      totalSkipped: 0,
      averageScore: 0
    });
    setTranscript('');
  }, []);

  const value = {
    session,
    setSession,
    updateSession,
    isConnected,
    setIsConnected,
    currentQuestion,
    setCurrentQuestion,
    answers,
    addAnswer,
    progress,
    setProgress,
    isListening,
    setIsListening,
    isSpeaking,
    setIsSpeaking,
    transcript,
    setTranscript,
    resetInterview
  };

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
}
