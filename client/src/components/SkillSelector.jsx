import { useState } from 'react';

const AVAILABLE_SKILLS = [
  { id: 'Java', label: 'Java Architecture', icon: 'coffee' },
  { id: 'Python', label: 'Python Systems', icon: 'terminal' },
  { id: 'JavaScript', label: 'JavaScript Ecosystem', icon: 'javascript' },
  { id: 'React', label: 'React Interfaces', icon: 'code_blocks' },
  { id: 'SQL', label: 'Relational Data', icon: 'database' },
  { id: 'Machine_Learning', label: 'Machine Learning', icon: 'memory' },
  { id: 'Deep_Learning', label: 'Neural Networks', icon: 'schema' }
];

function SkillSelector({ selectedSkills, onSkillsChange }) {
  const toggleSkill = (skillId) => {
    if (selectedSkills.includes(skillId)) {
      onSkillsChange(selectedSkills.filter(s => s !== skillId));
    } else {
      onSkillsChange([...selectedSkills, skillId]);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2 font-headline mt-8">
        <span className="material-symbols-outlined text-secondary text-[20px]">dataset</span>
        Target Domains
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {AVAILABLE_SKILLS.map((skill) => {
          const isSelected = selectedSkills.includes(skill.id);
          return (
            <div 
              key={skill.id}
              onClick={() => toggleSkill(skill.id)}
              className={`glass-card rounded-2xl p-4 cursor-pointer relative overflow-hidden group ${isSelected ? 'glow-active' : ''}`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                </div>
              )}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${isSelected ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-white/5 border border-white/5 group-hover:bg-white/10'}`}>
                <span className="material-symbols-outlined">{skill.icon}</span>
              </div>
              <h4 className="font-headline font-semibold text-sm mb-1">{skill.label}</h4>
              <p className="text-[10px] uppercase tracking-widest font-label text-on-surface-variant/60">{skill.id}</p>
            </div>
          );
        })}
        
        {/* Custom Input Block */}
        <div className="col-span-2 md:col-span-1 rounded-2xl border border-dashed border-white/20 p-4 flex flex-col items-center justify-center opacity-60 hover:opacity-100 hover:border-primary/50 transition-all cursor-pointer bg-white/5">
           <span className="material-symbols-outlined mb-2 text-primary">add</span>
           <span className="font-label text-xs uppercase tracking-widest">Custom Domain</span>
        </div>
      </div>
    </div>
  );
}

export default SkillSelector;
