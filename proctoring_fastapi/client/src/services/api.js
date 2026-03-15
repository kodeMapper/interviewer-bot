import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interview API
export const interviewAPI = {
  startSession: async (skills, resumePath = null) => {
    const response = await api.post('/interview/start', { skills, resumePath });
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

  delete: async (sessionId) => {
    const response = await api.delete(`/session/${sessionId}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/session/stats/summary');
    return response.data;
  }
};

export default api;
