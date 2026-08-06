const logger = require('./logger');

/**
 * lavalinkRecovery.js
 *
 * Tujuan file ini: melacak berapa kali suatu node gagal agar bisa
 * di-log dan di-reset saat node berhasil reconnect.
 *
 * PENTING: TIDAK ada Railway redeploy di sini.
 * Alasan: merestart bot TIDAK memperbaiki server Lavalink yang memang sedang mati.
 * Yang terjadi justru sebaliknya — semua user yang sedang putar musik terputus,
 * padahal bot sebenarnya masih bisa berjalan via node lain (fallback).
 *
 * Failover antar node ditangani oleh lavalink-client secara otomatis
 * berdasarkan retryAmount & retryDelay yang dikonfigurasi di LavalinkClient.js.
 */

// Threshold hanya untuk keperluan logging (bukan trigger redeploy)
const LOG_THRESHOLD = 5;

const failCounts = new Map();

async function handleNodeFailure(nodeId) {
  const count = (failCounts.get(nodeId) || 0) + 1;
  failCounts.set(nodeId, count);

  if (count <= LOG_THRESHOLD || count % 10 === 0) {
    logger.warn(`[Recovery] Node [${nodeId}] gagal ${count}x — lavalink-client akan retry otomatis.`);
  }

  // Tidak ada redeploy. Bot tetap jalan via node lain jika tersedia.
}

function resetNodeFailCount(nodeId) {
  const prev = failCounts.get(nodeId) || 0;
  if (prev > 0) {
    logger.info(`[Recovery] Node [${nodeId}] kembali terhubung setelah ${prev}x gagal — fail count direset.`);
  }
  failCounts.set(nodeId, 0);
}

module.exports = { handleNodeFailure, resetNodeFailCount };
