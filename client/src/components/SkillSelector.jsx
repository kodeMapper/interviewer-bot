import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const AVAILABLE_SKILLS = [
  'Java',
  'Python', 
  'JavaScript',
  'React',
  'SQL',
  'Machine_Learning',
  'Deep_Learning'
];

function SkillSelector({ selectedSkills, onSkillsChange }) {
  const toggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) {
      onSkillsChange(selectedSkills.filter(s => s !== skill));
    } else {
      onSkillsChange([...selectedSkills, skill]);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-medium text-white mb-4">Select Skills to Test</h3>
      <p className="text-secondary-400 text-sm mb-4">
        Choose the topics you want to be interviewed on. Select at least one.
      </p>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {AVAILABLE_SKILLS.map((skill) => {
          const isSelected = selectedSkills.includes(skill);
          return (
            <motion.button
              key={skill}
              onClick={() => toggleSkill(skill)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-500/20'
                  : 'border-secondary-600 bg-secondary-800/50 hover:border-secondary-500'
              }`}
            >
              {/* Check mark */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2"
                >
                  <Check className="w-4 h-4 text-primary-400" />
                </motion.div>
              )}
              
              <span className={`font-medium ${
                isSelected ? 'text-primary-400' : 'text-secondary-300'
              }`}>
                {skill.replace('_', ' ')}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default SkillSelector;
