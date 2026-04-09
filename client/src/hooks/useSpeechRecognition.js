import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for Web Speech API - Speech Recognition
 * 
 * IMPORTANT: Chrome's Web Speech API automatically stops recognition after:
 * - Silence timeout (~5-10 seconds of no speech)
 * - Network issues
 * - Browser internal limits
 * 
 * This hook handles auto-restart when the user wants continuous listening.
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef(null);
  const shouldRestartRef = useRef(false); // Track if we should auto-restart

  const ensureMicReady = useCallback(async () => {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      return true;
    }

    let tempStream = null;
    try {
      tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      return true;
    } catch (e) {
      const reason = e?.name || 'not-allowed';
      setError(reason);
      console.error('🎤 Microphone permission/availability check failed:', e);
      return false;
    } finally {
      if (tempStream) {
        tempStream.getTracks().forEach((t) => t.stop());
      }
    }
  }, []);

  useEffect(() => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
        setError(null);
      };
      
      recognition.onend = () => {
        console.log('🎤 Speech recognition ended, shouldRestart:', shouldRestartRef.current);
        
        // Chrome automatically stops recognition after silence
        // If user hasn't explicitly stopped, restart it
        if (shouldRestartRef.current) {
          console.log('🎤 Auto-restarting speech recognition...');
          try {
            // Small delay to prevent rapid restart loops
            setTimeout(() => {
              if (shouldRestartRef.current && recognitionRef.current) {
                recognitionRef.current.start();
              }
            }, 100);
          } catch (e) {
            console.error('Error restarting recognition:', e);
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('🎤 Speech recognition error:', event.error);
        
        // Don't set error for "aborted" - this happens when user stops normally
        if (event.error === 'aborted') {
          return;
        }
        
        // "no-speech" is not a critical error - just no audio detected
        if (event.error === 'no-speech') {
          console.log('🎤 No speech detected, will auto-restart if listening');
          return; // Let onend handle restart
        }
        
        setError(event.error);
        
        if (event.error === 'not-allowed') {
          console.error('Microphone permission denied');
          shouldRestartRef.current = false;
          setIsListening(false);
        } else if (event.error === 'audio-capture') {
          console.error('Microphone device unavailable/busy');
          // Try one soft recovery while user still intends to listen.
          if (shouldRestartRef.current) {
            setTimeout(async () => {
              const micOk = await ensureMicReady();
              if (!micOk || !shouldRestartRef.current || !recognitionRef.current) return;
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.error('🎤 Failed to recover speech recognition after audio-capture:', e);
              }
            }, 400);
          }
        } else if (event.error === 'network') {
          console.error('Network error in speech recognition');
          // Network errors might be temporary, let onend try restart
        }
      };
      
      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
            console.log('🎤 Final transcript:', result[0].transcript);
          } else {
            interim += result[0].transcript;
          }
        }
        
        if (final) {
          setTranscript(prev => (prev + ' ' + final).trim());
        }
        setInterimTranscript(interim);
        
        // Debug log for interim
        if (interim) {
          console.log('🎤 Interim:', interim);
        }
      };
      
      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
    }
    
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setInterimTranscript('');
      setError(null);

      const micOk = await ensureMicReady();
      if (!micOk) {
        shouldRestartRef.current = false;
        setIsListening(false);
        return;
      }

      shouldRestartRef.current = true; // Enable auto-restart
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Handle "already started" error
        if (e.name === 'InvalidStateError') {
          console.log('🎤 Recognition already running');
        } else {
          console.error('Error starting recognition:', e);
          setError(e.message);
        }
      }
    }
  }, [isListening, ensureMicReady]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false; // Disable auto-restart FIRST
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript: transcript.trim(),
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  };
}

export default useSpeechRecognition;
