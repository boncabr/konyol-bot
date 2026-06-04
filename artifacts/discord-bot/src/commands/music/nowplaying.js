const { SlashCommandBuilder } = require('discord.js');
const { nowPlayingEmbed, errorEmbed } = require('../../utils/embeds');

async function handleNowPlaying(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const player = client.lavalink.getPlayer(guildId);
  if (!player || !player.queue.current) {
    const embed = errorEmbed('Nothing is currently playing.');
    return isInteraction ? ctx.reply({ embeds: [embed], ephemeral: true }) : ctx.reply({ embeds: [embed] });
  }

  const embed = nowPlayingEmbed(player.queue.current, player);
  return isInteraction ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
}

module.exports = {
  name: 'nowplaying',
  description: 'Show the currently playing track',
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing track'),
  async execute(client, ctx) {
    await handleNowPlaying(client, ctx);
  },
};
