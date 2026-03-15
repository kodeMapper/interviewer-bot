import { useEffect, useRef, useCallback, useState } from 'react';
import socketService from '../services/socket';

/**
 * Custom hook for Socket.io connection and events
 */
export function useSocket(sessionId) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const joinedSessionRef = useRef(null); // Track which session we've joined
  const isReconnectRef = useRef(false);  // Track if this is a reconnection

  // Connect to socket
  useEffect(() => {
    const socket = socketService.connect();
    socketRef.current = socket;

    // Check if already connected (socket might be reused)
    if (socket.connected) {
      console.log('🔌 Socket already connected:', socket.id);
      setIsConnected(true);
      // Only join if we haven't already joined this session
      if (sessionId && joinedSessionRef.current !== sessionId) {
        // This is a reconnect if we had a session before
        const isReconnect = joinedSessionRef.current !== null;
        socketService.joinSession(sessionId, isReconnect);
        joinedSessionRef.current = sessionId;
      }
    }

    const handleConnect = () => {
      console.log('🔌 Socket connected:', socket.id);
      setIsConnected(true);
      setError(null);
      
      // Only join if we haven't already joined this session
      if (sessionId && joinedSessionRef.current !== sessionId) {
        // Detect reconnection (if we previously had a session)
        const isReconnect = isReconnectRef.current;
        socketService.joinSession(sessionId, isReconnect);
        joinedSessionRef.current = sessionId;
      }
    };

    const handleDisconnect = () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
      // Mark that next connect will be a reconnect
      if (joinedSessionRef.current) {
        isReconnectRef.current = true;
      }
      // Reset joined session on disconnect so we rejoin on reconnect
      joinedSessionRef.current = null;
    };

    const handleConnectError = (err) => {
      console.error('🔌 Socket connection error:', err.message);
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      // Only remove the listeners we added, not all listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [sessionId]);

  // Rejoin session if sessionId changes
  useEffect(() => {
    // Only join if connected AND session changed AND not already joined this session
    if (isConnected && sessionId && joinedSessionRef.current !== sessionId) {
      socketService.joinSession(sessionId);
      joinedSessionRef.current = sessionId;
    }
  }, [isConnected, sessionId]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, callback) => {
    socketRef.current?.on(event, callback);
    return () => {
      socketRef.current?.off(event, callback);
    };
  }, []);

  const off = useCallback((event, callback) => {
    socketRef.current?.off(event, callback);
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on,
    off
  };
}

export default useSocket;
