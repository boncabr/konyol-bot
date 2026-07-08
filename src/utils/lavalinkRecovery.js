const logger = require('./logger');

const FAIL_THRESHOLD = 5;
const REDEPLOY_COOLDOWN_MS = 10 * 60 * 1000; // 10 menit

const failCounts = new Map();
let lastRedeployAt = 0;

async function triggerRailwayRedeploy() {
  const token = process.env.RAILWAY_TOKEN;
  const serviceId = process.env.RAILWAY_SERVICE_ID;

  if (!token || !serviceId) {
    logger.warn('[Recovery] RAILWAY_TOKEN atau RAILWAY_SERVICE_ID tidak diset — skip redeploy');
    return false;
  }

  const now = Date.now();
  if (now - lastRedeployAt < REDEPLOY_COOLDOWN_MS) {
    logger.warn('[Recovery] Redeploy cooldown aktif — skip');
    return false;
  }

  const query = `
    mutation {
      serviceInstanceRedeploy(serviceId: "${serviceId}")
    }
  `;

  try {
    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();
    if (data.errors) {
      logger.error(`[Recovery] Railway redeploy error: ${JSON.stringify(data.errors)}`);
      return false;
    }

    lastRedeployAt = now;
    logger.info('[Recovery] ✅ Railway redeploy berhasil dipicu');
    return true;
  } catch (err) {
    logger.error(`[Recovery] Railway redeploy fetch error: ${err.message}`);
    return false;
  }
}

async function handleNodeFailure(nodeId) {
  const count = (failCounts.get(nodeId) || 0) + 1;
  failCounts.set(nodeId, count);

  logger.warn(`[Recovery] Node [${nodeId}] gagal ${count}x`);

  if (count >= FAIL_THRESHOLD) {
    logger.error(`[Recovery] Node [${nodeId}] gagal ${count}x — memicu Railway redeploy...`);
    failCounts.set(nodeId, 0);
    await triggerRailwayRedeploy();
  }
}

function resetNodeFailCount(nodeId) {
  failCounts.set(nodeId, 0);
  logger.debug(`[Recovery] Node [${nodeId}] fail count direset`);
}

module.exports = { handleNodeFailure, resetNodeFailCount };
