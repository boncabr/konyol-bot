const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { clearVoiceStatus, markIntentionalDisconnect } = require('../../music/MusicManager');

async function handleStop(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const player = client.lavalink.getPlayer(guildId);
  if (!player || (!player.playing && !player.paused)) {
    const embed = errorEmbed('There is nothing currently playing.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const member = ctx.member;
  if (!member.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
    const embed = errorEmbed('You must be in the same voice channel as the bot.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }
  // Simpan channel ID dan hapus status sebelum player dihancurkan.
  // Setelah destroy(), voiceChannelId bisa sudah tidak tersedia.
  const channelId = player.voiceChannelId;
  markIntentionalDisconnect(guildId);
  await clearVoiceStatus(client, guildId, channelId);
  await player.destroy();

  const embed = successEmbed('Stopped playback and cleared the queue.', 'â¹ Stopped');
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
