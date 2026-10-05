// =============================================================================
// NWIS Backend — Drilling Replay Service (eRTMAC Simulator)
// =============================================================================
// 4-Phase drilling simulation for SIH 2026 live demonstrations.
// Simulates NWIS-DEMO-01 drilling through Lakwa Field, Assam-Arakan Basin.
//
// Idempotency:
//   - On start: snapshot initial depth, delete previous replay rows for the well.
//   - Parameter tags: additional_parameters->>'replay'='true'.
//   - Depth safety: depth never goes backwards during simulation.
//   - On stop or finish: restore well's current_depth to initial snapshot.
//   - Per-well Map: no module-level singletons; multiple wells can simulate independently.
//   - Deterministic generator: torque, ROP, SPP move together; realistic WOB & hook load.
// =============================================================================

const db = require('../config/database');
const wellRepository = require('../repositories/well.repository');
const realtimeService = require('./realtime.service');
const logger = require('../utils/logger');

// Deterministic pseudo-noise in range [-1, 1] for repeatable, realistic variations
function pseudoNoise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function deterministicJitter(base, pct = 0.02, seed = 0) {
  return +(base * (1 + pseudoNoise(seed) * pct)).toFixed(2);
}

// ─── Deterministic Frame Generation ──────────────────────────────────────────

function generatePhase1() {
  const frames = [];
  for (let d = 2700; d <= 2790; d += 5) {
    const progress = (d - 2700) / 90; // 0→1
    const s = d * 1.1;
    // Correlated: torque, rop, and standpipe pressure move together
    const load = (Math.sin(s * 0.1) + 1) / 2;

    frames.push({
      depth: d,
      formation: 'Kopili Formation',
      phase: 1,
      phase_label: 'Normal Drilling',
      wob: deterministicJitter(95 + progress * 15, 0.02, s + 1), // 95–110 kN (realistic 50-200 kN)
      rpm: deterministicJitter(115 - progress * 5, 0.02, s + 2), // 115–110 RPM
      torque: deterministicJitter(18 + progress * 2 + load * 2, 0.03, s + 3), // 18–22 kN·m
      rop: deterministicJitter(9.5 - progress * 1.0 + load * 1.5, 0.03, s + 4), // 8.5–11 m/hr
      mud_weight: deterministicJitter(1.18, 0.005, s + 5), // 1.18 sg, steady
      mud_flow_rate: deterministicJitter(2200, 0.01, s + 6), // 2200 L/min
      standpipe_pressure: deterministicJitter(215 + progress * 10 + load * 10, 0.02, s + 7), // 215–235 bar
      annular_pressure: deterministicJitter(22, 0.02, s + 8), // 22 bar
      hook_load: deterministicJitter(1200 - progress * 15, 0.02, s + 9), // 1200–1185 kN (realistic 800-1500 kN)
    });
  }
  return frames;
}

function generatePhase2() {
  const frames = [];
  for (let d = 2795; d <= 2830; d += 5) {
    const progress = (d - 2795) / 35; // 0→1
    const s = d * 1.3;
    const load = (Math.sin(s * 0.15) + 1) / 2;

    frames.push({
      depth: d,
      formation: 'Kopili Formation',
      phase: 2,
      phase_label: 'Approaching Historical Risk Zone',
      wob: deterministicJitter(112 + progress * 20, 0.02, s + 1), // 112–132 kN
      rpm: deterministicJitter(110 - progress * 10, 0.02, s + 2), // 110–100 RPM
      torque: deterministicJitter(22 + progress * 6 + load * 3, 0.03, s + 3), // 22–31 kN·m (creeping up)
      rop: deterministicJitter(8.5 - progress * 2.5 + load * 1.0, 0.03, s + 4), // 8.5–6.0 m/hr (slowing)
      mud_weight: deterministicJitter(1.19 + progress * 0.02, 0.005, s + 5), // 1.19–1.21 sg
      mud_flow_rate: deterministicJitter(2150 - progress * 80, 0.02, s + 6), // 2150–2070 L/min
      standpipe_pressure: deterministicJitter(230 + progress * 25 + load * 12, 0.02, s + 7), // 230–267 bar (rising)
      annular_pressure: deterministicJitter(25 + progress * 4, 0.03, s + 8), // 25–29 bar
      hook_load: deterministicJitter(1190 + progress * 30, 0.02, s + 9), // 1190–1220 kN (drag starting)
    });
  }
  return frames;
}

