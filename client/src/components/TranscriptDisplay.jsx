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
      className="card !p-6"
    >
      <h3 className="text-[11px] font-bold tracking-wider uppercase text-outline mb-3 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`}></div>
        Your Answer
      </h3>
      <div className="min-h-[60px] p-4 bg-surface-container-low border border-outline-variant/10 rounded-xl">
        <p className="text-on-surface leading-relaxed text-lg">
          {transcript}
          {interimTranscript && (
            <span className="text-outline italic ml-1">
              {interimTranscript}
            </span>
          )}
          {isListening && !transcript && !interimTranscript && (
            <span className="text-outline/60 italic text-base">
              Start speaking...
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}

export default TranscriptDisplay;
