import { motion } from 'framer-motion';

function QuestionCard({ question, topic, questionNumber, total, type }) {
  const getTypeColor = () => {
    switch (type) {
      case 'resume_warmup':
        return 'bg-[#00a572]/10 text-[#00a572] border-[#00a572]/20';
      case 'resume_deep_dive':
        return 'bg-[#d8b4fe]/10 text-[#d8b4fe] border-[#d8b4fe]/20';
      case 'deep_dive':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'mix_round':
        return 'bg-[#ffb37a]/10 text-[#ffb37a] border-[#ffb37a]/20';
      default:
        return 'bg-outline-variant/20 text-outline border-outline-variant/30';
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
      className="card !p-8 bg-surface-container-highest/40 border border-outline-variant/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs tracking-wider uppercase font-bold border ${getTypeColor()}`}>
            {getTypeName()}
          </span>
          {topic && (
            <span className="skill-badge text-xs">{topic}</span>
          )}
        </div>
        
        {questionNumber && total && (
          <span className="text-outline text-xs uppercase tracking-widest font-semibold bg-surface-container py-1 px-3 rounded-full border border-outline-variant/10">
            Question {questionNumber} / {total}
          </span>
        )}
      </div>

      {/* Question */}
      <h2 className="text-2xl font-semibold text-on-surface leading-normal">
        {question}
      </h2>
    </motion.div>
  );
}

export default QuestionCard;
