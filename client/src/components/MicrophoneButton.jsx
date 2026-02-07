import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, SkipForward, HelpCircle } from 'lucide-react';

function MicrophoneButton({ 
  isListening, 
  isSpeaking,
  onToggleListen,
  onSkip,
  onHint,
  disabled = false
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Main microphone button */}
      <motion.button
        onClick={onToggleListen}
        disabled={disabled || isSpeaking}
        className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
          isListening 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-primary-500 hover:bg-primary-600'
        } ${disabled || isSpeaking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
      >
        {/* Pulse animation when listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-red-400"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.5, 0, 0.5]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-red-400"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0, 0.3]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            />
          </>
        )}
        
        {/* Icon */}
        {isListening ? (
          <MicOff className="w-10 h-10 text-white relative z-10" />
        ) : (
          <Mic className="w-10 h-10 text-white relative z-10" />
        )}
      </motion.button>

      {/* Status text */}
      <div className="text-center">
        {isSpeaking ? (
          <div className="flex items-center gap-2 text-secondary-400">
            <Volume2 className="w-5 h-5 animate-pulse" />
            <span>AI is speaking...</span>
          </div>
        ) : isListening ? (
          <div className="flex items-center gap-2 text-red-400">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-400 rounded-full voice-bar"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <span>Listening... Click to stop</span>
          </div>
        ) : (
          <span className="text-secondary-400">Click to start speaking</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={onHint}
          disabled={disabled || isSpeaking || isListening}
          className="flex items-center gap-2 px-4 py-2 bg-secondary-700 hover:bg-secondary-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Hint</span>
        </button>
        
        <button
          onClick={onSkip}
          disabled={disabled || isSpeaking}
          className="flex items-center gap-2 px-4 py-2 bg-secondary-700 hover:bg-secondary-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <SkipForward className="w-4 h-4" />
          <span>Skip</span>
        </button>
      </div>
    </div>
  );
}

export default MicrophoneButton;
