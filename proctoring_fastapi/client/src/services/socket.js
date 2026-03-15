import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io({
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinSession(sessionId, isReconnect = false) {
    this.socket?.emit('join-session', { sessionId, isReconnect });
  }

  startInterview() {
    this.socket?.emit('start-interview');
  }

  requestNextQuestion() {
    this.socket?.emit('next-question');
  }

  submitAnswer(answer, isTranscribed = false) {
    this.socket?.emit('submit-answer', { answer, isTranscribed });
  }

  sendInterimSpeech(text) {
    this.socket?.emit('speech-interim', { text });
  }

  getProgress() {
    this.socket?.emit('get-progress');
  }

  requestHint() {
    this.socket?.emit('request-hint');
  }

  // Event listeners
  onSessionJoined(callback) {
    this.socket?.on('session-joined', callback);
  }

  onInterviewMessage(callback) {
    this.socket?.on('interview-message', callback);
  }

  onQuestion(callback) {
    this.socket?.on('question', callback);
  }

  onAnswerResult(callback) {
    this.socket?.on('answer-result', callback);
  }

  onInterviewComplete(callback) {
    this.socket?.on('interview-complete', callback);
  }

  onProgress(callback) {
    this.socket?.on('progress', callback);
  }

  onHint(callback) {
    this.socket?.on('hint', callback);
  }

  onError(callback) {
    this.socket?.on('error', callback);
  }

  // Remove listeners
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export const socketService = new SocketService();
export default socketService;
