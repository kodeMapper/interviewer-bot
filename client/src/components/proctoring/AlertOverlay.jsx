import React, { useEffect, useRef } from 'react';
import { useProctoring } from '../../context/ProctoringContext';

const AlertOverlay = () => {
  const { isSafe, isServiceConnected } = useProctoring();
  const audioRef = useRef(null);

  useEffect(() => {
    // Only attempt to play if audio element is ready and in an alert state
    if (!isSafe && isServiceConnected && audioRef.current) {
      // Browsers may block auto-play if user hasn't interacted, but since 
      // they clicked "Start Interview", the domain usually inherits interaction permission.
      audioRef.current.play().catch(e => console.log('Audio blocked by browser policy:', e));
    }
  }, [isSafe, isServiceConnected]);

  // Generate a very brief silent 'bloop' dynamically or rely on local asset
  // We use a dummy data URI for a tiny beep here if alert.mp3 is missing
  const beepDataUri = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU";

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
