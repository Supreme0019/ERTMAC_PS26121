import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { trajectoryAPI } from '../../api/client';
import LoadingState from '../ui/LoadingState';
import ErrorState from '../ui/ErrorState';

export default function TrajectoryPanel({ wellId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['trajectory', wellId],
    queryFn: () => trajectoryAPI.get(wellId),
    enabled: !!wellId
  });

  if (isLoading) return <LoadingState text="Loading trajectory..." />;
  if (isError) return <ErrorState text="Failed to load trajectory data." />;

  const trajectoryData = data?.data || [];

  if (trajectoryData.length === 0) {
    return <div style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>No trajectory data available.</div>;
  }

  return (
    <div style={{ height: '300px', width: '100%', background: 'var(--color-surface)', padding: '16px', borderRadius: '8px' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--color-text)' }}>Well Trajectory (Inclination vs Depth)</h4>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trajectoryData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="measured_depth_m" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
          <YAxis dataKey="inclination_deg" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
            labelFormatter={(v) => `Depth: ${v}m`}
            formatter={(v) => [`${v}°`, 'Inclination']}
          />
          <Line type="monotone" dataKey="inclination_deg" stroke="var(--color-primary)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
