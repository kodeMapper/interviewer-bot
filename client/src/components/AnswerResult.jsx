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
      className="card"
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 p-3 bg-secondary-700 rounded-xl">
          {getIcon()}
        </div>

        {/* Content - Simple message, no score/feedback during interview */}
        <div className="flex-1">
          <p className="text-lg text-secondary-200">
            {getMessage()}
          </p>
          <p className="text-sm text-secondary-400 mt-1">
            Feedback will be provided in your final report
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default AnswerResult;
