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
      
      // Get available voices
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Select default English voice
        const englishVoice = availableVoices.find(
          voice => voice.lang.startsWith('en') && voice.name.includes('Google')
        ) || availableVoices.find(
          voice => voice.lang.startsWith('en')
        );
        
        if (englishVoice) {
          setSelectedVoice(englishVoice);
        }
      };
      
      loadVoices();
      
      // Chrome loads voices async
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
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
    utterance.volume = options.volume || 1;
    
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
