import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { proctoringAPI } from '../services/api';

const ProctoringContext = createContext();

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

    const initCamera = async () => {
      try {
        let videoConstraints = { width: 640, height: 480, frameRate: { ideal: 15 } };
        
        // Auto-select best camera (prefer external webcams which are usually listed last)
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          if (videoDevices.length > 1) {
             videoConstraints.deviceId = { exact: videoDevices[videoDevices.length - 1].deviceId };
          }
        } catch (e) {
          console.warn("Could not enumerate devices:", e);
        }

        localStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints
        });
        
        if (mounted) {
          setStream(localStream);
          
          if (!videoRef.current) {
             videoRef.current = document.createElement('video');
             videoRef.current.autoplay = true;
             videoRef.current.muted = true;
             videoRef.current.playsInline = true;
          }
          videoRef.current.srcObject = localStream;
          videoRef.current.play().catch(e => console.error("Error playing hidden video for snapshot:", e));
          
          if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            canvasRef.current.width = 640;
            canvasRef.current.height = 480;
          }
        }
      } catch (err) {
        console.error("Proctoring camera access denied or missing:", err);
        if (mounted) setIsServiceConnected(false);
      }
    };
    
    initCamera();

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

    // Replace isSafe dependency with empty array so effect never re-runs and camera stays locked on
    intervalId = setInterval(processFrame, 1000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
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
