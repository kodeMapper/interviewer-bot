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
    <div className="card">
      {/* Progress bar */}
      <div className="relative h-2 bg-secondary-700 rounded-full overflow-hidden mb-4">
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary-500 to-primary-400"
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
            className={`text-xs ${
              index <= currentIndex 
                ? 'text-primary-400' 
                : 'text-secondary-500'
            }`}
          >
            {getStateName(s)}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-secondary-700">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">
            {progress.totalAnswered || 0}
          </p>
          <p className="text-xs text-secondary-400">Answered</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-white">
            {progress.totalSkipped || 0}
          </p>
          <p className="text-xs text-secondary-400">Skipped</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${
            (progress.averageScore || 0) >= 60 ? 'text-green-400' : 'text-yellow-400'
          }`}>
            {progress.averageScore || 0}%
          </p>
          <p className="text-xs text-secondary-400">Avg Score</p>
        </div>
      </div>
    </div>
  );
}

export default ProgressBar;
