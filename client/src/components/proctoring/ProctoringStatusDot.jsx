import React from 'react';
import { useProctoring } from '../../context/ProctoringContext';

const ProctoringStatusDot = () => {
  const { isSafe, isServiceConnected } = useProctoring();
  
  if (!isServiceConnected) {
    return <div title="Proctoring Offline" className="w-3 h-3 rounded-full bg-gray-600"></div>;
  }
  
  return (
    <div title={isSafe ? 'Monitoring Active (Safe)' : 'Alert Detected'} className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full border border-gray-700">
       <span className="text-[10px] font-bold tracking-widest text-gray-400">PROCTOR</span>
       <div className={`w-3 h-3 rounded-full ${isSafe ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse'}`}></div>
    </div>
  );
};

export default ProctoringStatusDot;
