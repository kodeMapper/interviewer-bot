import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { proctoringAPI } from '../services/api';

const ProctoringContext = createContext();

const DEFAULT_FRAME_INTERVAL_MS = 500; // 2 fps
const parsedInterval = Number(import.meta.env.VITE_PROCTOR_FRAME_INTERVAL_MS);
const FRAME_INTERVAL_MS = Number.isFinite(parsedInterval) && parsedInterval >= 250
  ? parsedInterval
  : DEFAULT_FRAME_INTERVAL_MS;

export const useProctoring = () => useContext(ProctoringContext);

export const ProctoringProvider = ({ children }) => {
  const [isSafe, setIsSafe] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const [alertTrigger, setAlertTrigger] = useState(0);
  const [isServiceConnected, setIsServiceConnected] = useState(true);
  const [alertHistory, setAlertHistory] = useState([]);
  const [detailedMetrics, setDetailedMetrics] = useState({
    faces: 0,
    gaze: 'Unknown',
    cellphone: false
  });
  
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Use a ref for isSafe so interval can read latest value without triggering re-renders/cleanup
  const isSafeRef = useRef(true);
  useEffect(() => {
    isSafeRef.current = isSafe;
  }, [isSafe]);

  useEffect(() => {
    let mounted = true;
    let localStream = null;
    let intervalId = null;
    let recovering = false;

    const getVideoStreamWithFallback = async () => {
      let attempts = [
        {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15, max: 24 }
          }
        },
        { video: true }
      ];

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === 'videoinput');
        if (videoDevices.length > 0) {
          // "ideal" avoids hard failures seen on some laptops/virtual webcams.
          attempts = [
            {
              video: {
                deviceId: { ideal: videoDevices[0].deviceId },
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15, max: 24 }
              }
            },
            ...attempts
          ];
        }
      } catch (e) {
        console.warn('Could not enumerate devices for proctoring:', e);
      }

      let lastError = null;
      for (const constraints of attempts) {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError;
    };

    const stopLocalStream = () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
      }
    };

    const bindStream = async (nextStream) => {
      localStream = nextStream;
      if (!mounted) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }

      setStream(nextStream);

      if (!videoRef.current) {
        videoRef.current = document.createElement('video');
        videoRef.current.autoplay = true;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
      }
      videoRef.current.srcObject = nextStream;
      try {
        await videoRef.current.play();
      } catch (e) {
        console.error('Error playing hidden proctoring video:', e);
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = 640;
        canvasRef.current.height = 480;
      }

      nextStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (mounted) {
            recoverCamera('track-ended');
          }
        };
      });
    };

    const recoverCamera = async (reason = 'unknown') => {
      if (!mounted || recovering) return;
      recovering = true;
      try {
        stopLocalStream();
        const nextStream = await getVideoStreamWithFallback();
        await bindStream(nextStream);
        if (mounted) setIsServiceConnected(true);
      } catch (err) {
        console.error(`Proctoring camera recovery failed (${reason}):`, err);
        if (mounted) setIsServiceConnected(false);
      } finally {
        recovering = false;
      }
    };

    const initCamera = async () => {
      try {
        const nextStream = await getVideoStreamWithFallback();
        await bindStream(nextStream);
      } catch (err) {
        console.error('Proctoring camera access denied or missing:', err);
        if (mounted) setIsServiceConnected(false);
      }
    };
    
    initCamera();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const dead = !localStream || localStream.getVideoTracks().every((t) => t.readyState === 'ended');
        if (dead) recoverCamera('visibilitychange');
      }
    };

    const handleFullscreenChange = () => {
      const dead = !localStream || localStream.getVideoTracks().every((t) => t.readyState === 'ended');
      if (dead) recoverCamera('fullscreenchange');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    let failedPolls = 0;

    const processFrame = async () => {
      if (!mounted || !videoRef.current || !canvasRef.current || !isServiceConnected) return;
      if (videoRef.current.readyState < 2) return;

      const context = canvasRef.current.getContext('2d');
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.5);
      
      try {
        const res = await proctoringAPI.processFrame(base64Image);
        
        if (mounted && res && res.data) {
          failedPolls = 0;
          if (!isServiceConnected) setIsServiceConnected(true);

          if (res.data.status === 'ALERT') {
            if (isSafeRef.current) {
              setIsSafe(false);
            }
            setAlertCount(prev => prev + 1);
            setAlertTrigger(prev => prev + 1);
            setAlertHistory(prev => [...prev, { time: new Date().toLocaleTimeString(), reason: res.data.reason || res.data.description || 'Violation Detected' }]);
          } else if (res.data.status === 'SAFE') {
            if (!isSafeRef.current) setIsSafe(true);
          }
          
          // Only update detailed metrics if proctoring is actively producing them
          if (res.data.status !== 'STOPPED') {
             setDetailedMetrics({
               faces: res.data.faces_detected !== undefined ? res.data.faces_detected : (res.data.status === 'ALERT' && res.data.reason === 'NO FACE' ? 0 : 1),
               gaze: res.data.gaze_direction || (isSafeRef.current ? 'Center' : 'Away'),
               cellphone: res.data.cellphone_detected || false
             });
          }
        }
      } catch (e) {
        failedPolls++;
        if (failedPolls >= 3 && mounted) {
          setIsServiceConnected(false);
        }
      }
    };

    // Keep effect static so camera stream isn't recreated on every safety state change.
    intervalId = setInterval(processFrame, FRAME_INTERVAL_MS);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      stopLocalStream();
    };
  }, []);

  const stopProctoring = async () => {
    try {
      await proctoringAPI.stop();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    } catch (err) {
      console.error('Error stopping proctoring:', err);
    }
  };

  return (
    <ProctoringContext.Provider value={{ isSafe, alertCount, alertTrigger, isServiceConnected, alertHistory, detailedMetrics, stopProctoring, stream }}>
      {children}
    </ProctoringContext.Provider>
  );
};
