const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { setVoiceStatus } = require('../../music/MusicManager');

async function handleStop(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const player = client.lavalink.getPlayer(guildId);
  if (!player || !player.playing) {
    const embed = errorEmbed('There is nothing currently playing.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const member = ctx.member;
  if (!member.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
    const embed = errorEmbed('You must be in the same voice channel as the bot.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  // Hapus judul dari voice status sebelum player dihancurkan
await setVoiceStatus(client, guildId, player.voiceChannelId, '');
await player.destroy();

  const embed = successEmbed('Stopped playback and cleared the queue.', '⏹ Stopped');
  return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
}

module.exports = {
  name: 'stop',
  description: 'Stop playback and clear the queue',
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue'),

  async execute(client, ctx) {
    await handleStop(client, ctx);
  },
};
