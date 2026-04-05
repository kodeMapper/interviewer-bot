import { motion } from 'framer-motion';
import { CheckCircle, SkipForward } from 'lucide-react';

function AnswerResult({ result }) {
  const { isSkipped, type } = result;

  // During interview, we only show "Answer recorded" - no scores or feedback
  // Feedback is only shown in the final report
  
  const getIcon = () => {
    if (isSkipped) return <SkipForward className="w-8 h-8 text-secondary-400" />;
    return <CheckCircle className="w-8 h-8 text-green-400" />;
  };

  const getMessage = () => {
    if (isSkipped) return 'Question skipped';
    if (type === 'recorded') return 'Answer recorded';
    return 'Answer recorded';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card !p-6 bg-[#00a572]/5 border-[#00a572]/20 shadow-none border"
    >
      <div className="flex items-center gap-5">
        {/* Icon */}
        <div className={`flex-shrink-0 p-3 rounded-2xl ${isSkipped ? 'bg-surface-container text-outline' : 'bg-[#00a572]/20 text-[#00a572]'}`}>
          {getIcon()}
        </div>

        {/* Content - Simple message, no score/feedback during interview */}
        <div className="flex-1">
          <p className="text-xl font-bold text-on-surface tracking-wide">
            {getMessage()}
          </p>
          <p className="text-[13px] text-outline font-medium mt-1">
            Feedback will be provided in your final report
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default AnswerResult;
