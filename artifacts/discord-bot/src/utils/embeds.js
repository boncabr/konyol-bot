const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

function createEmbed(options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || config.colors.primary)
    .setTimestamp();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.footer) embed.setFooter({ text: options.footer });
  if (options.fields) embed.addFields(options.fields);
  if (options.url) embed.setURL(options.url);

  return embed;
}

function successEmbed(description, title = null) {
  return createEmbed({
    color: config.colors.success,
    title: title || '✅ Success',
    description,
  });
}

function errorEmbed(description, title = null) {
  return createEmbed({
    color: config.colors.error,
    title: title || '❌ Error',
    description,
  });
}

function warningEmbed(description, title = null) {
  return createEmbed({
    color: config.colors.warning,
    title: title || '⚠️ Warning',
    description,
  });
}

function nowPlayingEmbed(track, player) {
  const info = track.info;
  const position = player.position || 0;
  const duration = info.isStream ? '∞' : formatDuration(info.duration);
  const current = info.isStream ? '🔴 LIVE' : formatDuration(position);

  const progressBar = info.isStream
    ? '🔴 ▬▬▬▬▬▬▬▬▬▬ LIVE'
    : createProgressBar(position, info.duration);

  const embed = createEmbed({
    color: config.colors.primary,
    title: '🎵 Now Playing',
    description: `**[${info.title}](${info.uri})**\nby **${info.author}**`,
    thumbnail: info.artworkUrl || info.thumbnail || null,
    fields: [
      {
        name: '⏱ Progress',
        value: `${current} ${progressBar} ${duration}`,
        inline: false,
      },
      { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
      { name: '🔁 Loop', value: player.repeatMode !== 'off' ? `${player.repeatMode}` : 'Off', inline: true },
      {
        name: '📋 Queue',
        value: player.queue.tracks.length > 0 ? `${player.queue.tracks.length} track(s) remaining` : 'Empty',
        inline: true,
      },
    ],
    footer: `Requested by ${info.requester?.username || 'Unknown'}`,
  });

  return embed;
}

function queueEmbed(player, page = 1) {
  const tracks = player.queue.tracks;
  const current = player.queue.current;
  const pageSize = 10;
  const totalPages = Math.ceil(tracks.length / pageSize) || 1;
  const validPage = Math.min(Math.max(page, 1), totalPages);
  const start = (validPage - 1) * pageSize;
  const end = start + pageSize;
  const slice = tracks.slice(start, end);

  const description = current
    ? `**Now Playing:**\n[${current.info.title}](${current.info.uri}) — ${current.info.author}\n\n**Up Next:**`
    : '**Queue is empty**';

  const queueList =
    slice.length > 0
      ? slice
          .map(
            (t, i) =>
              `\`${start + i + 1}.\` [${t.info.title}](${t.info.uri}) — ${t.info.author}`
          )
          .join('\n')
      : 'No tracks in queue';

  return createEmbed({
    color: config.colors.primary,
    title: '📋 Music Queue',
    description: `${description}\n${queueList}`,
    footer: `Page ${validPage}/${totalPages} • ${tracks.length} track(s) total`,
  });
}

function createProgressBar(current, total, length = 15) {
  if (!total) return '▬'.repeat(length);
  const progress = Math.floor((current / total) * length);
  const filled = '▬'.repeat(Math.min(progress, length));
  const empty = '▬'.repeat(Math.max(length - progress - 1, 0));
  return `${filled}🔘${empty}`;
}

function formatDuration(ms) {
  if (!ms || ms === Infinity) return '00:00';
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

module.exports = {
  createEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  nowPlayingEmbed,
  queueEmbed,
  formatDuration,
  createProgressBar,
};
