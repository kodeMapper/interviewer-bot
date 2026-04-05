import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { SkillSelector, ResumeUpload } from '../components';
import PreCheck from '../components/setup/PreCheck';
import { interviewAPI, resumeAPI } from '../services/api';

function Setup() {
  const navigate = useNavigate();
  const [selectedSkills, setSelectedSkills] = useState(() => JSON.parse(sessionStorage.getItem('setup_skills') || '[]'));
  const [username, setUsername] = useState(() => sessionStorage.getItem('setup_username') || '');
  const [candidateName, setCandidateName] = useState(() => sessionStorage.getItem('setup_candidateName') || '');
  const [sessionName, setSessionName] = useState(() => sessionStorage.getItem('setup_sessionName') || '');
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('setup_sessionId') || null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadResult, setUploadResult] = useState(() => JSON.parse(sessionStorage.getItem('setup_uploadResult') || 'null'));
  const [uploadError, setUploadError] = useState(null);
  const [step, setStep] = useState(() => Number(sessionStorage.getItem('setup_step')) || 1); // 1: Skills, 2: Resume, 3: Pre-Check

  useEffect(() => {
    sessionStorage.setItem('setup_step', step);
    if (sessionId) sessionStorage.setItem('setup_sessionId', sessionId);
    sessionStorage.setItem('setup_username', username);
    sessionStorage.setItem('setup_candidateName', candidateName);
    sessionStorage.setItem('setup_sessionName', sessionName);
    sessionStorage.setItem('setup_skills', JSON.stringify(selectedSkills));
    if (uploadResult) sessionStorage.setItem('setup_uploadResult', JSON.stringify(uploadResult));
  }, [step, sessionId, username, candidateName, sessionName, selectedSkills, uploadResult]);

  // Clean sessionStorage when navigating away to a different main flow, optional but good prep
  // We won't clear it immediately to ensure refresh keeps it.


  const handleStartSession = async () => {
    if (selectedSkills.length === 0) {
      alert('Please select at least one skill');
      return;
    }
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    setIsCreatingSession(true);
    try {
      const result = await interviewAPI.startSession(selectedSkills, null, username, candidateName, sessionName);
      setSessionId(result.data.sessionId);
      setStep(2);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleResumeUpload = async (file) => {
    if (!sessionId) return;

    setIsUploadingResume(true);
    setUploadError(null);
    try {
      const result = await resumeAPI.upload(file, sessionId);
      setUploadResult(result.data);
      if (result.data.skillsDetected) {
        setSelectedSkills([...new Set([...selectedSkills, ...result.data.skillsDetected])]);
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      setUploadError('Failed to process resume. Please try again.');
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleStartInterview = () => {
    if (sessionId) {
      setStep(3);
    }
  };

  return (
    <div className="bg-background min-h-screen text-on-surface font-body overflow-x-hidden relative flex">
      {/* Background Ambience */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] radial-glow opacity-60 pointer-events-none"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] radial-glow opacity-30 pointer-events-none"></div>

      {/* Sidebar layout for larger screens */}
      <div className="w-80 border-r border-white/5 p-8 flex flex-col justify-between relative z-10 shrink-0 hidden lg:flex bg-surface-container-lowest">
        <div>
          <div className="text-2xl font-black tracking-tighter text-on-surface font-headline mb-16 flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <span className="material-symbols-outlined text-primary">arrow_back</span>
            SkillWise
          </div>

          <div className="space-y-8">
            <div className="opacity-60 mb-2">
              <span className="font-label text-xs tracking-widest text-primary mb-2 block uppercase">Initialization</span>
              <h3 className="font-headline font-bold text-lg">System Boot</h3>
            </div>
            
            <div className={`relative pl-4 border-l-2 transition-colors ${step === 1 ? 'border-primary' : 'border-white/10 opacity-50'}`}>
              <h4 className="font-label tracking-widest uppercase text-xs mb-1">Module 01</h4>
              <p className="font-body font-medium">Domain Selection</p>
            </div>

            <div className={`relative pl-4 border-l-2 transition-colors ${step === 2 ? 'border-primary' : 'border-white/10 opacity-50'}`}>
              <h4 className="font-label tracking-widest uppercase text-xs mb-1">Module 02</h4>
              <p className="font-body font-medium">Context Upload (Resume)</p>
            </div>

            <div className={`relative pl-4 border-l-2 transition-colors ${step === 3 ? 'border-primary' : 'border-white/10 opacity-50'}`}>
              <h4 className="font-label tracking-widest uppercase text-xs mb-1">Module 03</h4>
              <p className="font-body font-medium">Environment Check</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-white/5">
          <div className="flex gap-3 items-center mb-3">
             <span className="material-symbols-outlined text-secondary text-lg">shield_locked</span>
             <span className="font-label text-xs uppercase tracking-widest text-on-surface-variant">Proctor Status</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
             <div className="w-full h-full bg-secondary opacity-50"></div>
          </div>
          <p className="text-[10px] text-on-surface-variant font-mono mt-2 opacity-60">P-System: Ready</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-12 lg:p-20 relative z-10 overflow-y-auto max-h-screen">
        <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.5 }}
           className="max-w-5xl mx-auto"
        >
          {/* Mobile Back Button (Visible only on small screens) */}
          <div className="lg:hidden flex items-center gap-2 mb-8 cursor-pointer text-primary" onClick={() => navigate('/')}>
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-headline font-bold">Back to SkillWise</span>
          </div>

          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h1 className="font-headline text-4xl md:text-5xl font-extrabold mb-4 text-glow">What expertise <br/><span className="text-primary-fixed">are we evaluating?</span></h1>
                <p className="text-on-surface-variant font-body text-lg">Select the core technical domains for this session or let the model suggest based on your resume later.</p>
              </div>

              <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2 font-headline">
                    <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                    Candidate Identity Profile
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-on-surface-variant text-xs font-label uppercase tracking-widest mb-2">Username (Required)</label>
                      <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. johndoe99"
                        className="w-full bg-surface-container-lowest/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:bg-white/5 transition-all font-body placeholder:opacity-30"
                      />
                    </div>
                    <div>
                      <label className="block text-on-surface-variant text-xs font-label uppercase tracking-widest mb-2">Display Name (Optional)</label>
                      <input 
                        type="text" 
                        value={candidateName}
                        onChange={(e) => setCandidateName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full bg-surface-container-lowest/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:bg-white/5 transition-all font-body placeholder:opacity-30"
                      />
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-on-surface-variant text-xs font-label uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[16px]">badge</span>
                      Session Label (Optional)
                    </label>
                    <input 
                      type="text" 
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="e.g. JPMC Mock Interview, Verroc Practice, DL Viva Prep"
                      className="w-full bg-surface-container-lowest/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:bg-white/5 transition-all font-body placeholder:opacity-30"
                    />
                    <p className="text-on-surface-variant/50 text-[11px] mt-2 font-label">Label this session so you can identify it later on your dashboard.</p>
                  </div>
                </div>

                <div className="h-px bg-white/5 w-full my-6"></div>

                <SkillSelector 
                  selectedSkills={selectedSkills}
                  onSkillsChange={setSelectedSkills}
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleStartSession}
                  disabled={selectedSkills.length === 0 || !username.trim() || isCreatingSession}
                  className="bg-primary text-on-primary px-10 py-4 rounded-full font-bold flex items-center gap-3 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_30px_rgba(166,140,255,0.2)]"
                >
                  {isCreatingSession ? 'Initializing Session...' : 'Initialize Module 02'}
                  {!isCreatingSession && <span className="material-symbols-outlined">arrow_forward</span>}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 flex flex-col items-center">
              <div className="text-center mb-6 max-w-2xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-tight text-on-surface mb-4 text-glow">
                  The <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-fixed to-secondary-fixed">Source</span> Material
                </h1>
                <p className="text-on-surface-variant text-lg font-body leading-relaxed">
                  SkillWise AI extracts technical depth and behavioral markers directly from your resume to calibrate the session.
                </p>
              </div>

              <ResumeUpload
                onUpload={handleResumeUpload}
                isUploading={isUploadingResume}
                uploadResult={uploadResult}
                error={uploadError}
              />

              <div className="flex justify-between items-center mt-12 pt-6 border-t border-white/5 w-full">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-full text-on-surface-variant font-label text-xs uppercase tracking-widest hover:text-white transition-colors font-semibold flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Back
                </button>
                <div className="h-10 w-[1px] bg-outline-variant/30 hidden md:block"></div>
                <button
                  onClick={handleStartInterview}
                  className="group relative px-10 py-4 bg-transparent overflow-hidden rounded-full shadow-[0_0_30px_rgba(166,140,255,0.2)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-container to-primary opacity-90 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute inset-0 border border-white/20 rounded-full"></div>
                  <span className="relative z-10 font-label text-xs uppercase tracking-[0.2em] font-bold text-on-primary-container flex items-center gap-3">
                    Initialize Phase 3
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8">
               <div>
                  <h1 className="font-headline text-4xl md:text-5xl font-extrabold mb-4 text-glow text-error-container">Environment Lockdown</h1>
                  <p className="text-on-surface-variant font-body text-lg">Verifying microphone, camera hardware, and proctoring spatial boundaries.</p>
               </div>
               {/* Wrapped PreCheck to maintain its intrinsic styling but fit within the new shell layout */}
               <div className="glass-panel rounded-3xl p-2 md:p-6 pb-0">
                  <PreCheck 
                    sessionId={sessionId}
                    onComplete={() => navigate(`/interview/${sessionId}`)}
                  />
               </div>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}

export default Setup;
