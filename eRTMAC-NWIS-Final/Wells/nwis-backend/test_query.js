const db = require('./src/config/database');
const riskService = require('./src/services/risk.service');

async function test() {
  try {
    console.log('Testing riskService.evaluate...');
    const evalRes = await riskService.evaluate('b1000000-0000-0000-0000-000000000001', 2850);
    console.log('evaluate returned:', evalRes.risks.length, 'risks');
    console.log('evaluate risks:', evalRes.risks.map(r => ({ type: r.risk_type, score: r.score, ev: r.evidence.length })));

    console.log('\nTesting riskService.getActiveRisks...');
    const active = await riskService.getActiveRisks('b1000000-0000-0000-0000-000000000001');
    console.log('getActiveRisks returned:', active.length, 'risks');
    console.log('active risks:', active.map(r => ({ type: r.risk_type, score: r.score, ev: (r.evidence||[]).length })));
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    process.exit(0);
  }
}
test();
