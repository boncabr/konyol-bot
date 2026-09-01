const { SlashCommandBuilder } = require('discord.js');
const { nowPlayingEmbed, errorEmbed } = require('../../utils/embeds');
const { clearProgressInterval, registerProgressInterval } = require('../../utils/progressBar');

const UPDATE_INTERVAL_MS  = 15_000;   // refresh every 15 seconds
const MAX_DURATION_MS     = 10 * 60 * 1000; // stop auto-update after 10 minutes

async function handleNowPlaying(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const player = client.lavalink.getPlayer(guildId);
  if (!player || !player.queue.current) {
    const embed = errorEmbed('Tidak ada lagu yang sedang diputar.');
    return isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] });
  }

  // Send initial embed
  const initialEmbed = nowPlayingEmbed(player.queue.current, player);
  const sentMsg = await (isInteraction
    ? ctx.reply({ embeds: [initialEmbed], fetchReply: true })
    : ctx.reply({ embeds: [initialEmbed] }));

  if (!sentMsg) return;

  // Auto-update the progress bar every 15s
  clearProgressInterval(guildId);

  const intervalId = setInterval(async () => {
    try {
      const p = client.lavalink.getPlayer(guildId);
      if (!p || !p.queue.current || !p.playing) {
        clearProgressInterval(guildId);
        return;
      }
      const updated = nowPlayingEmbed(p.queue.current, p);
      await sentMsg.edit({ embeds: [updated] }).catch(() => clearProgressInterval(guildId));
    } catch {
      clearProgressInterval(guildId);
    }
  }, UPDATE_INTERVAL_MS);

  // Safety: stop after MAX_DURATION_MS regardless
  const timeoutId = setTimeout(() => clearProgressInterval(guildId), MAX_DURATION_MS);

  registerProgressInterval(guildId, intervalId, timeoutId);
}

module.exports = {
  name: 'nowplaying',
  description: 'Tampilkan lagu yang sedang diputar (progress bar otomatis update)',
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Tampilkan lagu yang sedang diputar'),
  async execute(client, ctx) {
    await handleNowPlaying(client, ctx);
  },
};
