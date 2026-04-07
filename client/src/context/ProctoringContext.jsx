import React, { createContext, useContext, useState, useEffect } from 'react';
import { proctoringAPI } from '../services/api';

const ProctoringContext = createContext();

export const useProctoring = () => useContext(ProctoringContext);

export const ProctoringProvider = ({ children }) => {
  const [isSafe, setIsSafe] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const [alertTrigger, setAlertTrigger] = useState(0); // Increments on EACH new alert detection
  const [isServiceConnected, setIsServiceConnected] = useState(true);
  const [alertHistory, setAlertHistory] = useState([]);
  const [detailedMetrics, setDetailedMetrics] = useState({
    faces: 0,
    gaze: 'Unknown',
    cellphone: false
  });

  useEffect(() => {
    let mounted = true;
    let failedPolls = 0;

    const pollStatus = async () => {
      try {
        const res = await proctoringAPI.getStatus();
        if (mounted && res && res.data) {
          failedPolls = 0;
          if (!isServiceConnected) setIsServiceConnected(true);

          if (res.data.status === 'ALERT') {
            if (isSafe) {
              setIsSafe(false);
            }
            // Increment on EVERY new alert poll to re-trigger audio
            setAlertCount(prev => prev + 1);
            setAlertTrigger(prev => prev + 1);
            setAlertHistory(prev => [...prev, { time: new Date().toLocaleTimeString(), reason: res.data.description || 'Violation Detected' }]);
          } else {
            if (!isSafe) setIsSafe(true);
          }
          
          setDetailedMetrics({
            faces: res.data.faces_detected !== undefined ? res.data.faces_detected : 1,
            gaze: res.data.gaze_direction || (isSafe ? 'Center' : 'Away'),
            cellphone: res.data.cellphone_detected || false
          });
        }
      } catch (e) {
        failedPolls++;
        if (failedPolls >= 3 && mounted) {
          setIsServiceConnected(false);
        }
      }
    };

    const intervalId = setInterval(pollStatus, 500);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [isSafe, isServiceConnected]);

  const stopProctoring = async () => {
    try {
      await proctoringAPI.stop();
    } catch (err) {
      console.error('Error stopping proctoring:', err);
    }
  };

  return (
    <ProctoringContext.Provider value={{ isSafe, alertCount, alertTrigger, isServiceConnected, alertHistory, detailedMetrics, stopProctoring }}>
      {children}
    </ProctoringContext.Provider>
  );
};

