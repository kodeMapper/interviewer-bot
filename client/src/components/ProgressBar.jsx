import { motion } from 'framer-motion';

function ProgressBar({ progress, state }) {
  const states = ['INTRO', 'RESUME_WARMUP', 'RESUME_DEEP_DIVE', 'DEEP_DIVE', 'MIX_ROUND', 'FINISHED'];
  const currentIndex = states.indexOf(state);
  const percentage = ((currentIndex + 1) / states.length) * 100;

  const getStateName = (s) => {
    switch (s) {
      case 'INTRO': return 'Intro';
      case 'RESUME_WARMUP': return 'Warmup';
      case 'RESUME_DEEP_DIVE': return 'Resume';
      case 'DEEP_DIVE': return 'Technical';
      case 'MIX_ROUND': return 'Mixed';
      case 'FINISHED': return 'Done';
      default: return s;
    }
  };

  return (
    <div className="card !p-4 bg-surface-container/50 border border-outline-variant/10">
      {/* Progress bar */}
      <div className="relative h-1.5 bg-surface-variant rounded-full overflow-hidden mb-3">
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-[#4d8eff] shadow-[0_0_8px_theme(colors.primary.DEFAULT)]"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* State indicators */}
      <div className="flex justify-between">
        {states.map((s, index) => (
          <div
            key={s}
            className={`text-[10px] uppercase tracking-wider font-bold ${
              index <= currentIndex 
                ? 'text-primary' 
                : 'text-outline/70'
            }`}
          >
            {getStateName(s)}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-outline-variant/20">
        <div className="text-center">
          <p className="text-2xl font-black text-on-surface">
            {progress.totalAnswered || 0}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-outline">Answered</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-on-surface">
            {progress.totalSkipped || 0}
          </p>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-outline">Skipped</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-black ${
            (progress.averageScore || 0) >= 60 ? 'text-[#00a572]' : 'text-error'
          }`}>
            {progress.averageScore || 0}%
          </p>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-outline">Avg Score</p>
        </div>
      </div>
    </div>
  );
}

export default ProgressBar;
