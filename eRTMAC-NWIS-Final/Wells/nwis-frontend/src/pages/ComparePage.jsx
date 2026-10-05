import { useState } from 'react';
import { motion } from 'framer-motion';
import { compareAPI } from '../api/client';
import { Layers, AlertTriangle, ArrowRight } from 'lucide-react';
import './ComparePage.css';

export default function ComparePage() {
  const [selectedWells, setSelectedWells] = useState([]);
  const [wellInput, setWellInput] = useState('');
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);

  function addWell() {
    if (wellInput && !selectedWells.includes(wellInput) && selectedWells.length < 4) {
      setSelectedWells([...selectedWells, wellInput]);
      setWellInput('');
    }
  }

  async function handleCompare() {
    if (selectedWells.length < 2) return;
    setLoading(true);
    try {
      const { data } = await compareAPI.compare({ wellIds: selectedWells });
      setCompareData(data.data || data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header">
        <h1 className="page-title">Well <span className="text-gradient">Comparison</span></h1>
        <p className="page-subtitle">Compare offset wells for parameters, events, and formations</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3>Select Wells to Compare (2-4)</h3>
        
        {/* Quick Presets for Demo */}
        <div style={{ marginTop: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Quick Presets:</span>
          <button 
            type="button" 
            className="btn btn-sm btn-ghost" 
            style={{ fontSize: '0.75rem', border: '1px solid var(--color-border)', borderRadius: '16px' }}
            onClick={() => { setSelectedWells(['WELL-A-102', 'SYN-014']); }}
          >
            WELL-A-102 vs SYN-014 (Key Mud Loss Offset)
          </button>
          <button 
            type="button" 
            className="btn btn-sm btn-ghost" 
            style={{ fontSize: '0.75rem', border: '1px solid var(--color-border)', borderRadius: '16px' }}
            onClick={() => { setSelectedWells(['WELL-A-102', 'SYN-009', 'SYN-023']); }}
          >
            WELL-A-102 vs SYN-009 vs SYN-023 (Proximity Cluster)
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <input 
            type="text" 
            className="input" 
            placeholder="Enter Well Name or ID (e.g. WELL-A-102, SYN-015)" 
            value={wellInput} 
            onChange={(e) => setWellInput(e.target.value)} 
          />
          <button className="btn btn-secondary" onClick={addWell} disabled={selectedWells.length >= 4}>Add</button>
          <button className="btn btn-primary" onClick={handleCompare} disabled={selectedWells.length < 2 || loading}>
            {loading ? 'Comparing...' : 'Compare Wells'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          {selectedWells.map(w => (
            <span key={w} className="badge badge-info" style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 10px', fontSize: '0.8rem' }}>
              {w} <button onClick={() => setSelectedWells(selectedWells.filter(sw => sw !== w))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}>&times;</button>
            </span>
          ))}
        </div>
      </div>

      {compareData && (
        <div className="card" style={{ overflowX: 'auto', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>
            Comparison Against Reference: <span style={{ color: '#38bdf8' }}>{compareData.referenceWell || selectedWells[0]}</span>
          </h3>
          <table className="data-table" style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ padding: '10px' }}>Operational Parameter</th>
                {compareData.wells?.map((w, i) => (
                  <th key={w.id || i} style={{ padding: '10px', color: i === 0 ? '#38bdf8' : 'var(--color-text-primary)' }}>
                    {w.name || w.well_name || selectedWells[i]} {i === 0 ? '(Active)' : '(Offset)'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px' }}><strong>Geographic Distance</strong></td>
                {compareData.wells?.map((w, i) => (
                  <td key={i} style={{ padding: '10px' }}>
                    {w.distance !== undefined ? (w.distance === 0 ? '0.00 km (Reference)' : `${Number(w.distance).toFixed(2)} km`) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px' }}><strong>Target / Total Depth</strong></td>
                {compareData.wells?.map((w, i) => (
                  <td key={i} style={{ padding: '10px' }}>
                    {w.currentDepth || w.totalDepth ? `${w.currentDepth || w.totalDepth} m` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px' }}><strong>Formation Interval</strong></td>
                {compareData.wells?.map((w, i) => (
                  <td key={i} style={{ padding: '10px' }}>
                    <span className="badge badge-neutral" style={{ color: '#a78bfa' }}>
                      {w.currentFormation || w.formation || 'Formation X'}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px' }}><strong>Correlated Depth Overlap</strong></td>
                {compareData.wells?.map((w, i) => (
                  <td key={i} style={{ padding: '10px' }}>
                    {w.depthOverlap ? `${w.depthOverlap} m` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px' }}><strong>Mud Loss Incidents</strong></td>
                {compareData.wells?.map((w, i) => (
                  <td key={i} style={{ padding: '10px' }}>
                    <span style={{ color: w.mudLossEvents > 0 ? '#ef4444' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                      {w.mudLossEvents ?? 0}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px' }}><strong>Stuck Pipe Incidents</strong></td>
                {compareData.wells?.map((w, i) => (
                  <td key={i} style={{ padding: '10px' }}>
                    <span style={{ color: w.stuckPipeEvents > 0 ? '#f59e0b' : 'var(--color-text-secondary)', fontWeight: 600 }}>
                      {w.stuckPipeEvents ?? 0}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '10px' }}><strong>Total Historical Events</strong></td>
                {compareData.wells?.map((w, i) => (
                  <td key={i} style={{ padding: '10px' }}>
                    <strong>{w.totalEvents ?? w.eventCount ?? 0}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
