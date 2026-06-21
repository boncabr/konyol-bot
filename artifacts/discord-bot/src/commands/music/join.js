const { SlashCommandBuilder } = require('discord.js');
const { getOrCreatePlayer } = require('../../music/MusicManager');
const { successEmbed, errorEmbed } = require('../../utils/embeds');

const joiningSet = new Set();

async function handleJoin(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const member = ctx.member;
  const guildId = ctx.guild.id;

  if (!member.voice?.channelId) {
    const embed = errorEmbed('Kamu harus masuk ke voice channel terlebih dahulu.');
    await (isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] })
    ).catch(() => {});
    return;
  }

  if (joiningSet.has(guildId)) return;
  joiningSet.add(guildId);
  setTimeout(() => joiningSet.delete(guildId), 3000);

  try {
    await getOrCreatePlayer(client, guildId, member.voice.channelId, ctx.channel.id);
    const embed = successEmbed(`Joined <#${member.voice.channelId}>.`, '🔊 Joined');
    await (isInteraction
      ? ctx.reply({ embeds: [embed] })
      : ctx.reply({ embeds: [embed] })
    ).catch(() => {});
  } catch (err) {
    const embed = errorEmbed(err.message || 'Gagal join voice channel.');
    await (isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] })
    ).catch(() => {});
  } finally {
    joiningSet.delete(guildId);
  }
}

module.exports = {
  name: 'join',
  description: 'Join voice channel kamu',
  data: new SlashCommandBuilder().setName('join').setDescription('Join voice channel kamu'),
  async execute(client, ctx) {
    await handleJoin(client, ctx);
  },
};
