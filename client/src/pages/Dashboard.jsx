import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { sessionsAPI } from '../services/api';

function Dashboard() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, sessionsRes] = await Promise.all([
        sessionsAPI.getStats(),
        sessionsAPI.getByUsername(username)
      ]);
      setStats(statsRes.data);
      setSessions(sessionsRes.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    try {
      await sessionsAPI.delete(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const COLORS = ['#a68cff', '#00daf3', '#ff9cb2', '#ff716c', '#004750'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="spinner border-t-primary w-12 h-12 rounded-full animate-spin border-4 border-surface-container-highest"></div>
        <p className="mt-4 font-label text-xs uppercase tracking-widest text-primary animate-pulse">Initializing Data Core</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="glass-panel p-8 rounded-3xl text-center max-w-md">
          <span className="material-symbols-outlined text-4xl text-error mb-4" style={{fontVariationSettings: "'FILL' 1"}}>error</span>
          <p className="text-on-surface mb-6 font-headline">{error}</p>
          <button onClick={loadData} className="px-6 py-2 rounded-full border border-outline-variant hover:bg-surface-variant transition-all font-label text-[10px] uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm align-middle mr-2">refresh</span>
            Reboot Interface
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary/30 pb-12 relative overflow-hidden">
      {/* Ambient Light Leaks */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-secondary/10 blur-[120px]"></div>
      </div>

      {/* SideNavBar Shell */}
      <aside className="fixed hidden md:flex left-4 top-24 bottom-4 w-20 rounded-3xl border border-violet-500/15 bg-slate-950/40 backdrop-blur-2xl flex-col items-center py-8 z-40 shadow-2xl shadow-violet-900/20">
        <div className="mb-8 p-3 cursor-pointer" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined text-primary text-3xl font-bold">token</span>
        </div>
        <nav className="flex flex-col items-center flex-1 w-full px-2">
          {/* Dashboard Active */}
          <div className="flex flex-col items-center justify-center bg-cyan-500/20 text-cyan-400 rounded-xl p-3 mb-2 w-full transition-all duration-300">
            <span className="material-symbols-outlined mb-1" style={{fontVariationSettings: "'FILL' 1"}}>dashboard</span>
            <span className="font-['Space_Grotesk'] uppercase tracking-[0.1em] text-[10px]">Dashboard</span>
          </div>
          <div onClick={() => navigate('/setup')} className="flex flex-col items-center justify-center text-slate-500 p-3 mb-2 w-full hover:bg-violet-500/10 hover:text-violet-200 transition-all hover:translate-x-1 duration-300 cursor-pointer">
            <span className="material-symbols-outlined mb-1">video_chat</span>
            <span className="font-['Space_Grotesk'] uppercase tracking-[0.1em] text-[10px]">New</span>
          </div>
        </nav>
        <div className="mt-auto flex flex-col items-center w-full px-2">
          <div onClick={() => navigate('/')} className="flex flex-col items-center justify-center text-slate-500 p-3 w-full hover:bg-violet-500/10 hover:text-violet-200 transition-all cursor-pointer">
            <span className="material-symbols-outlined mb-1">home</span>
            <span className="font-['Space_Grotesk'] uppercase tracking-[0.1em] text-[10px]">Home</span>
          </div>
        </div>
      </aside>

      {/* TopNavBar Shell */}
      <header className="fixed top-0 w-full border-b border-violet-500/15 bg-slate-950/60 backdrop-blur-xl flex justify-between items-center px-4 md:px-8 py-4 z-50 shadow-[0_0_40px_rgba(124,77,255,0.08)]">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">SkillWise</Link>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-surface-variant/20 border border-outline-variant/30 text-on-surface px-5 py-2 rounded-full font-label tracking-wide text-xs font-semibold transition-all hover:bg-surface-variant/40" onClick={loadData}>
            <span className="material-symbols-outlined text-[14px] align-middle mr-1">refresh</span>Sync
          </button>
          <Link to="/setup" className="bg-gradient-to-r from-primary-container to-primary text-on-primary-container px-5 py-2 rounded-full font-label tracking-wider text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">New Session</Link>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="md:pl-[120px] px-4 md:pr-8 pt-28 pb-12 relative z-10 max-w-[1600px] mx-auto">
        {/* Header Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl md:text-5xl font-headline font-extrabold text-on-surface mb-2" style={{textShadow: "0 0 15px rgba(166, 140, 255, 0.3)"}}>Candidate Intelligence Hub</h1>
          <p className="text-on-surface-variant font-body">Predictive performance analysis for <span className="text-secondary font-semibold">{username}</span></p>
        </motion.div>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6 rounded-2xl flex flex-col gap-1 relative overflow-hidden group border border-outline-variant/20 bg-surface-container/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-primary/20 transition-colors"></div>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant z-10">Total Sessions</span>
            <div className="flex items-baseline gap-2 z-10">
              <span className="text-4xl font-headline font-bold text-on-surface">{stats?.summary?.totalSessions || 0}</span>
              <span className="text-xs text-secondary font-medium tracking-wide">Recorded</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-6 rounded-2xl flex flex-col gap-1 relative overflow-hidden group border border-outline-variant/20 bg-surface-container/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-secondary/20 transition-colors"></div>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant z-10">Avg Score</span>
            <div className="flex items-baseline gap-2 z-10">
              <span className="text-4xl font-headline font-bold text-on-surface">{stats?.summary?.avgScore || 0}%</span>
              <span className="text-xs text-primary font-medium tracking-wide">Global</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-6 rounded-2xl flex flex-col gap-1 relative overflow-hidden group border border-outline-variant/20 bg-surface-container/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-tertiary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-tertiary/20 transition-colors"></div>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant z-10">Completion Rate</span>
            <div className="flex items-baseline gap-2 z-10">
              <span className="text-4xl font-headline font-bold text-secondary">{stats?.summary?.completionRate || 0}%</span>
              <span className="text-xs text-on-surface-variant font-medium tracking-wide">Success</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-panel p-6 rounded-2xl flex flex-col gap-1 relative overflow-hidden group border border-outline-variant/20 bg-surface-container/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-emerald-500/20 transition-colors"></div>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant z-10">Proctoring %</span>
            <div className="flex items-baseline gap-2 z-10">
              <span className="text-4xl font-headline font-bold text-on-surface">100%</span>
              <span className="text-xs text-emerald-400 font-medium tracking-wide drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">High Integrity</span>
            </div>
          </motion.div>
        </section>

        {/* Charts & Mastery Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 mb-12">
          {/* Top Skills Chart */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2 glass-panel p-6 xl:p-8 rounded-2xl min-h-[400px] flex flex-col border border-outline-variant/20 bg-surface-container/20">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-headline font-bold text-on-surface">Top Skills Tested</h3>
              <div className="flex gap-2 hidden md:flex">
                <span className="px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-label uppercase tracking-widest">Global Data</span>
              </div>
            </div>
            <div className="flex-1 w-full relative">
              {stats?.topSkills?.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={stats.topSkills} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="skill" 
                      tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Space Grotesk', textTransform: 'uppercase' }}
                      axisLine={{ stroke: '#262626' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#adaaaa', fontSize: 10, fontFamily: 'Space Grotesk' }}
                      axisLine={{ stroke: '#262626' }}
                      tickLine={false}
                    />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.02)'}}
                      contentStyle={{ 
                        background: 'rgba(32, 31, 31, 0.9)', 
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(200, 183, 255, 0.15)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        fontFamily: 'Inter'
                      }}
                      itemStyle={{ color: '#00daf3', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" fill="url(#colorBar)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a68cff" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#7c4dff" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center border border-dashed border-outline-variant/30 rounded-xl">
                  <p className="font-label uppercase tracking-widest text-xs text-on-surface-variant">Insufficient telemetry data</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* State Distribution Pie */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} className="glass-panel p-6 xl:p-8 rounded-2xl flex flex-col border border-outline-variant/20 bg-surface-container/20">
            <h3 className="text-xl font-headline font-bold text-on-surface mb-8">Session States</h3>
            <div className="flex-1 w-full relative min-h-[300px]">
              {stats?.stateDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.stateDistribution}
                      dataKey="count"
                      nameKey="state"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={70}
                      paddingAngle={5}
                      stroke="none"
                    >
                      {stats.stateDistribution.map((entry, index) => (
                        <Cell key={entry.state} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(32, 31, 31, 0.9)', 
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(200, 183, 255, 0.15)',
                        borderRadius: '12px',
                        fontFamily: 'Inter'
                      }}
                      itemStyle={{ fill: '#e8e5e4' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center border border-dashed border-outline-variant/30 rounded-xl">
                  <p className="font-label uppercase tracking-widest text-xs text-on-surface-variant">No session data</p>
                </div>
              )}
            </div>
            
            {/* Custom Legend */}
            {stats?.stateDistribution?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3 justify-center">
                {stats.stateDistribution.map((entry, index) => (
                  <div key={entry.state} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full leading-none" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                    <span className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant" style={{opacity: 0.8}}>{entry.state}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </section>

        {/* Recent Sessions Table */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container/20">
          <div className="p-6 md:p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>history</span>
              Recent Activity
            </h3>
            <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Session Log Archive</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high/30">
                  <th className="px-6 md:px-8 py-4 text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant font-semibold">Date</th>
                  <th className="px-6 md:px-8 py-4 text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant font-semibold">Session Name</th>
                  <th className="px-6 md:px-8 py-4 text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant font-semibold">Topics Evaluated</th>
                  <th className="px-6 md:px-8 py-4 text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant font-semibold">Score</th>
                  <th className="px-6 md:px-8 py-4 text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant font-semibold">Proctor Status</th>
                  <th className="px-6 md:px-8 py-4 text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 md:px-8 py-5 text-sm text-on-surface font-medium whitespace-nowrap">
                        {new Date(session.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 md:px-8 py-5">
                        <span className="text-on-surface font-bold text-sm">{session.sessionName || 'Untitled Session'}</span>
                        {session.candidateName && session.candidateName !== 'Candidate' && (
                          <span className="block text-[10px] text-on-surface-variant opacity-60 font-label uppercase tracking-tighter mt-0.5">{session.candidateName}</span>
                        )}
                      </td>
                      <td className="px-6 md:px-8 py-5">
                        <div className="flex flex-wrap gap-2">
                          {session.skills?.slice(0,3).map(skill => (
                            <span key={skill} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold border border-primary/20 uppercase tracking-wide whitespace-nowrap">
                              {skill}
                            </span>
                          ))}
                          {session.skills?.length > 3 && (
                            <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-[10px] font-bold border border-outline-variant/30 uppercase tracking-wide">
                              +{session.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 md:px-8 py-5">
                        {session.finalScore !== undefined ? (
                          <span className={`text-sm font-bold ${session.finalScore >= 70 ? 'text-secondary' : 'text-on-surface'}`}>
                            {session.finalScore}/100
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-on-surface-variant opacity-50">Pending</span>
                        )}
                      </td>
                      <td className="px-6 md:px-8 py-5">
                        {session.state === 'FINISHED' ? (
                          <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold tracking-widest drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            PASS
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-yellow-400 text-[10px] font-bold tracking-widest drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                            {session.state.substring(0, 4)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 md:px-8 py-5 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/report/${session.id}`)}
                          className="p-1.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors"
                          title="View Intelligence Report"
                        >
                          <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteSession(session.id)}
                          className="p-1.5 rounded-full hover:bg-error/10 text-outline hover:text-error transition-colors"
                          title="Delete Record"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-on-surface-variant font-label text-xs uppercase tracking-widest opacity-60">
                      No interview telemetry detected
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-black/20 text-center border-t border-white/5">
            <Link to="/setup" className="text-[10px] font-label uppercase tracking-widest text-primary hover:text-primary-fixed transition-colors">Start New Assessment</Link>
          </div>
        </motion.section>
      </main>

      {/* Floating Action Drop */}
      <Link to="/setup" className="fixed bottom-6 md:bottom-8 right-6 md:right-8 flex items-center gap-3 bg-gradient-to-r from-secondary-dim to-secondary text-on-secondary-fixed px-6 py-3.5 rounded-full font-label uppercase tracking-wider text-xs font-bold shadow-2xl shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined font-bold text-lg" style={{fontVariationSettings: "'FILL' 1"}}>bolt</span>
        <span>Start Interview</span>
      </Link>
    </div>
  );
}

export default Dashboard;