function generatePhase3() {
  const frames = [];
  for (let d = 2832; d <= 2845; d += 2) {
    const progress = (d - 2832) / 13; // 0→1
    const s = d * 1.7;
    const pressureSpike = Math.sin(progress * Math.PI * 3) * 15;

    frames.push({
      depth: d,
      formation: 'Kopili Formation',
      phase: 3,
      phase_label: 'Parameter Anomalies Developing',
      wob: deterministicJitter(135 + progress * 25, 0.03, s + 1), // 135–160 kN
      rpm: deterministicJitter(100 - progress * 20, 0.03, s + 2), // 100–80 RPM (struggling)
      torque: deterministicJitter(30 + progress * 14, 0.04, s + 3), // 30–44 kN·m (spiking)
      rop: deterministicJitter(6.0 - progress * 3.5, 0.04, s + 4), // 6.0–2.5 m/hr (tanking)
      mud_weight: deterministicJitter(1.21 + progress * 0.02, 0.005, s + 5), // 1.21–1.23 sg
      mud_flow_rate: deterministicJitter(2070 - progress * 220, 0.03, s + 6), // 2070–1850 L/min (losses)
      standpipe_pressure: deterministicJitter(260 + progress * 50 + pressureSpike, 0.03, s + 7), // 260–325 bar (volatile)
      annular_pressure: deterministicJitter(30 + progress * 10, 0.04, s + 8), // 30–40 bar
      hook_load: deterministicJitter(1230 + progress * 90, 0.03, s + 9), // 1230–1320 kN (overpull/drag)
    });
  }
  return frames;
}

function generatePhase4() {
  const frames = [];
  for (let d = 2846; d <= 2860; d += 1) {
    const progress = (d - 2846) / 14; // 0→1
    const s = d * 2.1;
    const torqueSurge = progress > 0.6 ? (progress - 0.6) * 16 : 0;
    const pressureSurge = progress > 0.5 ? (progress - 0.5) * 35 : 0;

    frames.push({
      depth: d,
      formation: 'Kopili Formation',
      phase: 4,
      phase_label: 'NWIS Contextual Risk Detected',
      wob: deterministicJitter(160 + progress * 25, 0.03, s + 1), // 160–185 kN
      rpm: deterministicJitter(80 - progress * 20, 0.03, s + 2), // 80–60 RPM (near stall)
      torque: deterministicJitter(44 + progress * 12 + torqueSurge, 0.04, s + 3), // 44–60+ kN·m (critical spike)
      rop: deterministicJitter(2.5 - progress * 1.8, 0.05, s + 4), // 2.5–0.7 m/hr (near zero)
      mud_weight: deterministicJitter(1.23 + progress * 0.02, 0.005, s + 5), // 1.23–1.25 sg
      mud_flow_rate: deterministicJitter(1850 - progress * 300, 0.04, s + 6), // 1850–1550 L/min (significant losses)
      standpipe_pressure: deterministicJitter(310 + progress * 55 + pressureSurge, 0.04, s + 7), // 310–380+ bar
      annular_pressure: deterministicJitter(40 + progress * 15, 0.04, s + 8), // 40–55 bar
      hook_load: deterministicJitter(1320 + progress * 140, 0.03, s + 9), // 1320–1460 kN (high overpull)
    });
  }
  return frames;
}

function getSimulationFrames() {
  return [
    ...generatePhase1(),
    ...generatePhase2(),
    ...generatePhase3(),
    ...generatePhase4(),
  ];
}

// ─── Per-Well Active Replays Map (replaces module-level globals) ──────────────
const activeReplays = new Map();

