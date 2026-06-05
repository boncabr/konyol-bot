const { SlashCommandBuilder } = require('discord.js');
const { getOrCreatePlayer, search, play, setRadioMode } = require('../../music/MusicManager');
const { successEmbed, errorEmbed, createEmbed } = require('../../utils/embeds');
const config = require('../../config/config');

// Detect platform label for display
function platformLabel(query) {
  if (/open\.spotify\.com/i.test(query)) return 'Spotify';
  if (/music\.apple\.com/i.test(query)) return 'Apple Music';
  if (/soundcloud\.com/i.test(query)) return 'SoundCloud';
  if (/youtube\.com|youtu\.be/i.test(query)) return 'YouTube';
  return null;
}

async function handlePlay(client, ctx, queryStr) {
  const isInteraction = ctx.isChatInputCommand?.();
  const member  = ctx.member;
  const channel = ctx.channel;

  if (!member.voice?.channelId) {
    const embed = errorEmbed('Kamu harus masuk ke voice channel terlebih dahulu.');
    return isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] });
  }

  const query = queryStr?.trim();
  if (!query) {
    const embed = errorEmbed('Tulis nama lagu atau URL yang ingin diputar.');
    return isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] });
  }

  // Respond immediately so user gets instant feedback
  if (isInteraction) await ctx.deferReply();

  try {
    // Disable radio mode when user plays a regular track
    setRadioMode(ctx.guild.id, false);

    const player = await getOrCreatePlayer(
      client,
      ctx.guild.id,
      member.voice.channelId,
      channel.id
    );

    const result = await search(player, query, isInteraction ? ctx.user : ctx.author);

    if (!result || result.loadType === 'error' || result.loadType === 'empty') {
      const embed = errorEmbed(
        `Tidak ada hasil untuk: **${query}**\n` +
        `Coba nama lagu yang berbeda atau tempel URL langsung.`
      );
      return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
    }

    let tracks = [];
    let description = '';
    const platform = platformLabel(query);
    const platformTag = platform ? ` *(${platform})*` : '';

    if (result.loadType === 'playlist') {
      tracks = result.tracks;
      const playlistName = result.playlist?.name || 'Playlist';
      description = `📋 Menambahkan **${tracks.length}** lagu dari playlist [${playlistName}](${query})${platformTag} ke antrean.`;
    } else {
      tracks = [result.tracks[0]];
      const track = tracks[0];
      description = `🎵 Menambahkan [**${track.info.title}**](${track.info.uri}) oleh **${track.info.author}**${platformTag} ke antrean.`;
    }

    await play(player, tracks);

    // 🔊 Bass + Vocal Boost default
    await player.filterManager.setEQ([
      { band: 0,  gain: 0.25 },
      { band: 1,  gain: 0.25 },
      { band: 2,  gain: 0.20 },
      { band: 3,  gain: 0.10 },
      { band: 4,  gain: 0.05 },
      { band: 5,  gain: 0.05 },
      { band: 6,  gain: 0.10 },
      { band: 7,  gain: 0.15 },  // Vokal boost
      { band: 8,  gain: 0.15 },  // Vokal boost
      { band: 9,  gain: 0.10 },
      { band: 10, gain: 0.05 },
      { band: 11, gain: 0.00 },
      { band: 12, gain: -0.05 },
      { band: 13, gain: -0.05 },
      { band: 14, gain: -0.05 },
    ]);

    const isNowPlaying = !player.queue.previous && player.queue.tracks.length <= tracks.length;
    const embed = createEmbed({
      color: config.colors.success,
      title: isNowPlaying ? '▶️ Sekarang Diputar' : '✅ Ditambahkan ke Antrean',
      description,
    });
    if (tracks[0]?.info?.artworkUrl) embed.setThumbnail(tracks[0].info.artworkUrl);

    return isInteraction ? ctx.editReply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
  } catch (err) {
    const errMsg = err.message || 'Gagal memutar lagu. Coba lagi.';
    const embed = errorEmbed(errMsg);
    return isInteraction
      ? ctx.editReply({ embeds: [embed] }).catch(() => {})
      : ctx.reply({ embeds: [embed] }).catch(() => {});
  }
}

module.exports = {
  name: 'play',
  description: 'Putar lagu dari YouTube, SoundCloud, Spotify, atau Apple Music',
  cooldown: config.cooldowns.play,
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Putar lagu atau playlist')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Nama lagu, atau URL (YouTube / SoundCloud / Spotify / Apple Music)')
        .setRequired(true)
    ),
  async execute(client, ctx, args) {
    const isInteraction = ctx.isChatInputCommand?.();
    const query = isInteraction ? ctx.options.getString('query') : args.join(' ');
    await handlePlay(client, ctx, query);
  },
};
