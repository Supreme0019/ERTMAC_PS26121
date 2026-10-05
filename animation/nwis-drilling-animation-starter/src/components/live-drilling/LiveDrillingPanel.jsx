import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import './live-drilling.css';

const DEFAULT_WELL_ID = 'b1000000-0000-0000-0000-000000000001';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const DEPTH_MIN = 2700;
const DEPTH_MAX = 2900;

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload;
}

function unwrap(payload) {
  return payload?.data ?? payload;
}

function depthToY(depth) {
  const clamped = THREE.MathUtils.clamp(Number(depth ?? DEPTH_MIN), DEPTH_MIN, DEPTH_MAX);
  return 3.25 - ((clamped - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN)) * 6.5;
}

function RockLayer({ y, height, color, seed = 1 }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 1 }), [color]);
  const speckles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    x: -4.4 + ((i * 37 + seed * 13) % 87) / 10,
    y: y - height / 2 + ((i * 17 + seed * 7) % 100) / 100 * height,
    z: 0.12 + ((i * 11) % 9) / 100,
    size: 0.025 + ((i * 7) % 5) / 100,
  })), [y, height, seed]);
  return (
    <group>
      <mesh position={[0, y, -0.25]} material={material}>
        <boxGeometry args={[9.4, height, 0.5]} />
      </mesh>
      {speckles.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[p.size, 5, 4]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#9b9da2' : '#343b45'} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function DrillAssembly({ depth, rpm, riskActive }) {
  const group = useRef();
  const targetY = depthToY(depth);
  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 3.5, delta);
    group.current.rotation.y += Math.max(0, Number(rpm || 0)) / 60 * Math.PI * 2 * delta * 0.16;
  });
  return (
    <group ref={group} position={[0, targetY, 0.28]}>
      {/* drill string */}
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 3.1, 16]} />
        <meshStandardMaterial color="#b8c4d0" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.12, 0.17, 0.65, 12]} />
        <meshStandardMaterial color="#71869a" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* stylised tri-cone bit */}
      {[0, 1, 2].map((n) => (
        <mesh key={n} position={[Math.cos(n * 2.094) * 0.11, -0.36, Math.sin(n * 2.094) * 0.11]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.105, 0.25, 8]} />
          <meshStandardMaterial color={riskActive ? '#ff6b54' : '#39a7ff'} metalness={0.55} roughness={0.28} />
        </mesh>
      ))}
      <pointLight position={[0, -0.4, 0.5]} color={riskActive ? '#ff442f' : '#249bff'} intensity={2} distance={2.5} />
      <mesh position={[0, -0.53, 0]}>
        <sphereGeometry args={[0.16, 12, 8]} />
        <meshBasicMaterial color={riskActive ? '#ff5b43' : '#3ca8ff'} />
      </mesh>
    </group>
  );
}

function GeologicalScene({ depth, rpm, riskActive }) {
  const layers = [
    { y: 2.65, h: 1.2, color: '#535d67' },
    { y: 1.45, h: 1.2, color: '#7c6d58' },
    { y: 0.25, h: 1.2, color: '#3f4855' },
    { y: -0.95, h: 1.2, color: '#776d7a' },
    { y: -2.15, h: 1.2, color: '#4a4547' },
    { y: -3.35, h: 1.2, color: '#333c48' },
  ];
  const riskTop = depthToY(2800);
  const riskBottom = depthToY(2850);
  const riskCenter = (riskTop + riskBottom) / 2;
  const riskHeight = Math.abs(riskTop - riskBottom);
  return (
    <>
      <color attach="background" args={['#081321']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 8]} intensity={2} />
      <Stars radius={45} depth={10} count={180} factor={1} fade speed={0.2} />
      {layers.map((layer, i) => <RockLayer key={i} {...layer} seed={i + 1} />)}
      {/* transparent highlighted historical interval */}
      <mesh position={[0.4, riskCenter, 0.08]}>
        <boxGeometry args={[8.2, riskHeight, 0.06]} />
        <meshBasicMaterial color="#ff4d43" transparent opacity={riskActive ? 0.32 : 0.18} depthWrite={false} />
      </mesh>
      <lineSegments position={[0.4, riskCenter, 0.13]}>
        <edgesGeometry args={[new THREE.BoxGeometry(8.2, riskHeight, 0.08)]} />
        <lineBasicMaterial color={riskActive ? '#ff6b55' : '#ffad4d'} />
      </lineSegments>
      <Html position={[-3.4, riskCenter, 0.3]} center distanceFactor={9}>
        <div className={`risk-zone-label ${riskActive ? 'is-active' : ''}`}>HISTORICAL RISK ZONE<br /><small>2,800–2,850 m · mud loss</small></div>
      </Html>
      {/* surface casing and derrick silhouette */}
      <mesh position={[0, 3.35, 0.35]}>
        <boxGeometry args={[0.75, 0.25, 0.35]} />
        <meshStandardMaterial color="#d89a22" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[0, 2.75, 0.4]}>
        <cylinderGeometry args={[0.19, 0.19, 1.1, 16]} />
        <meshStandardMaterial color="#9baab9" metalness={0.7} roughness={0.3} />
      </mesh>
      <DrillAssembly depth={depth} rpm={rpm} riskActive={riskActive} />
      {/* depth guide */}
      <mesh position={[4.15, 0, 0.2]}>
        <boxGeometry args={[0.025, 6.5, 0.04]} />
        <meshBasicMaterial color="#91a8bf" />
      </mesh>
      {[2700, 2750, 2800, 2850, 2900].map((d) => (
        <group key={d} position={[4.15, depthToY(d), 0.3]}>
          <mesh position={[0.1, 0, 0]}>
            <boxGeometry args={[0.2, 0.018, 0.025]} />
            <meshBasicMaterial color={d >= 2800 && d <= 2850 ? '#ff8b55' : '#a5b5c7'} />
          </mesh>
          <Html position={[0.38, 0, 0]} transform distanceFactor={8}>
            <span className="depth-tick">{d.toLocaleString()} m</span>
          </Html>
        </group>
      ))}
      <OrbitControls enablePan={false} minDistance={7} maxDistance={13} minPolarAngle={0.8} maxPolarAngle={2.2} />
    </>
  );
}

