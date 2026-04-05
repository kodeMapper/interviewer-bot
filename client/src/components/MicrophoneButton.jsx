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
        className={`relative w-[5.5rem] h-[5.5rem] md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
          isListening 
            ? 'bg-error shadow-error/30' 
            : 'bg-primary shadow-primary/30'
        } ${disabled || isSpeaking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-2xl'}`}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
      >
        {/* Pulse animation when listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-error"
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
              className="absolute inset-0 rounded-full bg-error"
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
      <div className="text-center min-h-[32px] flex items-center justify-center">
        {isSpeaking ? (
          <div className="flex items-center gap-2 text-primary font-medium tracking-wide">
            <Volume2 className="w-5 h-5 animate-pulse" />
            <span>AI is speaking...</span>
          </div>
        ) : isListening ? (
          <div className="flex items-center gap-3 text-error font-medium tracking-wide">
            <div className="flex gap-1 items-end h-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-error rounded-full voice-bar"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <span>Listening... Tap to stop</span>
          </div>
        ) : (
          <span className="text-outline font-medium tracking-wide">Tap to start speaking</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={onHint}
          disabled={disabled || isSpeaking || isListening}
          className="flex items-center gap-2 px-5 py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface rounded-xl transition-colors disabled:opacity-50 border border-outline-variant/20 shadow-sm"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="text-sm font-semibold tracking-wide">Hint</span>
        </button>
        
        <button
          onClick={onSkip}
          disabled={disabled || isSpeaking}
          className="flex items-center gap-2 px-5 py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface rounded-xl transition-colors disabled:opacity-50 border border-outline-variant/20 shadow-sm"
        >
          <SkipForward className="w-4 h-4" />
          <span className="text-sm font-semibold tracking-wide">Skip</span>
        </button>
      </div>
    </div>
  );
}

export default MicrophoneButton;
