import { motion } from 'framer-motion';

function QuestionCard({ question, topic, questionNumber, total, type }) {
  const getTypeColor = () => {
    switch (type) {
      case 'resume_warmup':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'resume_deep_dive':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'deep_dive':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'mix_round':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30';
    }
  };

  const getTypeName = () => {
    switch (type) {
      case 'resume_warmup':
        return 'Resume Warmup';
      case 'resume_deep_dive':
        return 'Resume Deep Dive';
      case 'deep_dive':
        return 'Technical Deep Dive';
      case 'mix_round':
        return 'Mixed Round';
      default:
        return 'Question';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor()}`}>
            {getTypeName()}
          </span>
          {topic && (
            <span className="skill-badge">{topic}</span>
          )}
        </div>
        
        {questionNumber && total && (
          <span className="text-secondary-400 text-sm">
            Question {questionNumber} of {total}
          </span>
        )}
      </div>

      {/* Question */}
      <h2 className="text-xl font-medium text-white leading-relaxed">
        {question}
      </h2>
    </motion.div>
  );
}

export default QuestionCard;
