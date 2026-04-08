import React, { useEffect, useCallback, useRef } from 'react';
import { useProctoring } from '../../context/ProctoringContext';

const AlertOverlay = () => {
  const { isSafe, alertTrigger, isServiceConnected } = useProctoring();
  const audioCtxRef = useRef(null);
  const lastBeepTimeRef = useRef(0);
  const isPlayingRef = useRef(false);

  const playBeep = useCallback(() => {
    const now = Date.now();
    // Strict throttle: 1000ms (matches context interval) + check if already playing
    if (now - lastBeepTimeRef.current < 950 || isPlayingRef.current) return;
    
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      isPlayingRef.current = true;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'square'; // More "electronic/alert" sound than sine
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.02); 
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15); 

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
      
      oscillator.onended = () => {
        isPlayingRef.current = false;
        lastBeepTimeRef.current = Date.now();
      };
    } catch (e) {
      console.log('Web Audio API error:', e);
      isPlayingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (alertTrigger > 0 && !isSafe && isServiceConnected) {
      playBeep();
    }
  }, [alertTrigger, isSafe, isServiceConnected, playBeep]);

  // Cleanup context on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  if (isSafe || !isServiceConnected) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] animate-[pulse_1.5s_infinite] border-[6px] border-error/80 shadow-[inset_0_0_150px_rgba(255,180,171,0.2)] transition-all duration-300">
      <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-error/90 backdrop-blur-md text-on-error font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-error-container/50">
        <span className="w-3 h-3 bg-on-error rounded-full animate-ping"></span>
        INTERVENTION REQUIRED
      </div>
    </div>
  );
};

export default AlertOverlay;
