// =============================================================================
// NWIS Backend — Parameter Service
// =============================================================================

const wellRepository = require('../repositories/well.repository');

const parameterService = {
  async getParameters(wellId, filters) {
    return await wellRepository.getParameters(wellId, filters);
  },

  async addParameter(paramData) {
    return await wellRepository.addParameter(paramData);
  },

  async addBatchParameters(wellId, parameters) {
    const results = [];
    for (const p of parameters) {
      const result = await wellRepository.addParameter({ ...p, well_id: wellId });
      results.push(result);
    }
    return results;
  },

  async getLatest(wellId) {
    return await wellRepository.getLatestParameters(wellId);
  },

  /**
   * Compute parameter trends (moving average, etc.) for a well.
   */
  async computeTrends(wellId, { fromDepth, toDepth, windowSize = 5 }) {
    const params = await wellRepository.getParameters(wellId, { fromDepth, toDepth, limit: 1000 });

    if (params.length < windowSize) {
      return { data: params, trends: null };
    }

    // Compute simple moving average for key parameters
    const movingAvg = (arr, key) => {
      const values = arr.map((p) => parseFloat(p[key]) || 0);
      const result = [];
      for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = values.slice(start, i + 1);
        result.push(window.reduce((a, b) => a + b, 0) / window.length);
      }
      return result;
    };

    const torqueTrend = movingAvg(params, 'torque');
    const ropTrend = movingAvg(params, 'rop');
    const wobTrend = movingAvg(params, 'wob');

    // Detect trend direction for latest window
    const isIncreasing = (arr) => {
      const last = arr.slice(-windowSize);
      return last[last.length - 1] > last[0];
    };

    return {
      data: params,
      trends: {
        torque: { values: torqueTrend, increasing: isIncreasing(torqueTrend) },
        rop: { values: ropTrend, increasing: isIncreasing(ropTrend) },
        wob: { values: wobTrend, increasing: isIncreasing(wobTrend) },
      },
    };
  },
};

module.exports = parameterService;
