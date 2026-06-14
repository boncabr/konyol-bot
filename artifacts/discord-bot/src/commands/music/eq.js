const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { errorEmbed, createEmbed } = require('../../utils/embeds');
const config = require('../../config/config');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// EQ BAND PRESETS
// ─────────────────────────────────────────────────────────────────────────────

const flat = () => Array.from({ length: 15 }, (_, i) => ({ band: i, gain: 0.0 }));

const PRESETS = {
  // ── Standard EQ ────────────────────────────────────────────────────────────
  flat: {
    label: 'Flat',
    emoji: '🎵',
    description: 'Reset semua filter ke normal',
    color: 0x95a5a6,
    style: ButtonStyle.Secondary,
    eq: flat(),
    timescale: null,
    rotation: null,
    vibrato: null,
    lowPass: null,
    special: null,
  },
  bass: {
    label: 'Bass Boost',
    emoji: '🔊',
    description: 'Sub bass & bass kuat — cocok untuk EDM, Hip-Hop',
    color: 0xe74c3c,
    style: ButtonStyle.Danger,
    eq: [
      { band: 0,  gain: 0.6  },
      { band: 1,  gain: 0.67 },
      { band: 2,  gain: 0.67 },
      { band: 3,  gain: 0.4  },
      { band: 4,  gain: 0.0  },
      { band: 5,  gain: -0.2 },
      { band: 6,  gain: -0.15},
      { band: 7,  gain: -0.1 },
      { band: 8,  gain: -0.1 },
      { band: 9,  gain: 0.0  },
      { band: 10, gain: 0.0  },
      { band: 11, gain: 0.0  },
      { band: 12, gain: 0.0  },
      { band: 13, gain: 0.0  },
      { band: 14, gain: 0.0  },
    ],
    timescale: null, rotation: null, vibrato: null, lowPass: null, special: null,
  },
  pop: {
    label: 'Pop / Vokal',
    emoji: '🎤',
    description: 'Vokal jernih & presence tinggi — cocok untuk Pop, K-Pop',
    color: 0xe91e8c,
    style: ButtonStyle.Primary,
    eq: [
      { band: 0,  gain: -0.1 },
      { band: 1,  gain: -0.1 },
      { band: 2,  gain: 0.0  },
      { band: 3,  gain: 0.1  },
      { band: 4,  gain: 0.2  },
      { band: 5,  gain: 0.3  },
      { band: 6,  gain: 0.25 },
      { band: 7,  gain: 0.15 },
      { band: 8,  gain: 0.2  },
      { band: 9,  gain: 0.25 },
      { band: 10, gain: 0.3  },
      { band: 11, gain: 0.25 },
      { band: 12, gain: 0.2  },
      { band: 13, gain: 0.1  },
      { band: 14, gain: 0.05 },
    ],
    timescale: null, rotation: null, vibrato: null, lowPass: null, special: null,
  },
  rock: {
    label: 'Rock',
    emoji: '🎸',
    description: 'Mid boost & crunch — cocok untuk Rock, Metal',
    color: 0xe67e22,
    style: ButtonStyle.Primary,
    eq: [
      { band: 0,  gain: 0.3  },
      { band: 1,  gain: 0.25 },
      { band: 2,  gain: 0.2  },
      { band: 3,  gain: 0.1  },
      { band: 4,  gain: -0.1 },
      { band: 5,  gain: -0.15},
      { band: 6,  gain: 0.0  },
      { band: 7,  gain: 0.2  },
      { band: 8,  gain: 0.25 },
      { band: 9,  gain: 0.2  },
      { band: 10, gain: 0.15 },
      { band: 11, gain: 0.1  },
      { band: 12, gain: 0.1  },
      { band: 13, gain: 0.05 },
      { band: 14, gain: 0.0  },
    ],
    timescale: null, rotation: null, vibrato: null, lowPass: null, special: null,
  },
  classical: {
    label: 'Classical',
    emoji: '🎹',
    description: 'Treble airy & detail — cocok untuk Klasik, Instrumental',
    color: 0x9b59b6,
    style: ButtonStyle.Primary,
    eq: [
      { band: 0,  gain: 0.0  },
      { band: 1,  gain: 0.0  },
      { band: 2,  gain: 0.0  },
      { band: 3,  gain: 0.0  },
      { band: 4,  gain: -0.1 },
      { band: 5,  gain: -0.1 },
      { band: 6,  gain: -0.05},
      { band: 7,  gain: 0.0  },
      { band: 8,  gain: 0.1  },
      { band: 9,  gain: 0.15 },
      { band: 10, gain: 0.2  },
      { band: 11, gain: 0.25 },
      { band: 12, gain: 0.3  },
      { band: 13, gain: 0.25 },
      { band: 14, gain: 0.2  },
    ],
    timescale: null, rotation: null, vibrato: null, lowPass: null, special: null,
  },
  lofi: {
    label: 'Lo-Fi',
    emoji: '🌊',
    description: 'Warm & mellow — cocok untuk Lo-Fi, Study, Chill',
    color: 0x1abc9c,
    style: ButtonStyle.Primary,
    eq: [
      { band: 0,  gain: 0.2  },
      { band: 1,  gain: 0.3  },
      { band: 2,  gain: 0.2  },
      { band: 3,  gain: 0.1  },
      { band: 4,  gain: 0.0  },
      { band: 5,  gain: -0.1 },
      { band: 6,  gain: -0.1 },
      { band: 7,  gain: -0.1 },
      { band: 8,  gain: -0.15},
      { band: 9,  gain: -0.2 },
      { band: 10, gain: -0.3 },
      { band: 11, gain: -0.35},
      { band: 12, gain: -0.35},
      { band: 13, gain: -0.3 },
      { band: 14, gain: -0.25},
    ],
    timescale: null, rotation: null, vibrato: null, lowPass: { smoothing: 20 }, special: null,
  },
  jazz: {
    label: 'Jazz',
    emoji: '🎷',
    description: 'Warm mids & no harsh highs — cocok untuk Jazz, Blues, Soul',
    color: 0xf39c12,
    style: ButtonStyle.Primary,
    eq: [
      { band: 0,  gain: 0.1  },
      { band: 1,  gain: 0.15 },
      { band: 2,  gain: 0.1  },
      { band: 3,  gain: 0.0  },
      { band: 4,  gain: 0.05 },
      { band: 5,  gain: 0.15 },
      { band: 6,  gain: 0.2  },
      { band: 7,  gain: 0.15 },
      { band: 8,  gain: 0.1  },
      { band: 9,  gain: 0.05 },
      { band: 10, gain: 0.0  },
      { band: 11, gain: -0.05},
      { band: 12, gain: -0.1 },
      { band: 13, gain: -0.1 },
      { band: 14, gain: -0.1 },
    ],
    timescale: null, rotation: null, vibrato: null, lowPass: null, special: null,
  },
  gaming: {
    label: 'Gaming',
    emoji: '🎮',
    description: 'High clarity & detail — cocok untuk soundtrack game',
    color: 0x2ecc71,
    style: ButtonStyle.Success,
    eq: [
      { band: 0,  gain: 0.15 },
      { band: 1,  gain: 0.1  },
      { band: 2,  gain: 0.0  },
      { band: 3,  gain: -0.1 },
      { band: 4,  gain: -0.1 },
      { band: 5,  gain: 0.0  },
      { band: 6,  gain: 0.1  },
      { band: 7,  gain: 0.15 },
      { band: 8,  gain: 0.2  },
      { band: 9,  gain: 0.25 },
      { band: 10, gain: 0.3  },
      { band: 11, gain: 0.25 },
      { band: 12, gain: 0.2  },
      { band: 13, gain: 0.15 },
      { band: 14, gain: 0.1  },
    ],
    timescale: null, rotation: null, vibrato: null, lowPass: null, special: null,
  },

  // ── Special Effects — Ciri Khas Reog Bot ────────────────────────────────────

  malam_minggu: {
    label: 'Malam Minggu',
    emoji: '🌃',
    description: '✨ Slow & hangat — feel malam Minggu bareng gebetan',
    color: 0x2c3e7a,
    style: ButtonStyle.Secondary,
    eq: [
      { band: 0,  gain: 0.2  },
      { band: 1,  gain: 0.3  },
      { band: 2,  gain: 0.2  },
      { band: 3,  gain: 0.1  },
      { band: 4,  gain: 0.0  },
      { band: 5,  gain: 0.1  },
      { band: 6,  gain: 0.15 },
      { band: 7,  gain: 0.1  },
      { band: 8,  gain: 0.05 },
      { band: 9,  gain: 0.0  },
      { band: 10, gain: -0.1 },
      { band: 11, gain: -0.15},
      { band: 12, gain: -0.15},
      { band: 13, gain: -0.1 },
      { band: 14, gain: -0.05},
    ],
    timescale: { speed: 0.92, pitch: 0.97, rate: 1.0 },
    rotation: null, vibrato: null, lowPass: { smoothing: 10 }, special: null,
  },
  audio_8d: {
    label: '8D Audio',
    emoji: '🎡',
    description: '✨ Berputar di telinga — pakai headset/earphone!',
    color: 0x8e44ad,
    style: ButtonStyle.Secondary,
    eq: [
      { band: 0,  gain: 0.0  },
      { band: 1,  gain: 0.0  },
      { band: 2,  gain: 0.0  },
      { band: 3,  gain: 0.0  },
      { band: 4,  gain: 0.0  },
      { band: 5,  gain: 0.0  },
      { band: 6,  gain: 0.0  },
      { band: 7,  gain: 0.1  },
      { band: 8,  gain: 0.1  },
      { band: 9,  gain: 0.05 },
      { band: 10, gain: 0.0  },
      { band: 11, gain: 0.0  },
      { band: 12, gain: 0.0  },
      { band: 13, gain: 0.0  },
      { band: 14, gain: 0.0  },
    ],
    timescale: null,
    rotation: { rotationHz: 0.2 },
    vibrato: null, lowPass: null, special: '🎡 Pakai headset/earphone untuk efek terbaik!',
  },
  nightcore: {
    label: 'Nightcore',
    emoji: '🚀',
    description: '✨ Speed up + pitch up — anime/EDM feel',
    color: 0x3498db,
    style: ButtonStyle.Secondary,
    eq: [
      { band: 0,  gain: 0.0  },
      { band: 1,  gain: 0.0  },
      { band: 2,  gain: 0.0  },
      { band: 3,  gain: -0.1 },
      { band: 4,  gain: -0.05},
      { band: 5,  gain: 0.0  },
      { band: 6,  gain: 0.05 },
      { band: 7,  gain: 0.1  },
      { band: 8,  gain: 0.15 },
      { band: 9,  gain: 0.2  },
      { band: 10, gain: 0.2  },
      { band: 11, gain: 0.15 },
      { band: 12, gain: 0.1  },
      { band: 13, gain: 0.05 },
      { band: 14, gain: 0.0  },
    ],
    timescale: { speed: 1.25, pitch: 1.25, rate: 1.0 },
    rotation: null, vibrato: null, lowPass: null, special: null,
  },
  ghost: {
    label: 'Ghost Mode',
    emoji: '👻',
    description: '✨ Pitch turun + gemetar — nuansa horror/misteri',
    color: 0x4a4a6a,
    style: ButtonStyle.Secondary,
    eq: [
      { band: 0,  gain: 0.3  },
      { band: 1,  gain: 0.2  },
      { band: 2,  gain: 0.1  },
      { band: 3,  gain: 0.0  },
      { band: 4,  gain: -0.1 },
      { band: 5,  gain: -0.1 },
      { band: 6,  gain: -0.05},
      { band: 7,  gain: 0.0  },
      { band: 8,  gain: -0.05},
      { band: 9,  gain: -0.1 },
      { band: 10, gain: -0.15},
      { band: 11, gain: -0.2 },
      { band: 12, gain: -0.2 },
      { band: 13, gain: -0.15},
      { band: 14, gain: -0.1 },
    ],
    timescale: { speed: 0.88, pitch: 0.75, rate: 1.0 },
    rotation: null,
    vibrato: { frequency: 4.0, depth: 0.65 },
    lowPass: null, special: null,
  },
  koplo: {
    label: 'Koplo Turbo',
    emoji: '🎭',
    description: '✨ Speed up + bass kenceng — feel Dangdut Koplo!',
    color: 0xc0392b,
    style: ButtonStyle.Secondary,
    eq: [
      { band: 0,  gain: 0.5  },
      { band: 1,  gain: 0.6  },
      { band: 2,  gain: 0.5  },
      { band: 3,  gain: 0.3  },
      { band: 4,  gain: 0.1  },
      { band: 5,  gain: 0.0  },
      { band: 6,  gain: 0.05 },
      { band: 7,  gain: 0.1  },
      { band: 8,  gain: 0.1  },
      { band: 9,  gain: 0.05 },
      { band: 10, gain: 0.0  },
      { band: 11, gain: 0.0  },
      { band: 12, gain: 0.0  },
      { band: 13, gain: 0.0  },
      { band: 14, gain: 0.0  },
    ],
    timescale: { speed: 1.18, pitch: 1.0, rate: 1.0 },
    rotation: null, vibrato: null, lowPass: null, special: null,
  },
  vaporwave: {
    label: 'Vaporwave',
    emoji: '💜',
    description: '✨ Slow + pitch turun — aesthetic retro 80s',
    color: 0x9b59b6,
    style: ButtonStyle.Secondary,
    eq: [
      { band: 0,  gain: 0.15 },
      { band: 1,  gain: 0.25 },
      { band: 2,  gain: 0.2  },
      { band: 3,  gain: 0.1  },
      { band: 4,  gain: 0.05 },
      { band: 5,  gain: 0.1  },
      { band: 6,  gain: 0.15 },
      { band: 7,  gain: 0.1  },
      { band: 8,  gain: 0.0  },
      { band: 9,  gain: -0.1 },
      { band: 10, gain: -0.2 },
      { band: 11, gain: -0.25},
      { band: 12, gain: -0.25},
      { band: 13, gain: -0.2 },
      { band: 14, gain: -0.15},
    ],
    timescale: { speed: 0.8, pitch: 0.85, rate: 1.0 },
    rotation: null, vibrato: null, lowPass: { smoothing: 15 }, special: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD BUTTON ROWS
// ─────────────────────────────────────────────────────────────────────────────

function buildEqRows() {
  const keys = Object.keys(PRESETS);
  const rows = [];
  for (let i = 0; i < keys.length; i += 5) {
    const chunk = keys.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(
      chunk.map((key) => {
        const p = PRESETS[key];
        return new ButtonBuilder()
          .setCustomId(`eq:${key}`)
          .setLabel(p.label)
          .setEmoji(p.emoji)
          .setStyle(p.style);
      })
    );
    rows.push(row);
  }
  return rows;
}

function buildEqMenuEmbed(currentPreset) {
  const lines = [];

  lines.push('**🎚️ Pilih preset EQ atau efek spesial dengan tombol di bawah!**\n');
  lines.push('**── Standard EQ ──**');
  for (const [key, p] of Object.entries(PRESETS)) {
    if (!p.special && !p.timescale && !p.rotation && !p.vibrato && key !== 'malam_minggu' && key !== 'lofi') {
      const active = currentPreset === key ? ' ◀ **aktif**' : '';
      lines.push(`${p.emoji} **${p.label}**${active} — ${p.description}`);
    }
  }

  lines.push('\n**── Efek Spesial 🌟 Ciri Khas Reog ──**');
  const specialKeys = ['malam_minggu', 'audio_8d', 'nightcore', 'ghost', 'koplo', 'vaporwave'];
  for (const key of specialKeys) {
    const p = PRESETS[key];
    const active = currentPreset === key ? ' ◀ **aktif**' : '';
    lines.push(`${p.emoji} **${p.label}**${active} — ${p.description}`);
  }

  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('🎛️ Reog EQ & Sound Effects')
    .setDescription(lines.join('\n'))
    .setFooter({ text: currentPreset ? `Preset aktif: ${PRESETS[currentPreset]?.label || currentPreset}` : 'Tekan tombol untuk memilih preset' })
    .setTimestamp();
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY PRESET
// ─────────────────────────────────────────────────────────────────────────────

async function applyPreset(player, presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) throw new Error(`Preset "${presetKey}" tidak ditemukan.`);

  const fm = player.filterManager;

  // Reset semua filter dulu sebelum apply preset baru
  try { await fm.resetFilters(); } catch (_) {}

  // Apply EQ bands
  if (preset.eq) await fm.setEQ(preset.eq);

  // Apply timescale (speed/pitch)
  if (preset.timescale) {
    await fm.setTimescale(preset.timescale);
  }

  // Apply rotation (8D Audio)
  if (preset.rotation) {
    await fm.setRotation(preset.rotation);
  }

  // Apply vibrato
  if (preset.vibrato) {
    await fm.setVibrato(preset.vibrato);
  }

  // Apply low pass
  if (preset.lowPass) {
    await fm.setLowPass(preset.lowPass);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUTTON HANDLER (dipanggil dari interactionCreate.js)
// ─────────────────────────────────────────────────────────────────────────────

async function handleEqButton(client, interaction) {
  const presetKey = interaction.customId.replace('eq:', '');
  const preset = PRESETS[presetKey];
  if (!preset) return interaction.reply({ content: '❌ Preset tidak dikenal.', ephemeral: true });

  const guildId = interaction.guild?.id;
  const player = guildId ? client.lavalink.getPlayer(guildId) : null;

  if (!player || (!player.playing && !player.paused)) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.colors.error).setDescription('❌ Tidak ada lagu yang sedang diputar.')],
      ephemeral: true,
    });
  }

  const member = interaction.member;
  if (!member?.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.colors.error).setDescription('❌ Kamu harus berada di voice channel yang sama dengan bot.')],
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    await applyPreset(player, presetKey);

    const isSpecial = ['malam_minggu', 'audio_8d', 'nightcore', 'ghost', 'koplo', 'vaporwave'].includes(presetKey);

    const embed = new EmbedBuilder()
      .setColor(preset.color)
      .setTitle(`${preset.emoji} ${preset.label} — Aktif!`)
      .setDescription(
        `✅ Preset **${preset.label}** berhasil diterapkan!\n\n` +
        `> ${preset.description}` +
        (preset.special ? `\n\n💡 ${preset.special}` : '') +
        (isSpecial ? '\n\n🌟 *Efek spesial ciri khas Reog Bot*' : '')
      )
      .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logger.info(`EQ preset "${presetKey}" applied in guild ${guildId} by ${interaction.user.tag}`);
  } catch (err) {
    logger.error(`EQ apply error: ${err.message}`);
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(config.colors.error).setDescription(`❌ Gagal menerapkan preset: ${err.message}`)],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND HANDLER
// ─────────────────────────────────────────────────────────────────────────────