const replayService = {
  /**
   * Start or restart the 4-phase drilling simulation for a specific well.
   * @param {string} [wellId='b1000000-0000-0000-0000-000000000001']
   * @param {number} [speedMs=3000]
   */
  async start(wellId = 'b1000000-0000-0000-0000-000000000001', speedMs = 3000) {
    // If already running for this well, stop existing simulation cleanly first
    if (activeReplays.has(wellId)) {
      await this.stop(wellId);
    }

    // 1. Snapshot initial current_depth
    let initialDepth = 2850;
    try {
      const well = await wellRepository.findById(wellId);
      if (well && well.current_depth != null) {
        initialDepth = parseFloat(well.current_depth);
      }
    } catch (err) {
      logger.warn({ err: err.message, wellId }, 'Could not read initial well depth, using fallback');
    }

    // 2. Delete prior replay rows for idempotency
    try {
      const delRes = await db.query(
        `DELETE FROM drilling_parameters 
         WHERE well_id = $1 AND additional_parameters->>'replay' = 'true'`,
        [wellId]
      );
      logger.info({ wellId, deletedRows: delRes.rowCount }, 'Cleaned previous replay rows');
    } catch (err) {
      logger.warn({ err: err.message, wellId }, 'Failed to delete previous replay rows');
    }

    const frames = getSimulationFrames();

    const replaySession = {
      wellId,
      initialDepth,
      speedMs,
      frames,
      currentFrameIndex: 0,
      isReplaying: true,
      isTickRunning: false,
      interval: null,
    };

    activeReplays.set(wellId, replaySession);

    logger.info({ wellId, speedMs, totalFrames: frames.length, initialDepth }, 'Starting idempotent 4-phase replay');

    replaySession.interval = setInterval(async () => {
      const session = activeReplays.get(wellId);
      if (!session || !session.isReplaying || session.isTickRunning) return;

      session.isTickRunning = true;
      try {
        if (!session.isReplaying) return;

        if (session.currentFrameIndex >= session.frames.length) {
          logger.info({ wellId }, 'Drilling simulation completed all 4 phases');
          await this.stop(wellId);
          return;
        }

        const frame = session.frames[session.currentFrameIndex];
        session.currentFrameIndex++;

        // Log phase transitions
        if (session.currentFrameIndex === 1 || session.frames[session.currentFrameIndex - 2]?.phase !== frame.phase) {
          logger.info({
            wellId,
            phase: frame.phase,
            label: frame.phase_label,
            depth: frame.depth,
            formation: frame.formation,
          }, `═══ PHASE ${frame.phase} STARTED ═══`);
        }

        if (!session.isReplaying) return;

        // Feed frame with tagged replay metadata
        await realtimeService.updateState(wellId, {
          ...frame,
          timestamp: new Date().toISOString(),
          isReplay: true,
          additional_parameters: { replay: 'true' },
        });

        if (!session.isReplaying) return;

        // Check contextual risk triggers
        await realtimeService.checkRiskTriggers(wellId, frame.depth);
      } catch (err) {
        logger.warn({ err: err.message, frame: session.currentFrameIndex, wellId }, 'Error in simulation tick');
      } finally {
        session.isTickRunning = false;
      }
    }, speedMs);

    return {
      status: 'started',
      wellId,
      speedMs,
      initialDepth,
      totalFrames: frames.length,
      phases: [
        { phase: 1, label: 'Normal Drilling', depthRange: '2700–2790m', formation: 'Kopili Formation' },
        { phase: 2, label: 'Approaching Risk Zone', depthRange: '2795–2830m', formation: 'Kopili Formation' },
        { phase: 3, label: 'Parameter Anomalies', depthRange: '2832–2845m', formation: 'Kopili Formation' },
        { phase: 4, label: 'Risk Detection', depthRange: '2846–2860m', formation: 'Kopili Formation' },
      ],
    };
  },

  /**
   * Stop the simulation for a specific well and restore initial depth.
   * @param {string} [wellId='b1000000-0000-0000-0000-000000000001']
   */
  async stop(wellId = 'b1000000-0000-0000-0000-000000000001') {
    const session = activeReplays.get(wellId);
    let lastFrame = 0;

    if (session) {
      session.isReplaying = false;
      if (session.interval) {
        clearInterval(session.interval);
        session.interval = null;
      }

      // Await in-flight tick to ensure it finishes before restoring depth
      while (session.isTickRunning) {
        await new Promise((r) => setTimeout(r, 10));
      }

      lastFrame = session.currentFrameIndex;

      // Restore snapshotted well depth on finish/stop so depth is preserved
      if (session.initialDepth != null) {
        try {
          await wellRepository.update(wellId, { current_depth: session.initialDepth });
          logger.info({ wellId, restoredDepth: session.initialDepth }, 'Restored initial well depth');
        } catch (err) {
          logger.warn({ err: err.message, wellId }, 'Failed to restore well depth');
        }
      }

      activeReplays.delete(wellId);
      logger.info({ wellId, stoppedAt: lastFrame }, 'Drilling simulation session stopped');
    }

    return { status: 'stopped', wellId, lastFrame };
  },

  /**
   * Get current simulation status with phase info for a well.
   * @param {string} [wellId='b1000000-0000-0000-0000-000000000001']
   */
  getStatus(wellId = 'b1000000-0000-0000-0000-000000000001') {
    const session = activeReplays.get(wellId);
    const frames = session?.frames || getSimulationFrames();
    const currentFrameIndex = session?.currentFrameIndex || 0;
    const frame = currentFrameIndex > 0 ? frames[currentFrameIndex - 1] : null;

    return {
      isReplaying: Boolean(session?.isReplaying),
      wellId,
      currentFrameIndex,
      totalFrames: frames.length,
      progress: frames.length > 0 ? Math.round((currentFrameIndex / frames.length) * 100) : 0,
      currentPhase: frame?.phase || null,
      currentPhaseLabel: frame?.phase_label || null,
      currentDepth: frame?.depth || null,
      currentFormation: frame?.formation || null,
      currentFrame: frame || null,
    };
  },
};

module.exports = replayService;
