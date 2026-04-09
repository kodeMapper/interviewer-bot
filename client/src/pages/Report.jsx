import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { reportAPI } from '../services/api';

function Report() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAnswers, setExpandedAnswers] = useState({});

  let apiBase = import.meta.env.VITE_API_URL || '/api';
  if (apiBase && !apiBase.endsWith('/api') && !apiBase.endsWith('/api/')) {
    apiBase = apiBase.replace(/\/$/, '') + '/api';
  }

  const buildDownloadUrl = (resourcePath) => {
    const normalizedBase = (apiBase || '/api').replace(/\/$/, '');
    const normalizedPath = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
    return `${normalizedBase}${normalizedPath}`;
  };

  useEffect(() => {
    const loadReport = async () => {
      try {
        const result = await reportAPI.getCombined(sessionId);
        setReport(result.data);
      } catch (err) {
        console.error('Error loading report:', err);
        setError('Failed to load report');
      } finally {
        setIsLoading(false);
      }
    };

    loadReport();
  }, [sessionId]);

  const toggleAnswer = (index) => {
    setExpandedAnswers(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-secondary';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-yellow-400';
    return 'text-error';
  };
  
  const getScoreGrade = (score) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="spinner border-t-secondary w-12 h-12 rounded-full animate-spin border-4 border-surface-container-highest"></div>
        <p className="mt-4 font-label text-xs uppercase tracking-widest text-secondary animate-pulse">Analyzing Telemetry</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="glass-panel p-8 rounded-3xl text-center max-w-md">
          <span className="material-symbols-outlined text-4xl text-error mb-4" style={{fontVariationSettings: "'FILL' 1"}}>error</span>
          <p className="text-on-surface mb-6 font-headline">{error || 'Report not found'}</p>
          <Link to="/" className="px-6 py-2 rounded-full border border-outline-variant hover:bg-surface-variant transition-all font-label text-[10px] uppercase tracking-widest inline-flex items-center">
            Return to Hub
          </Link>
        </div>
      </div>
    );
  }

  const { interview, proctoring } = report;
  const { summary, topicBreakdown, detailedAnswers, username } = interview;

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary/30 pb-12 relative overflow-hidden">
      {/* SideNavBar Shell */}
      <aside className="fixed hidden md:flex left-4 top-24 bottom-4 w-20 rounded-3xl border border-violet-500/15 bg-slate-950/40 backdrop-blur-2xl flex-col items-center py-8 z-40 shadow-2xl shadow-violet-900/20">
        <div className="mb-8 p-3 cursor-pointer" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined text-primary text-3xl font-bold">token</span>
        </div>
        <nav className="flex flex-col items-center flex-1 w-full px-2">
          <div onClick={() => navigate(username ? `/${username}/dashboard` : `/`)} className="flex flex-col items-center justify-center text-slate-500 p-3 mb-2 w-full hover:bg-violet-500/10 hover:text-violet-200 transition-all hover:translate-x-1 duration-300 cursor-pointer">
            <span className="material-symbols-outlined mb-1">dashboard</span>
            <span className="font-['Space_Grotesk'] uppercase tracking-[0.1em] text-[10px]">Dashboard</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-cyan-500/20 text-cyan-400 rounded-xl p-3 mb-2 w-full transition-all duration-300 shadow-[0_0_15px_rgba(0,218,243,0.2)]">
            <span className="material-symbols-outlined mb-1" style={{fontVariationSettings: "'FILL' 1"}}>analytics</span>
            <span className="font-['Space_Grotesk'] uppercase tracking-[0.1em] text-[10px]">Report</span>
          </div>
          <div onClick={() => navigate('/setup')} className="flex flex-col items-center justify-center text-slate-500 p-3 mb-2 w-full hover:bg-violet-500/10 hover:text-violet-200 transition-all hover:translate-x-1 duration-300 cursor-pointer">
            <span className="material-symbols-outlined mb-1">replay</span>
            <span className="font-['Space_Grotesk'] uppercase tracking-[0.1em] text-[10px]">Retry</span>
          </div>
        </nav>
      </aside>

      {/* TopNavBar Shell */}
      <header className="fixed top-0 w-full border-b border-violet-500/15 bg-slate-950/60 backdrop-blur-xl flex justify-between items-center px-4 md:px-8 py-4 z-50">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">SkillWise</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link to={username ? `/${username}/dashboard` : "/"} className="bg-surface-variant/20 border border-outline-variant/30 text-on-surface px-5 py-2 rounded-full font-label tracking-wide text-xs font-semibold transition-all hover:bg-surface-variant/40">
            Exit Report
          </Link>
        </div>
      </header>

      <main className="md:pl-[120px] px-4 md:pr-8 pt-28 pb-12 relative z-10 max-w-[1400px] mx-auto">
        {/* Ambient Lights */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-container/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[150px] pointer-events-none"></div>

        {/* Hero Section */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7">
              <span className="font-label text-secondary tracking-[0.2em] uppercase text-sm mb-4 block">Candidate Performance Overview</span>
              <h1 className="font-headline text-4xl md:text-6xl font-extrabold text-on-surface mb-6 tracking-tight">Interview Evaluation</h1>
              <p className="text-on-surface-variant text-lg max-w-xl leading-relaxed">
                Detailed assessment for <span className="text-white font-semibold">{username || "Candidate"}</span> {interview.sessionName ? <span className="text-primary italic">({interview.sessionName})</span> : ''}. 
                Focusing on technical proficiency across specified skills.
              </p>
            </div>
            
            <div className="lg:col-span-5">
              <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary"></div>
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="font-label text-on-surface-variant uppercase tracking-widest text-xs mb-1">Overall Compatibility</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="font-headline text-6xl font-black text-white">{summary.finalScore}<span className="text-secondary text-3xl font-bold">%</span></span>
                      <span className="font-headline text-2xl font-bold text-primary-fixed-dim">{getScoreGrade(summary.finalScore)}</span>
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-full border-4 border-secondary/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-secondary text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>workspace_premium</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-8">
                  <div className="text-center">
                    <span className="font-label text-on-surface-variant text-[10px] uppercase block mb-1">Duration</span>
                    <span className="font-headline text-lg font-bold">{summary.duration || '-'}m</span>
                  </div>
                  <div className="text-center border-x border-white/5">
                    <span className="font-label text-on-surface-variant text-[10px] uppercase block mb-1">Questions</span>
                    <span className="font-headline text-lg font-bold">{summary.answered} / {summary.answered + summary.skipped}</span>
                  </div>
                  <div className="text-center">
                    <span className="font-label text-on-surface-variant text-[10px] uppercase block mb-1">Status</span>
                    <span className={`font-headline text-lg font-bold uppercase ${summary.finalScore >= 60 ? 'text-secondary' : 'text-error'}`}>
                      {summary.finalScore >= 60 ? 'Pass' : 'Review'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Technical Mastery Bento */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-20">
          <div className="flex items-center justify-between mb-10">
            <h2 className="font-headline text-3xl font-bold tracking-tight">Technical Mastery</h2>
            <div className="h-px flex-grow mx-8 bg-gradient-to-r from-white/10 to-transparent max-w-sm"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {topicBreakdown.map((topic, index) => {
              const bgColors = ['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-on-surface-variant'];
              const glowColors = ['glow-accent-violet', 'glow-accent-cyan', 'glow-accent-violet', 'glow-accent-cyan'];
              const textColors = ['text-primary', 'text-secondary', 'text-tertiary', 'text-on-surface-variant'];
              const icons = ['data_object', 'terminal', 'javascript', 'psychology_alt'];
              
              const colorIdx = index % 4;
              
              return (
                <div key={topic.topic} className="glass-panel p-6 rounded-2xl hover:bg-surface-container-higher/40 transition-all duration-500">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 ${bgColors[colorIdx]}/10 rounded-lg`}>
                      <span className={`material-symbols-outlined ${textColors[colorIdx]}`}>{icons[colorIdx]}</span>
                    </div>
                    <span className="font-headline font-bold text-lg capitalize">{topic.topic.replace('_', ' ')}</span>
                  </div>
                  <div className="relative h-2 w-full bg-surface-container-highest rounded-full mb-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${topic.averageScore}%` }}
                      transition={{ duration: 1, delay: 0.2 + (index * 0.1) }}
                      className={`absolute top-0 left-0 h-full ${bgColors[colorIdx]} ${glowColors[colorIdx]} rounded-full`}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-label text-[10px] text-on-surface-variant uppercase">Proficiency</span>
                    <span className={`font-headline font-bold ${textColors[colorIdx]}`}>{Math.round(topic.averageScore)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Proctoring Timeline (Simplified mapping based on proctoring.total_alerts) */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-20">
          <div className="flex items-center gap-4 mb-10">
            <h2 className="font-headline text-3xl font-bold tracking-tight">Proctoring Telemetry</h2>
            {proctoring?.total_alerts > 0 ? (
              <span className="bg-error-container text-on-error-container px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-widest">
                {proctoring.total_alerts} Flagged Events
              </span>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-widest flex items-center gap-1 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                Clean Session
              </span>
            )}
          </div>
          
          <div className="glass-panel p-8 rounded-3xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center border border-outline-variant/20">
            <div>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                The session was monitored by the AI proctoring system. Video telemetry and alert logs have been preserved for integrity verification and auditing.
              </p>
              
              <div className="flex flex-col gap-3">
                <a 
                  href={buildDownloadUrl('/proctoring/download/video')} 
                  download
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 hover:bg-surface-bright/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary opacity-70 group-hover:opacity-100 transition-opacity">videocam</span>
                    <span className="font-label text-xs uppercase tracking-widest text-on-surface group-hover:text-secondary transition-colors">Session Recording (.mp4)</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant opacity-50 text-sm group-hover:translate-y-1 transition-transform">download</span>
                </a>
                
                <a 
                  href={buildDownloadUrl('/proctoring/download/csv')} 
                  download
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 hover:bg-surface-bright/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary opacity-70 group-hover:opacity-100 transition-opacity">format_list_bulleted</span>
                    <span className="font-label text-xs uppercase tracking-widest text-on-surface group-hover:text-primary transition-colors">Integrity Logs (.csv)</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant opacity-50 text-sm group-hover:translate-y-1 transition-transform">download</span>
                </a>
                
                <a 
                  href={buildDownloadUrl('/proctoring/download/package')} 
                  download
                  className="flex items-center justify-between p-4 rounded-xl border border-white/10 hover:bg-surface-bright/50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary opacity-70 group-hover:opacity-100 transition-opacity">folder_zip</span>
                    <span className="font-label text-xs uppercase tracking-widest text-on-surface group-hover:text-tertiary transition-colors">Violation Images (.zip)</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant opacity-50 text-sm group-hover:translate-y-1 transition-transform">download</span>
                </a>
              </div>
            </div>
            
            {/* Visual aesthetic filler for the proctor timeline concept */}
            <div className="relative h-48 border border-white/5 rounded-2xl overflow-hidden bg-surface-container-low/50 flex items-center justify-center">
               <div className="absolute top-1/2 left-0 w-full h-px bg-white/10"></div>
               {/* Simulating timeline dots based on alerts */}
               <div className="flex justify-between w-[80%] relative z-10">
                  <div className="w-3 h-3 rounded-full bg-secondary/50 glow-accent-cyan shadow-[0_0_15px_#00daf3]"></div>
                  {proctoring?.total_alerts > 0 && <div className="w-3 h-3 rounded-full bg-error glow-accent-error shadow-[0_0_15px_#ff716c] animate-pulse"></div>}
                  <div className="w-3 h-3 rounded-full bg-primary/50 shadow-[0_0_15px_#a68cff]"></div>
               </div>
               <span className="absolute bottom-4 left-4 font-label text-[10px] uppercase text-on-surface-variant tracking-[0.2em]">Live Telemetry Snapshot</span>
            </div>
          </div>
        </motion.section>

        {/* Assessment Details */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-24">
          <h2 className="font-headline text-3xl font-bold tracking-tight mb-10">Assessment Details</h2>
          <div className="space-y-4">
            {detailedAnswers.map((answer, index) => (
              <div key={index} className="glass-panel rounded-2xl overflow-hidden group border border-outline-variant/10">
                <div 
                  className="p-6 flex items-start gap-4 md:gap-6 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleAnswer(index)}
                >
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-headline font-bold shrink-0 text-sm border
                    ${answer.isSkipped ? 'bg-surface-variant/50 text-outline border-outline-variant/30' : 
                      answer.score >= 80 ? 'bg-secondary/10 text-secondary border-secondary/20' : 
                      answer.score >= 50 ? 'bg-primary/10 text-primary border-primary/20' : 
                      'bg-error/10 text-error border-error/20'}`
                  }>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between mb-2 gap-4">
                      <span className="font-label text-[10px] md:text-xs uppercase tracking-widest text-on-surface-variant truncate">
                        {answer.topic.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold whitespace-nowrap
                        ${answer.isSkipped ? 'bg-surface-variant text-outline' : 
                          answer.score >= 80 ? 'bg-secondary/20 text-secondary' : 
                          answer.score >= 50 ? 'bg-primary/20 text-primary' : 
                          'bg-error/20 text-error-dim'}`
                      }>
                        {answer.isSkipped ? 'SKIPPED' : `${answer.score}% SCORE`}
                      </span>
                    </div>
                    
                    <h4 className="font-headline text-lg md:text-xl font-bold mb-2">{answer.question}</h4>
                    
                    <AnimatePresence>
                      {expandedAnswers[index] && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          {!answer.isSkipped && (
                            <>
                              <div className="mt-4 mb-4">
                                <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest block mb-2">Candidate Response</span>
                                <p className="text-on-surface text-sm leading-relaxed border-l-2 border-primary/30 pl-4 py-1">
                                  {answer.userAnswer}
                                </p>
                              </div>
                              {answer.expectedAnswer && (
                                <div className="mt-4 mb-4">
                                  <span className="font-label text-[10px] text-secondary uppercase tracking-widest block mb-2">Expected Answer</span>
                                  <p className="text-on-surface-variant text-sm leading-relaxed border-l-2 border-secondary/40 pl-4 py-1 whitespace-pre-line">
                                    {answer.expectedAnswer}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                          
                          <div className="bg-surface-container-low/50 p-4 md:p-6 rounded-xl border border-white/5 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="material-symbols-outlined text-primary text-sm" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
                              <span className="font-label text-[10px] md:text-xs uppercase text-primary font-bold tracking-wider">AI Evaluation</span>
                            </div>
                            <p className="text-secondary-fixed-dim/90 leading-relaxed italic text-sm md:text-base">
                              {answer.isSkipped 
                                ? "Candidate chose to skip this question. No evaluation performed." 
                                : (answer.feedback || "AI evaluation recorded.")}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <div className={`shrink-0 pt-2 transition-transform duration-300 ${expandedAnswers[index] ? 'rotate-180 text-primary' : 'text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined">expand_more</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </main>

      {/* Footer */}
      <footer className="md:pl-[120px] px-4 pb-12 w-full max-w-[1520px] mx-auto">
        <div className="glass-panel p-6 md:p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5 bg-surface-container-lowest/40 backdrop-blur-3xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-2xl">
              <span className="material-symbols-outlined text-secondary" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
            </div>
            <div>
              <p className="font-headline font-bold text-on-surface">SkillWise Verifiable Report</p>
              <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">ID: SW-{sessionId.substring(0,6).toUpperCase()}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <button onClick={() => window.print()} className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-surface-container-highest border border-white/10 hover:bg-surface-bright transition-all font-label text-[10px] uppercase tracking-widest group">
              <span className="material-symbols-outlined text-sm group-hover:-translate-y-0.5 transition-transform">download</span>
              Save PDF
            </button>
            <Link to="/setup" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-full border border-secondary/30 text-secondary hover:bg-secondary/10 transition-all font-label text-[10px] uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm">replay</span>
              Practice Again
            </Link>
            <Link to={username ? `/${username}/dashboard` : "/"} className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-primary-container to-primary text-on-primary-container hover:scale-[1.02] active:scale-95 transition-all font-label text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20">
              <span className="material-symbols-outlined text-sm">reply</span>
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Report;
