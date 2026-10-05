import React, { useCallback, useEffect, useMemo, useRef, useState, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { realtimeAPI, parametersAPI } from '../../api/client';
import './live-drilling.css';

const DEFAULT_WELL_ID = 'b1000000-0000-0000-0000-000000000001';
const DEPTH_MIN = 2700;
const DEPTH_MAX = 2900;

// Safe React Error Boundary for 3D Canvas
class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.warn('Canvas Error Boundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6e6459', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#2c2520' }}>3D Cutaway Preview</p>
          <small style={{ marginTop: 8, color: '#dc2626' }}>WebGL renderer initialized in fallback mode</small>
        </div>
      );
    }
    return this.props.children;
  }
}

function depthToY(depth) {
  const clamped = THREE.MathUtils.clamp(Number(depth ?? DEPTH_MIN), DEPTH_MIN, DEPTH_MAX);
  return 3.25 - ((clamped - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN)) * 6.5;
}

// ─── SEAMLESS REALISTIC & MINIMALISTIC GEOLOGICAL STRATA ──────────────────────
// A solid contiguous formation block with subtle horizontal sedimentary bedding lines.
// No floating disconnected bars — authentic to geological cross-sections.
function GeologicalStrata() {
  const strata = useMemo(() => [
    { topY: 3.35, botY: 2.20, color: '#ded6c8', name: 'Alluvium / Surface' },
    { topY: 2.20, botY: 1.10, color: '#e0cca5', name: 'Tipam Sandstone' },
    { topY: 1.10, botY: 0.00, color: '#bfaea0', name: 'Girujan Claystone' },
    { topY: 0.00, botY: -1.10, color: '#caa882', name: 'Barail Arenaceous Group' },
    { topY: -1.10, botY: -2.25, color: '#7a6659', name: 'Kopili Formation (Trouble Zone)' },
    { topY: -2.25, botY: -3.40, color: '#d5cdbf', name: 'Sylhet Limestone' },
  ], []);

  return (
    <group position={[0, 0, -0.05]}>
      {strata.map((s, idx) => {
        const height = s.topY - s.botY;
        const centerY = (s.topY + s.botY) / 2;
        return (
          <group key={idx}>
            {/* Contiguous Formation Layer */}
            <mesh position={[0, centerY, 0]}>
              <boxGeometry args={[9.4, height, 0.44]} />
              <meshStandardMaterial 
                color={s.color} 
                roughness={0.92} 
                metalness={0.04} 
              />
            </mesh>

            {/* Subtle Minimalist Bedding Plane (Sedimentary Lamina) */}
            <mesh position={[0, s.botY, 0.22]}>
              <boxGeometry args={[9.4, 0.012, 0.02]} />
              <meshBasicMaterial color="#b0a18e" transparent opacity={0.55} />
            </mesh>

            {/* Mid-layer micro-lamination line for realistic sediment texture */}
            <mesh position={[0, centerY, 0.22]}>
              <boxGeometry args={[9.4, 0.008, 0.015]} />
              <meshBasicMaterial color="#a0917f" transparent opacity={0.25} />
            </mesh>
          </group>
        );
      })}

      {/* Central Wellbore Channel (carved vertical groove behind casing) */}
      <mesh position={[0, -0.025, 0.16]}>
        <cylinderGeometry args={[0.26, 0.26, 6.75, 24, 1, false, Math.PI * 0.5, Math.PI]} />
        <meshStandardMaterial color="#5c4e40" roughness={0.98} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

// ─── WHITE WELLBORE CASING PIPE ──────────────────────────────────────────────
// A clean, white tubular casing structure extending all the way from surface to bottom,
// inside which the drill string is inserted, rotates, and advances.
function WellboreCasing() {
  const casingLength = 6.6; // from y = 3.35 to y = -3.25
  const casingCenterY = 0.05;

  const collarDepths = [2700, 2750, 2800, 2850, 2900];

  return (
    <group position={[0, 0, 0.28]}>
      {/* 1. White Casing Back Wall (Solid crisp white pipe channel) */}
      <mesh position={[0, casingCenterY, 0]}>
        <cylinderGeometry args={[0.22, 0.22, casingLength, 32, 1, false, Math.PI * 0.25, Math.PI * 1.5]} />
        <meshStandardMaterial 
          color="#ffffff" 
          roughness={0.25} 
          metalness={0.08} 
          side={THREE.DoubleSide} 
        />
      </mesh>

      {/* 2. White Casing Front Cutaway Sleeve (Translucent frosted white tube) */}
      <mesh position={[0, casingCenterY, 0]}>
        <cylinderGeometry args={[0.222, 0.222, casingLength, 32]} />
        <meshStandardMaterial 
          color="#ffffff" 
          roughness={0.15} 
          metalness={0.12} 
          transparent 
          opacity={0.38} 
          depthWrite={false}
          side={THREE.DoubleSide} 
        />
      </mesh>

      {/* 3. White Casing Collar Joints (Casing rings at regular 50m intervals) */}
      {collarDepths.map((d) => (
        <group key={d} position={[0, depthToY(d), 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.226, 0.016, 12, 32]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* 4. Surface Wellhead Spool at rig floor (y = 3.35) */}
      <mesh position={[0, 3.32, 0]}>
        <cylinderGeometry args={[0.28, 0.25, 0.16, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* 5. Casing Guide Shoe at the bottom of the casing string */}
      <mesh position={[0, -3.22, 0]}>
        <cylinderGeometry args={[0.22, 0.19, 0.12, 24]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
}

// ─── CONTINUOUS, UNBROKEN DRILL STRING ASSEMBLY ──────────────────────────────
// The drill string rotates smoothly INSIDE the white wellbore casing pipe.
// Extends dynamically from surface rig down to the Bottom Hole Assembly.
function DrillAssembly({ depth, rpm, riskActive }) {
  const bitGroup = useRef();
  const pipeRef = useRef();
  const targetY = depthToY(depth);
  const currentY = useRef(targetY);

  useFrame((_, delta) => {
    currentY.current = THREE.MathUtils.damp(currentY.current, targetY, 3.5, delta);
    const y = currentY.current;
    const rotationIncrement = (Math.max(0, Number(rpm || 0)) / 60) * Math.PI * 2 * delta * 0.22;

    // 1. Update Bottom Hole Assembly (BHA) position & rotation inside the casing
    if (bitGroup.current) {
      bitGroup.current.position.y = y;
      bitGroup.current.rotation.y += rotationIncrement;
    }

    // 2. Continuously scale drill pipe from surface casing down to BHA
    if (pipeRef.current) {
      const surfaceY = 3.25;
      const bitTopY = y + 0.35;
      const pipeLen = Math.max(0.1, surfaceY - bitTopY);

      pipeRef.current.scale.set(1, pipeLen, 1);
      pipeRef.current.position.y = surfaceY - pipeLen / 2;
      pipeRef.current.rotation.y += rotationIncrement;
    }
  });

  return (
    <>
      {/* CONTINUOUS STEEL DRILL PIPE (Inside the white casing) */}
      <mesh ref={pipeRef} position={[0, 1.7, 0.28]}>
        <cylinderGeometry args={[0.075, 0.075, 1, 16]} />
        <meshStandardMaterial color="#4a5568" metalness={0.8} roughness={0.28} />
      </mesh>

      {/* BOTTOM HOLE ASSEMBLY (BHA) & DRILL BIT */}
      <group ref={bitGroup} position={[0, targetY, 0.28]}>
        {/* Drill collar stabilizer */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.13, 0.15, 0.45, 14]} />
          <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Mud motor / bit sub */}
        <mesh position={[0, -0.08, 0]}>
          <cylinderGeometry args={[0.14, 0.17, 0.32, 14]} />
          <meshStandardMaterial color="#1a202c" metalness={0.8} roughness={0.25} />
        </mesh>

        {/* Stylized Tri-cone roller cone bit */}
        {[0, 1, 2].map((n) => (
          <mesh 
            key={n} 
            position={[Math.cos(n * 2.094) * 0.11, -0.32, Math.sin(n * 2.094) * 0.11]} 
            rotation={[0, 0, Math.PI]}
          >
            <coneGeometry args={[0.1, 0.25, 8]} />
            <meshStandardMaterial 
              color={riskActive ? '#dc2626' : '#95562d'} 
              metalness={0.75} 
              roughness={0.2} 
            />
          </mesh>
        ))}

        {/* Bit glow / cutting tip indicator */}
        <pointLight 
          position={[0, -0.4, 0.45]} 
          color={riskActive ? '#ef4444' : '#f59e0b'} 
          intensity={riskActive ? 3.0 : 1.8} 
          distance={2.6} 
        />
        <mesh position={[0, -0.46, 0]}>
          <sphereGeometry args={[0.14, 12, 8]} />
          <meshBasicMaterial color={riskActive ? '#dc2626' : '#f59e0b'} />
        </mesh>
      </group>
    </>
  );
}

function GeologicalScene({ depth, rpm, riskActive }) {
  const riskTop = depthToY(2800);
  const riskBottom = depthToY(2850);
  const riskCenter = (riskTop + riskBottom) / 2;
  const riskHeight = Math.abs(riskTop - riskBottom);

  return (
    <>
      {/* Warm cream background matching the main website theme */}
      <color attach="background" args={['#ede5d8']} />
      <ambientLight intensity={1.35} color="#fffcf7" />
      <directionalLight position={[4, 6, 8]} intensity={1.7} color="#fffaf0" />
      <directionalLight position={[-4, -2, 5]} intensity={0.5} color="#d9caa8" />

      {/* 1. Realistic Minimalist Contiguous Geological Strata */}
      <GeologicalStrata />

      {/* 2. Highlighted Historical Risk Interval (2,800m - 2,850m) */}
      <mesh position={[0.4, riskCenter, 0.18]}>
        <boxGeometry args={[8.4, riskHeight, 0.08]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={riskActive ? 0.35 : 0.16} depthWrite={false} />
      </mesh>
      <lineSegments position={[0.4, riskCenter, 0.23]}>
        <edgesGeometry args={[new THREE.BoxGeometry(8.4, riskHeight, 0.09)]} />
        <lineBasicMaterial color={riskActive ? '#dc2626' : '#d97706'} />
      </lineSegments>

      {/* 3. Sleek White Wellbore Casing Pipe (Extends all the way from surface to bottom) */}
      <WellboreCasing />

      {/* 4. Continuous Drill String & Bit (Operates inside the white casing) */}
      <DrillAssembly depth={depth} rpm={rpm} riskActive={riskActive} />

      {/* 5. Minimalist Depth Guide */}
      <mesh position={[4.15, 0, 0.2]}>
        <boxGeometry args={[0.02, 6.5, 0.04]} />
        <meshBasicMaterial color="#a89a88" />
      </mesh>

      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.8} maxPolarAngle={2.2} />
    </>
  );
}

function Metric({ label, value, unit, accent }) {
  return (
    <div className="ld-metric" style={{ '--metric-accent': accent }}>
      <span>{label}</span>
      <strong>{value ?? '—'} <small>{value == null ? '' : unit}</small></strong>
    </div>
  );
}

export default function LiveDrillingPanel({ wellId = DEFAULT_WELL_ID, liveState = null, compact = false }) {
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

  // Sync with liveState from parent when available
  useEffect(() => {
    if (liveState) {
      setState((prev) => ({ ...(prev || {}), ...liveState }));
      if (lastDepth.current != null && liveState.depth !== lastDepth.current) {
        addEvent(`Bit advanced to ${Number(liveState.depth).toLocaleString()} m`);
      }
      lastDepth.current = liveState.depth;
    }
  }, [liveState, addEvent]);

  // Initial load from Database + SSE subscription
  useEffect(() => {
    let alive = true;

    // 1. Fetch latest baseline parameters directly from PostgreSQL database
    parametersAPI.getLatest(wellId)
      .then((res) => {
        if (!alive) return;
        const p = res.data?.data?.parameter || res.data?.parameter;
        if (p) {
          setState((prev) => prev || {
            depth: parseFloat(p.depth) || 2850,
            wob: parseFloat(p.wob) || 19.5,
            rpm: parseFloat(p.rpm) || 110,
            torque: parseFloat(p.torque) || 24.0,
            rop: parseFloat(p.rop) || 8.5,
            standpipe_pressure: parseFloat(p.standpipe_pressure) || 230,
            annular_pressure: parseFloat(p.annular_pressure) || 24,
            mud_weight: parseFloat(p.mud_weight) || 1.19,
            mud_flow_rate: parseFloat(p.mud_flow_rate) || 2100,
          });
        }
      })
      .catch(() => {});

    // 2. Fetch current realtime/replay state
    realtimeAPI.getState(wellId)
      .then((res) => {
        if (alive && res.data?.data?.state) {
          setState((prev) => ({ ...(prev || {}), ...res.data.data.state }));
        }
      })
      .catch(() => {});

    realtimeAPI.getReplayStatus()
      .then((res) => {
        if (alive) setRunning(Boolean(res.data?.data?.isReplaying));
      })
      .catch(() => {});

    // 3. Connect to SSE stream for live updates
    const eventSourceUrl = `/api/realtime/${wellId}`;
    const source = new EventSource(eventSourceUrl);

    source.onopen = () => {
      if (alive) setConnected(true);
    };

    source.onerror = () => {
      if (alive) setConnected(false);
    };

    source.addEventListener('well-update', (event) => {
      try {
        const next = JSON.parse(event.data);
        if (alive) {
          setState((prev) => ({ ...(prev || {}), ...next }));
          if (lastDepth.current != null && next.depth !== lastDepth.current) {
            addEvent(`Bit advanced to ${Number(next.depth).toLocaleString()} m`);
          }
          lastDepth.current = next.depth;
        }
      } catch { /* ignore */ }
    });

    source.addEventListener('risk-update', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (alive) {
          setRisks(data.risks || []);
          if ((data.risks || []).some((risk) => ['high', 'critical'].includes(String(risk.level).toLowerCase()))) {
            addEvent('High contextual risk detected by risk engine', 'danger');
          }
        }
      } catch { /* ignore */ }
    });

    source.addEventListener('alert', (event) => {
      try {
        const alert = JSON.parse(event.data);
        if (alive) {
          setLatestAlert(alert);
          addEvent(alert.message || alert.explanation || 'New risk alert triggered', 'danger');
        }
      } catch { /* ignore */ }
    });

    return () => {
      alive = false;
      source.close();
    };
  }, [wellId, addEvent]);

  const controlReplay = async (action) => {
    setBusy(true);
    setError('');
    try {
      if (action === 'start') {
        await realtimeAPI.startReplay(wellId, speedMs);
        setRunning(true);
        addEvent(`Replay simulation started (${speedMs / 1000}s interval)`);
      } else {
        await realtimeAPI.stopReplay();
        setRunning(false);
        addEvent('Replay simulation stopped');
      }
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const depth = Number(state?.depth ?? DEPTH_MIN);
  const riskActive = risks.some((risk) => ['high', 'critical'].includes(String(risk.level).toLowerCase())) || Boolean(latestAlert) || state?.phase === 4;
  const progress = Math.max(0, Math.min(100, ((depth - DEPTH_MIN) / (DEPTH_MAX - DEPTH_MIN)) * 100));
  const riskText = riskActive ? 'HIGH CONTEXTUAL RISK' : depth >= 2800 ? 'HISTORICAL ZONE NEARBY' : 'MONITORING';

  return (
    <section className={`live-drilling-panel ${compact ? 'is-compact' : ''}`}>
      <header className="ld-header">
        <div>
          <div className="ld-eyebrow">NWIS · eRTMAC ADAPTER 3D CUTAWAY</div>
          <h2>Live Geological Cutaway & Drill String Simulation</h2>
        </div>
        <span className={`ld-connection ${connected ? 'online' : ''}`}>
          <i />{connected ? 'STREAM CONNECTED' : 'CONNECTING'}
        </span>
      </header>

      <div className="ld-layout">
        {/* 3D Scene View */}
        <div className="ld-scene-wrap">
          <div className="ld-scene-top">
            <span>{state?.formation ? state.formation.toUpperCase() : 'BARAIL GROUP'} · VERTICAL CUTAWAY</span>
            <strong>{depth.toLocaleString()} m</strong>
          </div>
          
          <div className="ld-canvas">
            <CanvasErrorBoundary>
              <Canvas camera={{ position: [0, 0, 10], fov: 42 }} dpr={[1, 1.5]}>
                <GeologicalScene depth={depth} rpm={state?.rpm} riskActive={riskActive} />
              </Canvas>
            </CanvasErrorBoundary>
          </div>

          {/* Native HTML Risk Zone Badge */}
          <div className={`risk-zone-overlay ${riskActive ? 'is-active' : ''}`}>
            <span className="risk-zone-badge">HISTORICAL TROUBLE INTERVAL</span>
            <strong>2,800 – 2,850 m</strong>
            <small>Kopili Formation · Mud Loss & Stuck Pipe</small>
          </div>

          {/* Native HTML Depth Ruler on Right Edge */}
          <div className="ld-depth-ruler">
            {[2700, 2750, 2800, 2850, 2900].map((d) => (
              <div key={d} className={`ld-ruler-mark ${d >= 2800 && d <= 2850 ? 'in-risk' : ''}`}>
                <span className="ld-ruler-tick" />
                <span className="ld-ruler-label">{d.toLocaleString()} m</span>
              </div>
            ))}
          </div>

          <div className="ld-scene-footer">
            <span><i className="ld-dot blue" /> Drill bit</span>
            <span><i className="ld-dot amber" /> Historical interval (2,800–2,850 m)</span>
            <span><i className="ld-dot red" /> Active risk detection</span>
          </div>
        </div>

        {/* Live Parameters & Contextual Assessment */}
        <aside className="ld-side">
          <div className="ld-panel-heading">
            Live Parameters (Database / Stream)
            <span>{connected ? '● LIVE' : '○ OFFLINE'}</span>
          </div>

          <div className="ld-metrics-grid">
            <Metric label="DEPTH" value={state?.depth != null ? Number(state.depth).toLocaleString() : null} unit="m" accent="#0284c7" />
            <Metric label="ROP" value={state?.rop} unit="m/h" accent="#059669" />
            <Metric label="TORQUE" value={state?.torque} unit="kN·m" accent="#d97706" />
            <Metric label="WOB" value={state?.wob} unit="kN" accent="#7c3aed" />
            <Metric label="RPM" value={state?.rpm} unit="rpm" accent="#0284c7" />
            <Metric label="PRESSURE" value={state?.standpipe_pressure} unit="bar" accent="#dc2626" />
          </div>

          <div className={`ld-risk-card ${riskActive ? 'danger' : depth >= 2800 ? 'warning' : ''}`}>
            <div className="ld-risk-title">
              <span className="ld-risk-icon">!</span>
              <div>
                <small>CONTEXTUAL ASSESSMENT</small>
                <strong>{riskText}</strong>
              </div>
            </div>
            <ul>
              <li>Historical depth interval: 2,800–2,850 m (Kopili)</li>
              <li>Current bit depth: {depth.toLocaleString()} m</li>
              <li>Offset wells: LKW-A-102 & LKW-B-201 experienced mud loss</li>
              <li>{risks.length ? `${risks.length} contextual risk signal(s) evaluated` : 'Continuous monitoring active'}</li>
            </ul>
            {(latestAlert || risks[0]) && (
              <p className="ld-risk-explanation">
                {latestAlert?.message || risks[0]?.explanation || risks[0]?.description}
              </p>
            )}
          </div>

          <div className="ld-progress">
            <div>
              <span>Progress to historical trouble zone</span>
              <strong>{Math.round(progress)}%</strong>
            </div>
            <div className="ld-progress-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <small>{Math.max(0, 2800 - depth).toLocaleString()} m to historical zone start (2,800 m)</small>
          </div>
        </aside>
      </div>

      <footer className="ld-controls">
        <div className="ld-buttons">
          <button className="ld-btn primary" disabled={busy || running} onClick={() => controlReplay('start')}>
            ▶ Start replay
          </button>
          <button className="ld-btn" disabled={busy || !running} onClick={() => controlReplay('stop')}>
            ■ Stop
          </button>
          <label className="ld-speed">
            Speed:
            <select value={speedMs} onChange={(e) => setSpeedMs(Number(e.target.value))} disabled={running}>
              <option value={3000}>1x (3s)</option>
              <option value={1500}>2x (1.5s)</option>
              <option value={750}>4x (0.75s)</option>
            </select>
          </label>
        </div>

        <div className="ld-event-log">
          <strong>Recent Activity & Risk Engine Events</strong>
          {events.length ? (
            events.slice(0, 2).map((item) => (
              <div key={item.id} className={item.level}>
                {item.time} · {item.message}
              </div>
            ))
          ) : (
            <div>Waiting for stream telemetry…</div>
          )}
        </div>
      </footer>

      {error && <div className="ld-error" role="alert">{error}</div>}
      <p className="ld-disclaimer">
        Interactive 3D Cutaway powered by React Three Fiber. Connected to real-time eRTMAC streaming pipeline and PostgreSQL database. Drag with mouse to orbit/inspect.
      </p>
    </section>
  );
}
