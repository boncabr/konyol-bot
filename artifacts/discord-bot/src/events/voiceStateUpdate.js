const logger = require('../utils/logger');
const { isRadioMode, setAutoplay, clearVoiceEmoji } = require('../music/MusicManager');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(client, oldState, newState) {
    try {
      const guildId = oldState.guild.id;
      const player  = client.lavalink.getPlayer(guildId);
      if (!player) return;

      const botId = client.user.id;

      // ── Bot was force-disconnected from VC ──────────────────────────────────
      if (oldState.id === botId && !newState.channelId) {
        logger.warn(`Bot was disconnected from voice in guild ${guildId} — scheduling reconnect`);

        // Reset semua filter EQ/efek ke default sebelum reconnect
        // (player yang sama akan digunakan kembali, jadi filter harus dibersihkan)
        try {
          const pCheck = client.lavalink.getPlayer(guildId);
          if (pCheck?.filterManager) {
            await pCheck.filterManager.resetFilters();
            logger.info(`Filters reset after force-disconnect in guild ${guildId}`);
          }
        } catch (resetErr) {
          logger.warn(`Filter reset after disconnect failed: ${resetErr.message}`);
        }

        // Matikan autoplay saat bot keluar dari VC
        setAutoplay(guildId, false);
        logger.debug(`Autoplay dimatikan karena bot keluar dari VC di guild ${guildId}`);
        // Reset emoji ke default saat bot keluar VC (force-disconnect)
        clearVoiceEmoji(guildId);

        // Try reconnect up to 3 times with back-off
        let attempts = 0;
        const tryReconnect = async () => {
          attempts++;
          try {
            const p = client.lavalink.getPlayer(guildId);
            if (!p) return; // player already destroyed

            if (!p.connected) {
              await p.connect();
              logger.info(`Auto-reconnected to voice in guild ${guildId} (attempt ${attempts})`);

              // Resume from last position if we know it
              if (!p.playing && p.queue.current) {
                try {
                  await p.play();
                  logger.info(`Resumed playback in guild ${guildId}`);
                } catch (resumeErr) {
                  logger.warn(`Could not resume playback: ${resumeErr.message}`);
                }
              }
            }
          } catch (err) {
            logger.error(`Auto-reconnect attempt ${attempts} failed: ${err.message}`);
            if (attempts < 3) {
              setTimeout(tryReconnect, attempts * 5000); // 5s, 10s, 15s
            } else {
              logger.error(`Giving up reconnect after ${attempts} attempts in guild ${guildId}`);
            }
          }
        };

        setTimeout(tryReconnect, 3000);
        return;
      }

      // ── Bot was moved to a different VC ─────────────────────────────────────
      if (oldState.id === botId && newState.channelId && oldState.channelId !== newState.channelId) {
        logger.info(`Bot moved to new channel ${newState.channelId} in guild ${guildId}`);
        if (player.voiceChannelId !== newState.channelId) {
          player.voiceChannelId = newState.channelId;
        }
        return;
      }

      // ── Humans left VC — previously would leave if empty; now we STAY by design ─
      if (!player.voiceChannelId) return;
      const voiceChannel = oldState.guild.channels.cache.get(player.voiceChannelId);
      if (!voiceChannel) return;

      const members = voiceChannel.members.filter((m) => !m.user.bot);
      if (members.size === 0) {
        // New behavior: always stay in VC unless explicitly told to leave via command
        logger.debug(`Voice channel empty in guild ${guildId} — staying as configured (no auto-leave)`);
        return;
      }
    } catch (err) {
      logger.error(`voiceStateUpdate error: ${err.message}`);
    }
  },
};
