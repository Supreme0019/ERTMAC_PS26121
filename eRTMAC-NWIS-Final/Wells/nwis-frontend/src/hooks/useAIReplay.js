import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for connecting directly to the AI service's WebSocket replay endpoint.
 * This streams real-time drilling data with integrated ML risk evaluation
 * from the Python AI service at ws://localhost:8000/realtime/{wellId}.
 *
 * @param {string} wellId - Well ID to replay
 * @param {object} options - { speed, radiusKm, every, startDepth, autoConnect }
 */
export default function useAIReplay(wellId, options = {}) {
  const {
    speed = 1.0,
    radiusKm = 10,
    every = 5,
    startDepth = null,
    autoConnect = false,
  } = options;

  // Connect through the /ai-ws Vite proxy instead of a direct localhost URL
  // This ensures it works on any machine, not just the one running the AI service
  const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';
  const aiWsUrl = `${wsProtocol}//${wsHost}/ai-ws`;

  const [connected, setConnected] = useState(false);
  const [replayState, setReplayState] = useState(null);
  const [risks, setRisks] = useState([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const frameCountRef = useRef(0);
  const isDoneRef = useRef(false);
  const isUserDisconnectRef = useRef(false);
  const connectionEpochRef = useRef(0);

  const disconnect = useCallback(() => {
    isUserDisconnectRef.current = true;
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close(1000, 'User stopped replay');
      } catch (_) {}
      wsRef.current = null;
    }
    setConnected(false);
    setError(null);
  }, []);

  const connect = useCallback(() => {
    if (!wellId || !aiWsUrl) return;

    // Increment connection epoch so old socket callbacks are discarded
    connectionEpochRef.current += 1;
    const currentEpoch = connectionEpochRef.current;

    // Clean up previous connection cleanly without triggering error
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.close(1000, 'Reconnecting');
      } catch (_) {}
      wsRef.current = null;
    }

    isDoneRef.current = false;
    isUserDisconnectRef.current = false;
    setDone(false);
    setError(null);
    setRisks([]);
    setReplayState(null);
    frameCountRef.current = 0;

    const params = new URLSearchParams({
      speed: String(speed),
      radius_km: String(radiusKm),
      every: String(every),
    });
    if (startDepth !== null && startDepth !== undefined) {
      params.append('start_depth', String(startDepth));
    }

    const url = `${aiWsUrl}/realtime/${encodeURIComponent(wellId)}?${params.toString()}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (connectionEpochRef.current !== currentEpoch) return;
        setConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (connectionEpochRef.current !== currentEpoch) return;
        try {
          const msg = JSON.parse(event.data);

          if (msg.done) {
            isDoneRef.current = true;
            setDone(true);
            setConnected(false);
            setError(null);
            return;
          }

          if (msg.state) {
            frameCountRef.current += 1;
            const s = msg.state;
            setReplayState(prev => ({
              ...prev,
              ...s,
              standpipe_pressure: s.pressure != null ? s.pressure : s.standpipe_pressure,
              mud_flow_rate: s.mud_flow != null ? s.mud_flow : s.mud_flow_rate,
              mud_loss: s.mud_loss,
              frameIndex: frameCountRef.current,
            }));
          }

          if (msg.risks && Array.isArray(msg.risks)) {
            setRisks(msg.risks);
          }
        } catch (parseErr) {
          console.error('Failed to parse AI replay message:', parseErr);
        }
      };

      ws.onerror = () => {
        if (connectionEpochRef.current !== currentEpoch) return;
        if (!isUserDisconnectRef.current && !isDoneRef.current && frameCountRef.current === 0) {
          setError('AI replay connection could not be established');
        }
        setConnected(false);
      };

      ws.onclose = (event) => {
        if (connectionEpochRef.current !== currentEpoch) return;
        setConnected(false);
        const isNormalCode = event.code === 1000 || event.code === 1001 || event.code === 1005 || event.wasClean;
        if (isDoneRef.current || frameCountRef.current > 0 || isNormalCode || isUserDisconnectRef.current) {
          if (isDoneRef.current || frameCountRef.current > 0) {
            setDone(true);
          }
          setError(null);
        } else {
          setError('AI replay connection could not be established');
        }
      };
    } catch (err) {
      setError(`Failed to connect to AI replay: ${err.message}`);
      setConnected(false);
    }
  }, [wellId, aiWsUrl, speed, radiusKm, every, startDepth]);

  // Clean disconnect when wellId changes
  useEffect(() => {
    disconnect();
    setDone(false);
    setError(null);
    setRisks([]);
    setReplayState(null);
    frameCountRef.current = 0;
  }, [wellId, disconnect]);

  // Auto-connect if requested
  useEffect(() => {
    if (autoConnect && wellId && aiWsUrl) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, wellId, aiWsUrl, connect, disconnect]);

  return {
    connected,
    replayState,
    risks,
    done,
    error,
    connect,
    disconnect,
    frameCount: frameCountRef.current,
  };
}
