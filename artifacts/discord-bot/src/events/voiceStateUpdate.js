const logger = require('../utils/logger');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(client, oldState, newState) {
    try {
      const player = client.lavalink.getPlayer(oldState.guild.id);
      if (!player) return;

      const botId = client.user.id;

      if (oldState.id === botId && !newState.channelId) {
        logger.debug(`Bot was disconnected from voice in guild ${oldState.guild.id}`);
        setTimeout(async () => {
          try {
            const p = client.lavalink.getPlayer(oldState.guild.id);
            if (p && !p.connected && p.queue.tracks.length > 0) {
              await p.connect();
              logger.info(`Auto-reconnected to voice in guild ${oldState.guild.id}`);
            }
          } catch (err) {
            logger.error(`Auto-reconnect failed: ${err.message}`);
          }
        }, 3000);
        return;
      }

      if (!player.voiceChannelId) return;
      const voiceChannel = oldState.guild.channels.cache.get(player.voiceChannelId);
      if (!voiceChannel) return;

      const members = voiceChannel.members.filter((m) => !m.user.bot);
      if (members.size === 0) {
        logger.debug(`Voice channel empty in guild ${oldState.guild.id} — scheduling leave`);
        setTimeout(async () => {
          const p = client.lavalink.getPlayer(oldState.guild.id);
          if (!p) return;
          const ch = oldState.guild.channels.cache.get(p.voiceChannelId);
          const still = ch?.members.filter((m) => !m.user.bot).size ?? 0;
          if (still === 0) {
            await p.destroy();
            logger.info(`Left empty voice channel in guild ${oldState.guild.id}`);
          }
        }, 30000);
      }
    } catch (err) {
      logger.error(`voiceStateUpdate error: ${err.message}`);
    }
  },
};
