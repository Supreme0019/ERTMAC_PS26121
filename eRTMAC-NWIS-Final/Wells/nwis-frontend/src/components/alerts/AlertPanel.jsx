import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { alertsAPI } from '../../api/client';
import AlertCard from './AlertCard';
import { LoadingState } from '../ui/LoadingState';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import './AlertPanel.css';

const AlertPanel = ({ wellId }) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['alerts', wellId],
    queryFn: async () => {
      const response = await alertsAPI.getByWell(wellId);
      return response.data?.data || response.data || [];
    },
    enabled: !!wellId,
    refetchInterval: 30000 // Poll every 30s
  });

  const handleUpdate = () => {
    queryClient.invalidateQueries(['alerts', wellId]);
    queryClient.invalidateQueries(['dashboard', wellId]);
  };

  if (isLoading) return <LoadingState message="Loading alerts..." />;
  if (error) return <ErrorState message="Failed to load alerts" onRetry={refetch} />;
  
  const alerts = Array.isArray(data) ? data : data.alerts || [];

  if (!alerts || alerts.length === 0) {
    return <EmptyState title="No Active Alerts" message="Everything is operating normally." />;
  }

  return (
    <div className="alert-panel">
      {alerts.map(alert => (
        <AlertCard 
          key={alert.id || alert._id} 
          alert={alert} 
          onUpdate={handleUpdate} 
        />
      ))}
    </div>
  );
};

export default AlertPanel;
