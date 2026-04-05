import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function Complete() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsReady(true);
          return 100;
        }
        return prev + 5;
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center selection:bg-primary/30 relative overflow-hidden font-body text-on-surface">
      {/* Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-container/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[150px] pointer-events-none"></div>
      
      <div className="glass-panel text-center max-w-xl w-full mx-4 p-12 rounded-3xl relative z-10 border border-white/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>
        
        {/* Success Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_30px_rgba(52,211,153,0.2)]">
            <span className="material-symbols-outlined text-5xl text-emerald-400" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
          </div>
        </div>

        <h1 className="text-4xl font-headline font-extrabold text-on-surface mb-4 tracking-tight">Interview Complete!</h1>
        <p className="text-on-surface-variant text-lg mb-10 max-w-md mx-auto leading-relaxed">
          Your technical interview session has finished successfully. The proctoring system has been disabled and your camera is now off.
        </p>

        {/* Progress Bar */}
        <div className="max-w-sm mx-auto mb-10">
          <div className="flex items-center justify-between text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-3">
            <span>Generating Report</span>
            <span className="text-primary font-bold">{progress}%</span>
          </div>
          <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_10px_rgba(166,140,255,0.5)] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            disabled={!isReady}
            onClick={() => navigate(`/report/${sessionId}`)}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-primary-container to-primary text-on-primary-container hover:scale-[1.02] active:scale-95 transition-all font-label text-xs uppercase tracking-widest shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="material-symbols-outlined text-sm">analytics</span>
            View Detailed Report
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Complete;
