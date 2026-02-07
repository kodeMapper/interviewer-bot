import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trophy, Target, Clock, CheckCircle, XCircle, 
  SkipForward, Home, RotateCcw, Download
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { interviewAPI } from '../services/api';

function Report() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const result = await interviewAPI.getReport(sessionId);
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

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'from-green-500 to-emerald-600';
    if (score >= 60) return 'from-blue-500 to-cyan-600';
    if (score >= 40) return 'from-yellow-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-red-400 mb-4">{error || 'Report not found'}</p>
        <Link to="/" className="btn-primary">
          Go Home
        </Link>
      </div>
    );
  }

  const { summary, topicBreakdown, strengths, weaknesses, recommendations, detailedAnswers } = report;

  // Prepare radar chart data
  const radarData = topicBreakdown.map(t => ({
    topic: t.topic.replace('_', ' '),
    score: t.averageScore,
    fullMark: 100
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex justify-center mb-4">
          <div className={`p-4 rounded-full bg-gradient-to-br ${getScoreBg(summary.finalScore)}`}>
            <Trophy className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Interview Complete!</h1>
        <p className="text-secondary-400">
          Here's how you performed in your mock interview
        </p>
      </motion.div>

      {/* Main Score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="card text-center mb-8"
      >
        <p className="text-secondary-400 mb-2">Final Score</p>
        <p className={`text-7xl font-bold ${getScoreColor(summary.finalScore)}`}>
          {summary.finalScore}%
        </p>
        <div className="flex justify-center gap-8 mt-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{summary.answered}</p>
            <p className="text-sm text-secondary-400">Answered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{summary.correct}</p>
            <p className="text-sm text-secondary-400">Correct</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{summary.skipped}</p>
            <p className="text-sm text-secondary-400">Skipped</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{summary.duration || '-'}</p>
            <p className="text-sm text-secondary-400">Minutes</p>
          </div>
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Topic Breakdown */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h3 className="text-lg font-medium text-white mb-4">Topic Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topicBreakdown} layout="vertical">
              <XAxis 
                type="number" 
                domain={[0, 100]}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis 
                type="category" 
                dataKey="topic" 
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                width={100}
              />
              <Tooltip 
                contentStyle={{ 
                  background: '#1e293b', 
                  border: '1px solid #475569',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="averageScore" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <h3 className="text-lg font-medium text-white mb-4">Skills Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#475569" />
              <PolarAngleAxis 
                dataKey="topic" 
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <Radar
                dataKey="score"
                stroke="#0ea5e9"
                fill="#0ea5e9"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <h3 className="text-lg font-medium text-green-400 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Strengths
          </h3>
          {strengths.length > 0 ? (
            <ul className="space-y-2">
              {strengths.map((s) => (
                <li key={s} className="flex items-center gap-2 text-secondary-300">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  {s.replace('_', ' ')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-secondary-400">Complete more questions to identify strengths</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <h3 className="text-lg font-medium text-yellow-400 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Areas to Improve
          </h3>
          {weaknesses.length > 0 ? (
            <ul className="space-y-2">
              {weaknesses.map((w) => (
                <li key={w} className="flex items-center gap-2 text-secondary-300">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  {w.replace('_', ' ')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-secondary-400">Great job! No major weaknesses identified</p>
          )}
        </motion.div>
      </div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card mb-8"
      >
        <h3 className="text-lg font-medium text-white mb-4">Recommendations</h3>
        <ul className="space-y-3">
          {recommendations.map((rec, index) => (
            <li key={index} className="flex items-start gap-3 text-secondary-300">
              <span className="text-primary-400 font-bold">{index + 1}.</span>
              {rec}
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Detailed Answers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card mb-8"
      >
        <h3 className="text-lg font-medium text-white mb-4">Question Review</h3>
        <div className="space-y-4">
          {detailedAnswers.map((answer, index) => (
            <div key={index} className="p-4 bg-secondary-800/50 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {answer.isSkipped ? (
                      <SkipForward className="w-4 h-4 text-secondary-400" />
                    ) : answer.isCorrect ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="skill-badge text-xs">{answer.topic}</span>
                  </div>
                  <p className="text-white mb-2">{answer.question}</p>
                  {!answer.isSkipped && (
                    <p className="text-sm text-secondary-400">
                      Your answer: {answer.userAnswer}
                    </p>
                  )}
                </div>
                <div className={`text-2xl font-bold ${
                  answer.isSkipped ? 'text-secondary-400' : getScoreColor(answer.score)
                }`}>
                  {answer.isSkipped ? '-' : `${answer.score}%`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex flex-wrap justify-center gap-4"
      >
        <Link to="/" className="btn-primary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          New Interview
        </Link>
        <Link to="/dashboard" className="btn-secondary flex items-center gap-2">
          <Home className="w-4 h-4" />
          Dashboard
        </Link>
      </motion.div>
    </div>
  );
}

export default Report;
