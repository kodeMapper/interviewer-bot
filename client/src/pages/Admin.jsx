import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { sessionsAPI } from '../services/api';

function Admin() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        sessionsAPI.getAll(),
        sessionsAPI.getStats()
      ]);
      const sessionsData = sessionsRes.data?.sessions || [];
      setSessions(sessionsData);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('Failed to load telemetry payload');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getScoreColor = (score) => {
    if (score == null) return 'text-outline-variant';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-tertiary';
    return 'text-error';
  };

  const filteredSessions = sessions.filter(session => {
    const searchStr = searchTerm.toLowerCase();
    return (
      (session.username || '').toLowerCase().includes(searchStr) ||
      (session.candidateName || '').toLowerCase().includes(searchStr) ||
      (session.id || '').toLowerCase().includes(searchStr)
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="spinner border-t-primary w-12 h-12 rounded-full animate-spin border-4 border-surface-container-highest"></div>
        <p className="mt-4 font-label text-xs uppercase tracking-widest text-primary animate-pulse">Syncing Command Layer</p>
      </div>
    );
  }

  const flaggedCount = sessions.filter(s => s.state === 'FINISHED' && s.finalScore < 50).length;

  return (
    <div className="min-h-screen bg-background text-on-surface font-body overflow-x-hidden pb-12 relative">
      {/* Ambient Glows */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary-container/10 rounded-full blur-[150px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Admin Navbar */}
      <header className="sticky top-0 w-full backdrop-blur-2xl bg-surface-dim/80 border-b border-white/5 py-4 px-8 flex justify-between items-center z-50 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(166,140,255,0.3)] cursor-pointer" onClick={() => navigate('/')}>
             <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
          </div>
          <div>
            <h1 className="font-headline text-xl font-bold tracking-wide">Command Center</h1>
            <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Global Telemetry Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="px-5 py-2.5 rounded-full bg-surface-container hover:bg-white/10 border border-white/10 transition-all flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-on-surface-variant group">
            <span className="material-symbols-outlined text-[16px]">home</span>
            Home
          </button>
          <button onClick={loadData} className="px-6 py-2.5 rounded-full bg-surface-container hover:bg-white/10 border border-white/10 transition-all flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-white shadow-lg group">
            <span className="material-symbols-outlined text-[16px] group-hover:rotate-180 transition-transform duration-500">sync</span>
            Sync Data
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-8 pt-10 z-10 relative">
        {error && (
          <div className="mb-8 p-4 bg-error/10 border border-error/30 rounded-xl text-error font-body flex items-center gap-3">
            <span className="material-symbols-outlined">warning</span>
            {error}
          </div>
        )}

        {/* Global Stats Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {/* Main Stat Focus */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-2 glass-panel p-8 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-bl-full -mr-20 -mt-20 group-hover:bg-primary/20 transition-colors blur-xl pointer-events-none"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-full border border-primary/20 shadow-[0_0_15px_rgba(166,140,255,0.2)]">
                <span className="material-symbols-outlined text-primary text-[24px]">groups</span>
              </div>
              <h3 className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">Global Candidates</h3>
            </div>
            <div className="flex items-end gap-4">
              <p className="font-headline text-6xl md:text-7xl font-extrabold text-white tracking-tighter">
                {stats?.summary?.totalSessions || sessions.length}
              </p>
              <div className="mb-2 px-3 py-1 rounded-full bg-surface-container border border-white/5 text-xs text-primary font-mono tracking-wider">
                Total Logs
              </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/50 to-transparent"></div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <span className="material-symbols-outlined text-emerald-400 text-[18px]">equalizer</span>
              </div>
              <h3 className="font-label text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">Avg Score</h3>
            </div>
            <p className="font-headline text-4xl font-extrabold text-emerald-400">
              {stats?.summary?.avgScore || 0}%
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
            <div className={`absolute inset-0 border-2 rounded-2xl pointer-events-none transition-colors ${flaggedCount > 0 ? 'border-error/20 bg-error/5 group-hover:bg-error/10' : 'border-transparent'}`}></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2 bg-error/10 rounded-full border border-error/20">
                <span className="material-symbols-outlined text-error text-[18px]">policy</span>
              </div>
              <h3 className="font-label text-[10px] uppercase tracking-[0.1em] text-error">Flags Detected</h3>
            </div>
            <p className="font-headline text-4xl font-extrabold text-error relative z-10">
              {flaggedCount}
            </p>
          </motion.div>
        </div>

        {/* Sessions Filter / Grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-container-low/50">
            <div className="flex items-center gap-4">
               <h3 className="font-headline text-xl font-bold text-white tracking-wide">Secure Telemetry Logs</h3>
               <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-mono text-outline-variant">{filteredSessions.length} records</span>
            </div>
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search Identity or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container-lowest/50 border border-white/10 rounded-full pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-secondary focus:bg-white/5 transition-all font-body placeholder:opacity-30"
              />
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low border-b border-white/5">
                  <th className="py-4 px-6 text-[10px] font-label font-bold tracking-[0.15em] text-outline-variant uppercase">Identity</th>
                  <th className="py-4 px-6 text-[10px] font-label font-bold tracking-[0.15em] text-outline-variant uppercase">Alias</th>
                  <th className="py-4 px-6 text-[10px] font-label font-bold tracking-[0.15em] text-outline-variant uppercase">Domain Matrix</th>
                  <th className="py-4 px-6 text-[10px] font-label font-bold tracking-[0.15em] text-outline-variant uppercase">Lifecycle</th>
                  <th className="py-4 px-6 text-[10px] font-label font-bold tracking-[0.15em] text-outline-variant uppercase">Eval Score</th>
                  <th className="py-4 px-6 text-[10px] font-label font-bold tracking-[0.15em] text-outline-variant uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSessions.map((session) => (
                  <tr key={session.id || session._id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-5 px-6">
                      <div className="flex gap-3 items-center">
                        <div className="w-8 h-8 rounded-full bg-surface-container-high border border-white/10 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-[16px] text-outline">person</span>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm group-hover:text-secondary transition-colors">{session.candidateName || 'Unknown Host'}</p>
                          <p className="text-[10px] font-mono text-outline-variant">{new Date(session.startedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className="px-3 py-1 bg-surface-container rounded-full text-xs font-mono text-primary/80 border border-primary/20">
                        @{session.username || 'guest'}
                      </span>
                    </td>
                    <td className="py-5 px-6">
                       <p className="text-on-surface-variant text-xs line-clamp-2 max-w-[200px]">
                        {session.skills?.join(' • ') || 'N/A'}
                       </p>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${
                          session.state === 'FINISHED' ? 'bg-emerald-500' : 'bg-primary animate-pulse'
                        }`} />
                        <span className={`text-xs font-label uppercase tracking-widest ${session.state === 'FINISHED' ? 'text-emerald-400' : 'text-primary'}`}>
                          {session.state}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <span className={`font-mono font-bold text-sm bg-surface-container-highest px-3 py-1 rounded-md border border-white/5 ${getScoreColor(session.finalScore)}`}>
                        {session.finalScore !== undefined ? `${session.finalScore}%` : '--'}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <button
                        onClick={() => navigate(`/report/${session.id || session._id}`)}
                        className="px-5 py-2 hover:bg-secondary/10 hover:text-secondary rounded-full transition-colors text-white font-label text-[10px] uppercase tracking-widest border border-white/10 hover:border-secondary/30 flex items-center justify-center gap-2 ml-auto group-hover:shadow-[0_0_15px_rgba(0,218,243,0.3)]"
                      >
                        Extract Report
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-outline-variant/30">search_off</span>
                        <p className="text-outline-variant text-sm tracking-wide">No telemetry records match your parameters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default Admin;
