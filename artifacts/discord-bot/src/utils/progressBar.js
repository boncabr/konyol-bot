// Active progress bar intervals: guildId → { interval, timeout }
const activeIntervals = new Map();

function clearProgressInterval(guildId) {
  const entry = activeIntervals.get(guildId);
  if (entry) {
    clearInterval(entry.interval);
    clearTimeout(entry.timeout);
    activeIntervals.delete(guildId);
  }
}

function registerProgressInterval(guildId, intervalId, timeoutId) {
  clearProgressInterval(guildId); // clear any previous
  activeIntervals.set(guildId, { interval: intervalId, timeout: timeoutId });
}

module.exports = { clearProgressInterval, registerProgressInterval };
