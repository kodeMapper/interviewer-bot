import { motion } from 'framer-motion';

function TranscriptDisplay({ transcript, interimTranscript, isListening }) {
  if (!transcript && !interimTranscript && !isListening) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="card"
    >
      <h3 className="text-sm font-medium text-secondary-400 mb-2">
        Your Answer:
      </h3>
      <div className="min-h-[60px] p-4 bg-secondary-800/50 rounded-lg">
        <p className="text-white">
          {transcript}
          {interimTranscript && (
            <span className="text-secondary-400 italic ml-1">
              {interimTranscript}
            </span>
          )}
          {isListening && !transcript && !interimTranscript && (
            <span className="text-secondary-500 italic">
              Start speaking...
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}

export default TranscriptDisplay;
