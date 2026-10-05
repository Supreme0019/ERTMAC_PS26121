import { useState, useEffect } from 'react';
import api from '../api/client';

export default function useWellRealtime(wellId) {
  const [realtimeState, setRealtimeState] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [risks, setRisks] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wellId) return;

    const baseURL = api.defaults.baseURL || '';
    // EventSource needs an absolute or relative URL that the Vite proxy can handle
    const sseBase = baseURL.startsWith('http') ? baseURL : '';
    const sseUrl = `${sseBase}/api/realtime/${wellId}`;
    
    let eventSource;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.onerror = (err) => {
        setConnected(false);
        setError('Connection lost to realtime server.');
      };

      eventSource.addEventListener('well-update', (e) => {
        try {
          const data = JSON.parse(e.data);
          setRealtimeState(prev => ({ ...prev, ...data }));
        } catch (err) {
          console.error('Failed to parse well-update:', err);
        }
      });

      eventSource.addEventListener('alert', (e) => {
        try {
          const newAlert = JSON.parse(e.data);
          setAlerts(prev => [newAlert, ...prev].slice(0, 50)); // Keep last 50
        } catch (err) {
          console.error('Failed to parse alert:', err);
        }
      });

      eventSource.addEventListener('alert-acknowledged', (e) => {
        try {
          const { id } = JSON.parse(e.data);
          setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
        } catch (err) {
          console.error('Failed to parse alert-acknowledged:', err);
        }
      });

      eventSource.addEventListener('alert-resolved', (e) => {
        try {
          const { id } = JSON.parse(e.data);
          setAlerts(prev => prev.filter(a => a.id !== id));
        } catch (err) {
          console.error('Failed to parse alert-resolved:', err);
        }
      });

      eventSource.addEventListener('risk-update', (e) => {
        try {
          const riskData = JSON.parse(e.data);
          setRisks(prev => {
            const exists = prev.find(r => r.id === riskData.id);
            if (exists) {
              return prev.map(r => r.id === riskData.id ? riskData : r);
            }
            return [riskData, ...prev];
          });
        } catch (err) {
          console.error('Failed to parse risk-update:', err);
        }
      });

    } catch (err) {
      setError('Failed to establish realtime connection.');
    }

    return () => {
      if (eventSource) {
        eventSource.close();
        setConnected(false);
      }
    };
  }, [wellId]);

  return { realtimeState, alerts, risks, connected, error };
}
