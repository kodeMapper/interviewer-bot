import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for Web Speech API - Speech Synthesis (TTS)
 * Includes a speech queue to prevent interruptions
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const utteranceRef = useRef(null);
  const speechQueueRef = useRef([]);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      setIsSupported(true);
      
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Priority 1: Google Female Voice
        const googleFemale = availableVoices.find(v => v.lang.startsWith('en') && v.name.includes('Google') && (v.name.includes('Female') || v.name.includes('UK') || v.name.includes('US')));
        // Priority 2: Edge/Microsoft Female Voice
        const msFemale = availableVoices.find(v => v.lang.startsWith('en') && (v.name.includes('Zira') || v.name.includes('Hazel') || v.name.includes('Jenny') || v.name.includes('Aria') || v.name.toLowerCase().includes('female')));
        // Priority 3: Any English voice that doesn't say "David" or "Mark"
        const anyEnglishFemale = availableVoices.find(v => v.lang.startsWith('en') && !v.name.includes('David') && !v.name.includes('Mark'));
        
        const bestVoice = googleFemale || msFemale || anyEnglishFemale || availableVoices.find(v => v.lang.startsWith('en'));
        if (bestVoice) {
          setSelectedVoice(bestVoice);
        }
      };
      
      loadVoices();
      
      // Async load for web voices
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }

      // Voice Warm-up: Play a silent utterance to lock the engine
      const warmup = new SpeechSynthesisUtterance('');
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);
      
    } else {
      setIsSupported(false);
    }
    
    return () => {
      window.speechSynthesis?.cancel();
      speechQueueRef.current = [];
    };
  }, []);

  // Process the speech queue
  const processQueue = useCallback(() => {
    if (isProcessingRef.current || speechQueueRef.current.length === 0) {
      return;
    }
    
    isProcessingRef.current = true;
    const { text, options, resolve, reject } = speechQueueRef.current.shift();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set options
    utterance.voice = options.voice || selectedVoice;
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 0.8; // Default to 0.8 to prevent loud spikes
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    
    utterance.onend = () => {
      setIsSpeaking(speechQueueRef.current.length > 0);
      setIsPaused(false);
      isProcessingRef.current = false;
      resolve();
      // Process next item in queue
      processQueue();
    };
    
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      setIsPaused(false);
      isProcessingRef.current = false;
      reject(event.error);
      // Try next item in queue
      processQueue();
    };
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [selectedVoice]);

  // Queue-based speak function - doesn't cancel ongoing speech
  const speak = useCallback((text, options = {}) => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }
      
      // Add to queue instead of canceling
      speechQueueRef.current.push({ text, options, resolve, reject });
      
      // Start processing if not already
      processQueue();
    });
  }, [isSupported, processQueue]);

  const pause = useCallback(() => {
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSpeaking, isPaused]);

  const resume = useCallback(() => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  const cancel = useCallback(() => {
    // Clear the queue and cancel current speech
    speechQueueRef.current = [];
    isProcessingRef.current = false;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  return {
    isSpeaking,
    isPaused,
    voices,
    selectedVoice,
    setSelectedVoice,
    isSupported,
    speak,
    pause,
    resume,
    cancel
  };
}

export default useSpeechSynthesis;
