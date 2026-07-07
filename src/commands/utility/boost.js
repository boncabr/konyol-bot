const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../../utils/embeds');
const config = require('../../config/config');

module.exports = {
  name: 'boost',
  description: 'Tampilkan daftar member yang sedang boost server',
  data: new SlashCommandBuilder()
    .setName('boost')
    .setDescription('Tampilkan daftar member yang sedang boost server'),

  async execute(client, ctx) {
    const isInteraction = ctx.isChatInputCommand?.();
    const guild = ctx.guild;

    if (!guild) {
      const errEmbed = createEmbed({
        color: config.colors.error,
        title: '❌ Error',
        description: 'Command ini hanya bisa digunakan di server.',
      });
      return isInteraction ? ctx.reply({ embeds: [errEmbed] }) : ctx.reply({ embeds: [errEmbed] });
    }

    if (isInteraction) await ctx.deferReply();

    await guild.members.fetch();

    const boosters = guild.members.cache
      .filter(m => m.premiumSince)
      .sort((a, b) => {
        const countB = b.premiumSubscriptionCount ?? 1;
        const countA = a.premiumSubscriptionCount ?? 1;
        if (countB !== countA) return countB - countA;
        return (a.premiumSince?.getTime() ?? 0) - (b.premiumSince?.getTime() ?? 0);
      });

    if (boosters.size === 0) {
      const embed = createEmbed({
        color: 0xFF73FA,
        description: '<:emoji_8:1524086846165094570> Server boost active now!!!\n\nBelum ada member yang sedang boost server ini.',
        footer: `Total boost aktif: ${guild.premiumSubscriptionCount ?? 0}`,
      });
      return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
    }

    const boosterKeys = [...boosters.keys()];
    const list = boosterKeys.map((id, index) => {
      const m = boosters.get(id);
      const count = m.premiumSubscriptionCount ?? 1;
      const boostText = count > 1 ? ` **(x${count})**` : '';
      return `\`${index + 1}.\` ${m} (${m.user.username})${boostText}`;
    });

    const embed = createEmbed({
      color: 0xFF73FA,
      description: `<:emoji_8:1524086846165094570> Server boost active now!!!\n\n${list.join('\n')}`,
      footer: `Total boost aktif: ${guild.premiumSubscriptionCount ?? 0} • Total booster: ${boosters.size}`,
    });

    return isInteraction
      ? ctx.editReply({ embeds: [embed] })
      : ctx.reply({ embeds: [embed] });
  },
};