async function handleEq(client, ctx) {
  const isInteraction = ctx.isChatInputCommand?.();
  const guildId = ctx.guild.id;

  const player = client.lavalink.getPlayer(guildId);
  if (!player || (!player.playing && !player.paused)) {
    const embed = new EmbedBuilder().setColor(config.colors.error)
      .setTitle('❌ Error').setDescription('Tidak ada lagu yang sedang diputar.');
    return isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] });
  }

  const member = ctx.member;
  if (!member.voice?.channelId || member.voice.channelId !== player.voiceChannelId) {
    const embed = new EmbedBuilder().setColor(config.colors.error)
      .setTitle('❌ Error').setDescription('Kamu harus berada di voice channel yang sama dengan bot.');
    return isInteraction
      ? ctx.reply({ embeds: [embed], ephemeral: true })
      : ctx.reply({ embeds: [embed] });
  }

  const menuEmbed = buildEqMenuEmbed(null);
  const rows = buildEqRows();

  return isInteraction
    ? ctx.reply({ embeds: [menuEmbed], components: rows })
    : ctx.reply({ embeds: [menuEmbed], components: rows });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  name: 'eq',
  description: 'Buka menu EQ & efek spesial dengan tombol interaktif',
  cooldown: config.cooldowns.default,
  handleEqButton,

  data: new SlashCommandBuilder()
    .setName('eq')
    .setDescription('Buka menu EQ & efek spesial dengan tombol interaktif'),

  async execute(client, ctx) {
    await handleEq(client, ctx);
  },
};
