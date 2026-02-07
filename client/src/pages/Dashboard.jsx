import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BarChart3, Users, TrendingUp, Clock, 
  ChevronRight, Trash2, RefreshCw 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { sessionsAPI } from '../services/api';

function Dashboard() {
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
        sessionsAPI.getAll(1, 10)
      ]);
      setStats(statsRes.data);
      setSessions(sessionsRes.data.sessions);
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

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={loadData} className="btn-primary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-primary-400" />
            <span className="text-secondary-400">Total Sessions</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {stats?.summary?.totalSessions || 0}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-secondary-400">Completion Rate</span>
          </div>
          <p className="text-3xl font-bold text-green-400">
            {stats?.summary?.completionRate || 0}%
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <span className="text-secondary-400">Avg Score</span>
          </div>
          <p className={`text-3xl font-bold ${getScoreColor(stats?.summary?.avgScore)}`}>
            {stats?.summary?.avgScore || 0}%
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-secondary-400">Avg Questions</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {stats?.summary?.avgQuestionsAsked || 0}
          </p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Top Skills */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <h3 className="text-lg font-medium text-white mb-4">Top Skills Tested</h3>
          {stats?.topSkills?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.topSkills}>
                <XAxis 
                  dataKey="skill" 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#475569' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: '#1e293b', 
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-secondary-400 text-center py-8">No data yet</p>
          )}
        </motion.div>

        {/* State Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <h3 className="text-lg font-medium text-white mb-4">Session States</h3>
          {stats?.stateDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats.stateDistribution}
                  dataKey="count"
                  nameKey="state"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ state, count }) => `${state}: ${count}`}
                >
                  {stats.stateDistribution.map((entry, index) => (
                    <Cell key={entry.state} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: '#1e293b', 
                    border: '1px solid #475569',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-secondary-400 text-center py-8">No data yet</p>
          )}
        </motion.div>
      </div>

      {/* Recent Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card"
      >
        <h3 className="text-lg font-medium text-white mb-4">Recent Sessions</h3>
        
        {sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 bg-secondary-800/50 rounded-lg hover:bg-secondary-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    session.state === 'FINISHED' ? 'bg-green-400' : 'bg-yellow-400'
                  }`} />
                  <div>
                    <p className="text-white font-medium">
                      {session.skills?.slice(0, 3).join(', ')}
                      {session.skills?.length > 3 && '...'}
                    </p>
                    <p className="text-sm text-secondary-400">
                      {new Date(session.startedAt).toLocaleDateString()} · {session.questionsAsked} questions
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {session.finalScore !== undefined && (
                    <span className={`font-bold ${getScoreColor(session.finalScore)}`}>
                      {session.finalScore}%
                    </span>
                  )}
                  
                  <button
                    onClick={() => navigate(`/report/${session.id}`)}
                    className="p-2 hover:bg-secondary-700 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-secondary-400" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary-400 text-center py-8">
            No sessions yet. Start your first interview!
          </p>
        )}
      </motion.div>
    </div>
  );
}

export default Dashboard;
