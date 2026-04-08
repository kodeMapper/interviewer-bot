import React, { useEffect, useState, useRef, useCallback } from 'react';
import { proctoringAPI } from '../../services/api';

const CHECKLIST_ITEMS = [
  { id: 'camera', label: 'Camera Detected', icon: 'videocam' },
  { id: 'mic', label: 'Microphone Working', icon: 'mic' },
  { id: 'lighting', label: 'Lighting Adequate', icon: 'light_mode' },
  { id: 'screen', label: 'Single Screen Detected', icon: 'desktop_windows' },
  { id: 'browser', label: 'Browser Compatible', icon: 'language' },
  { id: 'services', label: 'Backend Services Online', icon: 'cloud_done' },
];

const PreCheck = ({ sessionId, onComplete }) => {
  const [checks, setChecks] = useState(
    CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: 'pending' }), {})
  ); // 'pending' | 'checking' | 'passed' | 'warning' | 'failed'
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const brightnessIntervalRef = useRef(null);

  const allCriticalPassed = checks.camera === 'passed' && checks.mic === 'passed' && checks.browser === 'passed' && checks.services === 'passed';

  const updateCheck = useCallback((id, status) => {
    setChecks(prev => ({ ...prev, [id]: status }));
  }, []);

  useEffect(() => {
    let mounted = true;

    const runChecks = async () => {
      // 1. Browser compatibility
      updateCheck('browser', 'checking');
      await delay(400);
      const browserOk = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      updateCheck('browser', browserOk ? 'passed' : 'failed');
      if (!browserOk) {
        setErrorMsg('Browser does not support required media APIs.');
        return;
      }

      // 2. Camera + Mic
      updateCheck('camera', 'checking');
      updateCheck('mic', 'checking');
      try {
        let videoConstraints = { width: 640, height: 480 };
        
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          if (videoDevices.length > 1) {
             // Prefer the last device added (often external webcams)
             videoConstraints.deviceId = { exact: videoDevices[videoDevices.length - 1].deviceId };
          }
        } catch (e) {
          console.warn("Could not enumerate devices in PreCheck:", e);
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoConstraints });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraActive(true);

        // Check audio tracks
        const audioTracks = stream.getAudioTracks();
        updateCheck('mic', audioTracks.length > 0 ? 'passed' : 'failed');

        // Check video tracks
        const videoTracks = stream.getVideoTracks();
        updateCheck('camera', videoTracks.length > 0 ? 'passed' : 'failed');
      } catch (err) {
        if (mounted) {
          updateCheck('camera', 'failed');
          updateCheck('mic', 'failed');
          setErrorMsg('Camera/Microphone access denied. Please grant permissions.');
          console.error(err);
        }
        return;
      }

      // 3. Lighting check (delayed to let camera warm up)
      updateCheck('lighting', 'checking');
      await delay(1500);
      if (mounted) checkBrightness();
      brightnessIntervalRef.current = setInterval(() => { if (mounted) checkBrightness(); }, 3000);

      // 4. Screen check
      updateCheck('screen', 'checking');
      await delay(400);
      try {
        if ('getScreenDetails' in window) {
          const details = await window.getScreenDetails();
          updateCheck('screen', details.screens.length > 1 ? 'warning' : 'passed');
        } else {
          // Can't detect — assume OK
          updateCheck('screen', 'passed');
        }
      } catch {
        updateCheck('screen', 'passed'); // permission denied = assume single screen
      }

      // 5. Backend services check
      updateCheck('services', 'checking');
      await delay(300);
      try {
        await proctoringAPI.getStatus();
        if (mounted) updateCheck('services', 'passed');
      } catch {
        if (mounted) {
          updateCheck('services', 'failed');
          setErrorMsg(prev => prev || 'Backend proctoring service is offline. Please ensure the server is running.');
        }
      }
    };

    runChecks();

    return () => {
      mounted = false;
      if (brightnessIntervalRef.current) clearInterval(brightnessIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [updateCheck]);

  const checkBrightness = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
    }
    const avg = sum / (data.length / 4);
    updateCheck('lighting', avg < 40 ? 'warning' : 'passed');
  };

  const handleEnterRoom = async () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch (err) { console.log("Fullscreen denied", err); }
    onComplete();
  };

  const getCheckIcon = (status) => {
    switch (status) {
      case 'passed': return { icon: 'check_circle', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
      case 'warning': return { icon: 'warning', color: 'text-tertiary', bg: 'bg-tertiary/10 border-tertiary/30' };
      case 'failed': return { icon: 'cancel', color: 'text-error', bg: 'bg-error/10 border-error/30' };
      case 'checking': return { icon: 'sync', color: 'text-primary animate-spin', bg: 'bg-primary/10 border-primary/30' };
      default: return { icon: 'radio_button_unchecked', color: 'text-outline-variant', bg: 'bg-surface-container border-white/5' };
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <canvas ref={canvasRef} className="hidden"></canvas>

      {/* Split Layout: Camera + Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Left: Camera Preview */}
        <div className="relative aspect-video md:aspect-auto md:min-h-[350px] rounded-2xl overflow-hidden glass-panel border border-white/10 group">
          <div className="absolute inset-0 bg-surface-container-lowest flex items-center justify-center">
            {errorMsg && (
              <div className="flex flex-col items-center gap-3 w-3/4 text-center z-20">
                <span className="material-symbols-outlined text-[48px] text-error">warning</span>
                <span className="font-label text-sm uppercase tracking-widest text-error">Optics Failure</span>
                <p className="text-xs font-mono text-error/70">{errorMsg}</p>
              </div>
            )}
            <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover transition-opacity duration-1000 ${cameraActive ? 'opacity-100' : 'opacity-0'}`} />
            {/* Centered "Initializing Optics" overlay — shown while camera is loading */}
            {!cameraActive && !errorMsg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-surface-container-lowest/80 backdrop-blur-sm">
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 border-2 border-primary/20 rounded-full"></div>
                  <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="absolute inset-0 flex items-center justify-center material-symbols-outlined text-primary/50">nest_cam_iq</span>
                </div>
                <span className="font-label text-xs uppercase tracking-widest text-primary animate-pulse">Initializing Optics</span>
              </div>
            )}
            {/* Looping horizontal scanner line */}
            {cameraActive && (
              <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.5)] animate-[scanLine_2.5s_ease-in-out_infinite] z-10"></div>
            )}
          </div>

          {/* HUD Corners */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary/50"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary/50"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary/50"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary/50"></div>
          </div>

          {/* Status Badge */}
          <div className="absolute top-4 left-4 pointer-events-none">
            <div className={`px-3 py-1.5 rounded-full border backdrop-blur-md flex items-center gap-2 ${cameraActive ? 'bg-secondary/20 border-secondary/40' : 'bg-surface-container-high border-outline-variant'}`}>
              <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-secondary shadow-[0_0_8px_#00daf3]' : 'bg-outline-variant/50'}`}></div>
              <span className={`font-label text-[10px] tracking-widest uppercase font-bold ${cameraActive ? 'text-secondary' : 'text-on-surface-variant'}`}>
                {cameraActive ? 'Local Feed' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: System Checklist */}
        <div className="glass-panel rounded-2xl border border-white/10 p-6 flex flex-col">
          <h3 className="font-label text-xs uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">checklist</span>
            System Checklist
          </h3>

          <div className="flex flex-col gap-3 flex-1">
            {CHECKLIST_ITEMS.map((item, idx) => {
              const st = getCheckIcon(checks[item.id]);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-500 ${st.bg}`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined text-[20px] ${st.color}`}>{st.icon}</span>
                  </div>
                  <span className="font-label text-sm tracking-wide text-on-surface flex-1">{item.label}</span>
                  {checks[item.id] === 'warning' && (
                    <span className="text-[10px] font-label uppercase tracking-widest text-tertiary">Warning</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest">
              {allCriticalPassed ? '✓ All critical checks passed' : 'Running diagnostics...'}
            </p>
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
              Integrity & Environment Lock
              <span className="text-[9px] text-on-surface-variant font-mono">STRICT_MODE</span>
            </h4>
            <p className="text-sm font-body text-on-surface-variant leading-relaxed">
              By proceeding, your browser will enter Fullscreen Mode. Video recording and AI proctoring will
              begin ONLY after you start the actual interview. Please ensure your environment is well-lit and you only use one monitor.
            </p>
          </div>
        </div>
      </div>

      {/* Enter Button */}
      <div className="flex justify-end pt-2 mt-auto">
        <button
          onClick={handleEnterRoom}
          disabled={!allCriticalPassed}
          className="bg-primary text-on-primary px-10 py-4 rounded-full font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:hover:scale-100 shadow-[0_0_30px_rgba(166,140,255,0.2)] w-full md:w-auto"
        >
          {allCriticalPassed ? 'Confirm & Enter Room' : 'Awaiting System Verification...'}
          <span className="material-symbols-outlined">fullscreen</span>
        </button>
      </div>
    </div>
  );
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export default PreCheck;

