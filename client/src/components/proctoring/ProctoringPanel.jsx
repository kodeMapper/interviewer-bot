import React, { useEffect, useRef } from 'react';
import { useProctoring } from '../../context/ProctoringContext';

const ProctoringPanel = () => {
  const { isSafe, alertCount, isServiceConnected, alertHistory, detailedMetrics } = useProctoring();
  const logContainerRef = useRef(null);

  // Auto-scroll the security log to the latest entry
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [alertHistory]);

  return (
    <div className="flex flex-col gap-6 w-full h-full max-h-screen">
      {/* Webcam & Status */}
      <div className="relative aspect-video rounded-xl overflow-hidden glass-panel border border-white/10 group shrink-0">
        {isServiceConnected ? (
          <img src="/api/proctoring/video" className="w-full h-full object-cover" alt="Live Feed" />
        ) : (
          <div className="flex items-center justify-center h-full text-outline-variant font-label text-xs uppercase tracking-widest bg-surface-container-low">Service Offline</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        {isServiceConnected && (
          <div className={`absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md ${isSafe ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-error/20 border-error/40'}`}>
            <div className={`w-2 h-2 rounded-full ${isSafe ? 'bg-emerald-500 shadow-[0_0_8px_#34d399]' : 'bg-error shadow-[0_0_8px_#ff716c] animate-pulse'}`}></div>
            <span className={`font-label text-[10px] font-bold tracking-widest uppercase ${isSafe ? 'text-emerald-400' : 'text-error'}`}>
              {isSafe ? 'Safe' : 'Alert'}
            </span>
          </div>
        )}
        <div className="absolute bottom-4 left-4">
          <span className="text-xs font-semibold text-white/90">Identity Feed</span>
        </div>
      </div>

      {/* Proctoring Telemetry */}
      <div className="glass-panel rounded-xl p-5 flex flex-col gap-4 shrink-0 border border-outline-variant/10">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Proctoring Telemetry</h3>
          {alertCount > 0 && (
            <span className="text-[10px] font-bold text-error animate-pulse">{alertCount} Flags</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-lowest/50 p-3 rounded-lg border border-white/5 space-y-1 hover:bg-surface-container-low transition-colors duration-300">
            <span className="text-[8px] text-on-surface-variant uppercase tracking-tighter">Gaze</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-on-surface">{detailedMetrics.gaze || '--'}</span>
              <span className={`material-symbols-outlined text-sm ${detailedMetrics.gaze === 'Center' ? 'text-secondary' : 'text-error'}`} style={{fontVariationSettings: "'FILL' 1"}}>
                visibility
              </span>
            </div>
          </div>
          <div className="bg-surface-container-lowest/50 p-3 rounded-lg border border-white/5 space-y-1 hover:bg-surface-container-low transition-colors duration-300">
            <span className="text-[8px] text-on-surface-variant uppercase tracking-tighter">Faces</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-on-surface">{detailedMetrics.faces ?? '--'}</span>
              <span className={`material-symbols-outlined text-sm ${detailedMetrics.faces === 1 ? 'text-secondary' : 'text-error'}`} style={{fontVariationSettings: "'FILL' 1"}}>
                groups
              </span>
            </div>
          </div>
          {detailedMetrics.cellphone && (
            <div className="col-span-2 bg-error/10 p-3 rounded-lg border border-error/30 space-y-1">
              <span className="text-[8px] text-error uppercase tracking-tighter">Device Detected</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-bold text-error">Cellphone in Frame</span>
                <span className="material-symbols-outlined text-error text-sm" style={{fontVariationSettings: "'FILL' 1"}}>
                  phone_android
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Log */}
      <div className="flex-1 min-h-[150px] glass-panel rounded-xl p-5 flex flex-col border border-outline-variant/10 overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0 border-b border-white/5 pb-3">
          <h3 className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">shield_lock</span>
            Security Log
          </h3>
          <span className="text-[8px] font-mono text-secondary/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
            LIVE_STREAM_ACTIVE
          </span>
        </div>
        <div 
          ref={logContainerRef}
          className="flex-1 overflow-y-auto font-mono text-[10px] text-on-surface-variant/70 space-y-3 custom-scrollbar pr-2"
        >
          <div className="flex gap-2">
            <span className="text-secondary/40 shrink-0">[System]</span>
            <span className="text-primary/60">Telemetry engine initialized...</span>
          </div>
          {alertHistory.length === 0 ? (
            <div className="flex gap-2 opacity-50">
              <span className="text-secondary/40 shrink-0">[{new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" })}]</span>
              <span className="text-emerald-400/80">No integrity infractions detected.</span>
            </div>
          ) : (
            alertHistory.map((log, i) => (
              <div key={i} className="flex gap-2 items-start py-0.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="text-secondary/40 shrink-0 font-bold">[{log.time}]</span>
                <span className="text-error/90 font-medium">{log.reason}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProctoringPanel;
