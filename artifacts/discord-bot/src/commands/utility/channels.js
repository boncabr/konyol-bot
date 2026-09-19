const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');
const { activeVoiceChannels, MAX_VOICE_CHANNELS } = require('../../music/MusicManager');
const config = require('../../config/config');

module.exports = {
  name: 'channels',
  description: 'Show active voice channels the bot is currently in',
  data: new SlashCommandBuilder()
    .setName('channels')
    .setDescription('Show active voice channels the bot is currently in'),

  async execute(client, ctx) {
    const isInteraction = ctx.isChatInputCommand?.();

    const active = [...activeVoiceChannels];
    const lines = [];

    for (const guildId of active) {
      const player = client.lavalink.getPlayer(guildId);
      if (!player) continue;

      const guild = client.guilds.cache.get(guildId);
      const guildName = guild?.name || `Guild ${guildId}`;
      const voiceChannel = guild?.channels.cache.get(player.voiceChannelId);
      const channelName = voiceChannel?.name || `Channel ${player.voiceChannelId}`;
      const track = player.queue.current;
      const trackName = track ? `🎵 ${track.info.title}` : '⏹ Idle';

      lines.push(`**${guildName}** — #${channelName}\n↳ ${trackName}`);
    }

    const description =
      lines.length > 0
        ? lines.join('\n\n')
        : 'Bot tidak aktif di voice channel manapun saat ini.';

    const embed = createEmbed({
      color: config.colors.primary,
      title: `🔊 Active Voice Channels (${active.length}/${MAX_VOICE_CHANNELS})`,
      description,
      footer: `Maksimal ${MAX_VOICE_CHANNELS} voice channel aktif secara bersamaan`,
    });

    return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  },
};