function Metric({ label, value, unit, accent }) {
  return <div className="ld-metric" style={{ '--metric-accent': accent }}><span>{label}</span><strong>{value ?? '—'} <small>{value == null ? '' : unit}</small></strong></div>;
}

export default function LiveDrillingPanel({ wellId = DEFAULT_WELL_ID, compact = false }) {
  const [state, setState] = useState(null);
  const [risks, setRisks] = useState([]);
  const [latestAlert, setLatestAlert] = useState(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [speedMs, setSpeedMs] = useState(3000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const lastDepth = useRef(null);

  const addEvent = useCallback((message, level = 'info') => {
    setEvents((old) => [{ id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), message, level }, ...old].slice(0, 5));
  }, []);

  useEffect(() => {
    let alive = true;
    apiRequest(`/realtime/${wellId}/state`)
      .then((payload) => { if (alive) { const data = unwrap(payload); setState(data?.state ?? data ?? null); } })
      .catch((e) => { if (alive) setError(`Could not load current state: ${e.message}`); });
    apiRequest('/realtime/replay/status')
      .then((payload) => { if (alive) setRunning(Boolean(unwrap(payload)?.isReplaying)); })
      .catch(() => {});

    // This route is currently unauthenticated in the supplied backend. EventSource
    // cannot attach a custom Authorization header; if the route is secured later,
    // use a cookie-authenticated stream or an authenticated fetch-based SSE client.
    const source = new EventSource(`${API_BASE}/realtime/${wellId}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener('well-update', (event) => {
      try {
        const next = JSON.parse(event.data);
        setState(next);
        if (lastDepth.current != null && next.depth !== lastDepth.current) addEvent(`Depth advanced to ${Number(next.depth).toLocaleString()} m`);
        lastDepth.current = next.depth;
      } catch { /* ignore malformed event */ }
    });
    source.addEventListener('risk-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        setRisks(data.risks || []);
        if ((data.risks || []).some((risk) => ['high', 'critical'].includes(String(risk.level).toLowerCase()))) addEvent('High contextual risk returned by risk engine', 'danger');
      } catch { /* ignore malformed event */ }
    });
    source.addEventListener('alert', (event) => {
      try {
        const alert = JSON.parse(event.data);
        setLatestAlert(alert);
        addEvent(alert.message || alert.explanation || 'New risk alert received', 'danger');
      } catch { /* ignore malformed event */ }
    });
    return () => { alive = false; source.close(); };
  }, [wellId, addEvent]);

  const controlReplay = async (action) => {
    setBusy(true); setError('');
    try {
      if (action === 'start') {
        await apiRequest('/realtime/replay/start', { method: 'POST', body: JSON.stringify({ wellId, speedMs }) });
        setRunning(true); addEvent('Replay simulation started');
      } else {
        await apiRequest('/realtime/replay/stop', { method: 'POST', body: JSON.stringify({}) });
        setRunning(false); addEvent('Replay simulation stopped');
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const depth = Number(state?.depth ?? DEPTH_MIN);
  const riskActive = risks.some((risk) => ['high', 'critical'].includes(String(risk.level).toLowerCase())) || Boolean(latestAlert);
  const progress = Math.max(0, Math.min(100, ((depth - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN)) * 100));
  const riskText = riskActive ? 'HIGH CONTEXTUAL RISK' : depth >= 2800 ? 'HISTORICAL ZONE NEARBY' : 'MONITORING';

  return (
    <section className={`live-drilling-panel ${compact ? 'is-compact' : ''}`}>
      <header className="ld-header">
        <div><div className="ld-eyebrow">NWIS · eRTMAC ADAPTER SIMULATION</div><h2>Live drilling cutaway</h2></div>
        <span className={`ld-connection ${connected ? 'online' : ''}`}><i />{connected ? 'STREAM CONNECTED' : 'CONNECTING'}</span>
      </header>
      <div className="ld-layout">
        <div className="ld-scene-wrap">
          <div className="ld-scene-top"><span>FORMATION X · VERTICAL SECTION</span><strong>{depth.toLocaleString()} m</strong></div>
          <div className="ld-canvas"><Canvas camera={{ position: [0, 0, 10], fov: 42 }} dpr={[1, 1.6]}>
            <GeologicalScene depth={depth} rpm={state?.rpm} riskActive={riskActive} />
          </Canvas></div>
          <div className="ld-scene-footer"><span><i className="ld-dot blue" /> Drill bit</span><span><i className="ld-dot amber" /> Historical interval</span><span><i className="ld-dot red" /> Active risk</span></div>
        </div>
        <aside className="ld-side">
          <div className="ld-panel-heading">Live parameters <span>{connected ? '● LIVE' : '○ OFFLINE'}</span></div>
          <div className="ld-metrics-grid">
            <Metric label="DEPTH" value={state?.depth != null ? Number(state.depth).toLocaleString() : null} unit="m" accent="#3ca8ff" />
            <Metric label="ROP" value={state?.rop} unit="m/h" accent="#41d6b0" />
            <Metric label="TORQUE" value={state?.torque} unit="kN·m" accent="#f3a64a" />
            <Metric label="WOB" value={state?.wob} unit="ton" accent="#b99cff" />
            <Metric label="RPM" value={state?.rpm} unit="rpm" accent="#3ca8ff" />
            <Metric label="PRESSURE" value={state?.standpipe_pressure} unit="psi" accent="#ff6c62" />
          </div>
          <div className={`ld-risk-card ${riskActive ? 'danger' : depth >= 2800 ? 'warning' : ''}`}>
            <div className="ld-risk-title"><span className="ld-risk-icon">!</span><div><small>CONTEXTUAL ASSESSMENT</small><strong>{riskText}</strong></div></div>
            <ul>
              <li>Historical depth interval: 2,800–2,850 m</li>
              <li>Current depth: {depth.toLocaleString()} m</li>
              <li>{risks.length ? `${risks.length} risk result(s) from backend` : 'Waiting for risk evaluation event'}</li>
            </ul>
            {(latestAlert || risks[0]) && <p className="ld-risk-explanation">{latestAlert?.message || risks[0]?.explanation || risks[0]?.description}</p>}
          </div>
          <div className="ld-progress"><div><span>Progress to demo interval</span><strong>{Math.round(progress)}%</strong></div><div className="ld-progress-track"><i style={{ width: `${progress}%` }} /></div><small>{Math.max(0, 2800 - depth).toLocaleString()} m to historical zone start (approx.)</small></div>
        </aside>
      </div>
      <footer className="ld-controls">
        <div className="ld-buttons">
          <button className="ld-btn primary" disabled={busy || running} onClick={() => controlReplay('start')}>▶ Start replay</button>
          <button className="ld-btn" disabled={busy || !running} onClick={() => controlReplay('stop')}>■ Stop</button>
          <label className="ld-speed">Interval <select value={speedMs} onChange={(e) => setSpeedMs(Number(e.target.value))} disabled={running}><option value={5000}>5 sec</option><option value={3000}>3 sec</option><option value={1000}>1 sec</option></select></label>
        </div>
        <div className="ld-event-log"><strong>Recent activity</strong>{events.length ? events.slice(0, 2).map((item) => <div key={item.id} className={item.level}>{item.time} · {item.message}</div>) : <div>Waiting for stream events…</div>}</div>
      </footer>
      {error && <div className="ld-error" role="alert">{error}</div>}
      <p className="ld-disclaimer">Simulation visualization only. Geological layers and the 2,800–2,850 m interval are illustrative; risk status comes from backend events.</p>
    </section>
  );
}
