import React, { useEffect, useState, useRef } from 'react';
import { proctoringAPI } from '../../services/api';

const PreCheck = ({ sessionId, onComplete }) => {
  const [status, setStatus] = useState('initializing'); // 'initializing', 'ready', 'error'
  const [errorMsg, setErrorMsg] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const initProctoring = async () => {
      try {
        await proctoringAPI.setMeta(sessionId, { name: 'Candidate' });
        await proctoringAPI.start();

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.warn('Permissions denied', err);
        }

        const statusRes = await proctoringAPI.getStatus();
        if (mounted) {
          if (statusRes.data && !statusRes.error) {
            setStatus('ready');
          } else {
            setStatus('error');
            setErrorMsg(statusRes.error || statusRes.warning || 'Failed to establish secure connection');
          }
        }
      } catch (err) {
        if (mounted) {
          setStatus('error');
          setErrorMsg('Proctoring engine failed to initialize. Check system services.');
        }
      }
    };

    initProctoring();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const handleImageLoad = () => setCameraActive(true);
  const handleImageError = () => setCameraActive(false);

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* HUD Camera Preview */}
      <div className="relative aspect-video rounded-2xl overflow-hidden glass-panel border border-white/10 group">
        <div className="absolute inset-0 bg-surface-container-lowest flex items-center justify-center">
          {status === 'initializing' && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                 <div className="absolute inset-0 border-2 border-primary/20 rounded-full"></div>
                 <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                 <span className="absolute inset-0 flex items-center justify-center material-symbols-outlined text-primary/50">nest_cam_iq</span>
              </div>
              <span className="font-label text-xs uppercase tracking-widest text-primary animate-pulse">Initializing Optics</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 w-3/4 text-center">
              <span className="material-symbols-outlined text-[48px] text-error">warning</span>
              <span className="font-label text-sm uppercase tracking-widest text-error">Optics Failure</span>
              <p className="text-xs font-mono text-error/70">{errorMsg}</p>
            </div>
          )}

          {(status === 'ready' || status === 'initializing') && (
            <>
              <img
                ref={videoRef}
                src="/api/proctoring/video"
                alt="Feed"
                onLoad={handleImageLoad}
                onError={handleImageError}
                className={`w-full h-full object-cover transition-opacity duration-1000 ${cameraActive ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
              />
              {/* Scan Line Animation */}
              {cameraActive && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-30 scan-line shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
              )}
            </>
          )}
        </div>

        {/* HUD Targeting Overlay */}
        <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5">
          <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary/50"></div>
          <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary/50"></div>
          <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary/50"></div>
          <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary/50"></div>
        </div>

        {/* Top Status Indicators */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
           <div className={`px-3 py-1.5 rounded-full border backdrop-blur-md flex items-center gap-2 ${cameraActive ? 'bg-secondary/20 border-secondary/40' : 'bg-surface-container-high border-outline-variant'}`}>
             <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-secondary shadow-[0_0_8px_#00daf3]' : 'bg-outline-variant/50'}`}></div>
             <span className={`font-label text-[10px] tracking-widest uppercase font-bold ${cameraActive ? 'text-secondary' : 'text-on-surface-variant'}`}>
               {cameraActive ? 'Live Feed' : 'Offline'}
             </span>
           </div>
           
           <div className="flex gap-2">
             {['mic', 'face'].map((icon, i) => (
               <div key={icon} className={`w-8 h-8 rounded-full border flex items-center justify-center backdrop-blur-sm ${cameraActive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-surface-container border-white/5'}`}>
                 <span className={`material-symbols-outlined text-[14px] ${cameraActive ? 'text-emerald-400' : 'text-outline-variant'}`}>{icon}</span>
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* Proctoring Transparency Notice */}
      <div className="flex bg-surface-container-low rounded-xl border border-primary/10 overflow-hidden group hover:border-primary/30 transition-colors">
        <div className="w-1.5 bg-gradient-to-b from-primary via-secondary to-transparent shrink-0"></div>
        <div className="p-5 flex gap-4 w-full">
           <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
             <span className="material-symbols-outlined text-primary text-[20px]">policy</span>
           </div>
           <div className="flex-1 space-y-1">
             <h4 className="font-label text-[11px] uppercase tracking-widest text-primary flex justify-between">
               Integrity Monitored
               <span className="text-[9px] text-on-surface-variant font-mono">STRICT_MODE</span>
             </h4>
             <p className="text-sm font-body text-on-surface-variant leading-relaxed">
               By proceeding, you consent to automated behavioral analysis. Gaze direction, face presence, and device detection protocols are currently active. 
               Data is processed locally on the secure server layer.
             </p>
           </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 mt-auto">
        <button
          onClick={onComplete}
          disabled={status !== 'ready' || !cameraActive}
          className="bg-primary text-on-primary px-10 py-4 rounded-full font-bold flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 shadow-[0_0_30px_rgba(166,140,255,0.2)] w-full md:w-auto"
        >
          {status === 'ready' && cameraActive ? 'Confirm & Enter Room' : 'Awaiting System Link...'}
          <span className="material-symbols-outlined">exit_to_app</span>
        </button>
      </div>
      
    </div>
  );
};

export default PreCheck;
