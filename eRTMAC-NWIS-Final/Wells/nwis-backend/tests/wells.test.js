// =============================================================================
// NWIS Backend — Wells & Spatial Distance Tests
// =============================================================================

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { haversineDistance } = require('../src/utils/distance');
const { nearbyQuerySchema, createWellSchema } = require('../src/validators/well.validator');

describe('Wells Spatial & Validation', () => {
  test('Haversine distance calculation between Lakwa Field and Rudrasagar Field', () => {
    // NWIS-DEMO-01 (Lakwa): 26.7800, 94.2100
    // RDL-A-401 (Rudrasagar): 26.8050, 94.1900
    const distanceKm = haversineDistance(26.7800, 94.2100, 26.8050, 94.1900);

    // Distance should be approximately 3.4 km
    assert.ok(distanceKm > 2.5 && distanceKm < 4.5, `Expected ~3.4km, got ${distanceKm}`);
  });

  test('Haversine distance of identical coordinates is 0', () => {
    const dist = haversineDistance(26.7800, 94.2100, 26.7800, 94.2100);
    assert.strictEqual(dist, 0);
  });

  test('Nearby query validation enforces reasonable ranges', () => {
    const valid = nearbyQuerySchema.safeParse({ lat: '26.78', lon: '94.21', radius: '15' });
    assert.strictEqual(valid.success, true);
    assert.strictEqual(valid.data.radius, 15);

    const invalidLat = nearbyQuerySchema.safeParse({ lat: '150', lon: '94.21' });
    assert.strictEqual(invalidLat.success, false);
  });

  test('Create well schema requires name, coordinates', () => {
    const validWell = {
      well_name: 'TEST-WELL-01',
      field: 'Test Field',
      latitude: 26.78,
      longitude: 94.21,
      current_depth: 1500,
    };
    const res = createWellSchema.safeParse(validWell);
    assert.strictEqual(res.success, true);
  });
});
