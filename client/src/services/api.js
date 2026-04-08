import axios from 'axios';

let API_BASE = import.meta.env.VITE_API_URL || '/api';

// Robust check: Ensure API_BASE ends with /api to match server expectations
if (API_BASE && !API_BASE.endsWith('/api') && !API_BASE.endsWith('/api/')) {
  // Remove trailing slash if present, then add /api
  API_BASE = API_BASE.replace(/\/$/, '') + '/api';
}

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interview API
export const interviewAPI = {
  startSession: async (skills, resumePath = null, username, candidateName, sessionName) => {
    const response = await api.post('/interview/start', { skills, resumePath, username, candidateName, sessionName });
    return response.data;
  },

  getSession: async (sessionId) => {
    const response = await api.get(`/interview/session/${sessionId}`);
    return response.data;
  },

  endSession: async (sessionId) => {
    const response = await api.post(`/interview/session/${sessionId}/end`);
    return response.data;
  },

  getReport: async (sessionId) => {
    // Add timestamp to prevent 304 caching
    const response = await api.get(`/interview/session/${sessionId}/report`, {
      params: { _t: Date.now() },
      headers: { 'Cache-Control': 'no-cache' }
    });
    return response.data;
  }
};

// Resume API
export const resumeAPI = {
  upload: async (file, sessionId) => {
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('sessionId', sessionId);

    const response = await api.post('/resume/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  getResumeData: async (sessionId) => {
    const response = await api.get(`/resume/${sessionId}/data`);
    return response.data;
  },

  getResumeQuestions: async (sessionId) => {
    const response = await api.get(`/resume/${sessionId}/questions`);
    return response.data;
  }
};

// Questions API
export const questionsAPI = {
  getByTopic: async (topic, page = 1, limit = 10) => {
    const response = await api.get(`/questions/topic/${topic}`, {
      params: { page, limit }
    });
    return response.data;
  },

  search: async (query, topics = []) => {
    const response = await api.get('/questions/search', {
      params: { q: query, topics: topics.join(',') }
    });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/questions/stats');
    return response.data;
  },

  getTopics: async () => {
    const response = await api.get('/questions/topics');
    return response.data;
  }
};

// Sessions API
export const sessionsAPI = {
  getAll: async (page = 1, limit = 10, state = null) => {
    const response = await api.get('/session', {
      params: { page, limit, state }
    });
    return response.data;
  },

  getById: async (sessionId) => {
    const response = await api.get(`/session/${sessionId}`);
    return response.data;
  },

  getByUsername: async (username) => {
    const response = await api.get(`/interview/user/${username}`);
    return response.data;
  },

  delete: async (sessionId) => {
    const response = await api.delete(`/session/${sessionId}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/session/stats/summary');
    return response.data;
  }
};

// Proctoring API
export const proctoringAPI = {
  getStatus: async () => {
    const response = await api.get('/proctoring/status');
    return response.data;
  },

  start: async () => {
    const response = await api.post('/proctoring/start');
    return response.data;
  },

  stop: async () => {
    const response = await api.post('/proctoring/stop');
    return response.data;
  },

  setMeta: async (sessionId, metaData = {}) => {
    const response = await api.post('/proctoring/session/meta', {
      exam_id: sessionId,
      candidate_name: metaData.name || 'Candidate',
      ...metaData
    });
    return response.data;
  }
};

// Report API (Combined)
export const reportAPI = {
  getCombined: async (sessionId) => {
    const response = await api.get(`/report/${sessionId}/combined`);
    return response.data;
  }
};

export default api;
