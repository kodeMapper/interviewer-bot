import React, { useEffect, useRef } from 'react';
import { useProctoring } from '../../context/ProctoringContext';

const AlertOverlay = () => {
  const { isSafe, alertTrigger, isServiceConnected } = useProctoring();
  const audioRef = useRef(null);

  // Re-play audio every time alertTrigger increments (every new alert detection)
  useEffect(() => {
    if (alertTrigger > 0 && !isSafe && isServiceConnected && audioRef.current) {
      // Reset audio to start and play
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Audio blocked by browser policy:', e));
    }
  }, [alertTrigger, isSafe, isServiceConnected]);

  if (isSafe || !isServiceConnected) return null;

  return (
    <>
       <audio ref={audioRef} src="/alert.mp3" preload="auto" />
       {/* High z-index global overlay */}
       <div className="fixed inset-0 pointer-events-none z-[100] animate-[pulse_1.5s_infinite] border-[6px] border-error/80 shadow-[inset_0_0_150px_rgba(255,180,171,0.2)] transition-all duration-300">
         <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-error/90 backdrop-blur-md text-on-error font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-error-container/50">
           <span className="w-3 h-3 bg-on-error rounded-full animate-ping"></span>
           INTERVENTION REQUIRED
         </div>
       </div>
    </>
  );
};

export default AlertOverlay;
