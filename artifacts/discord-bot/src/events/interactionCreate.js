const { checkCooldown } = require('../utils/cooldown');
const { errorEmbed } = require('../utils/embeds');
const { handleCommandError } = require('../utils/errorHandler');
const { setAutoplay, getAutoplay } = require('../music/MusicManager');
const config = require('../config/config');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    // ── Slash commands ───────────────────────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const cooldownMs = command.cooldown ?? config.cooldowns.default;
    const { onCooldown, remaining } = checkCooldown(
      interaction.user.id,
      interaction.commandName,
      cooldownMs
    );

    if (onCooldown) {
      return interaction.reply({
        embeds: [errorEmbed(`Tunggu **${remaining}s** lagi sebelum menggunakan perintah ini.`)],
        ephemeral: true,
      });
    }

    // Matikan autoplay hanya jika user eksplisit memulai pemutaran baru atau menghentikan bot
    const AUTOPLAY_RESET_COMMANDS = ['play', 'stop', 'leave'];
    if (AUTOPLAY_RESET_COMMANDS.includes(interaction.commandName) && interaction.guild && getAutoplay(interaction.guild.id)) {
      setAutoplay(interaction.guild.id, false);
      logger.debug(`Autoplay dimatikan karena slash command "/${interaction.commandName}" di guild ${interaction.guild.id}`);
    }

    try {
      await command.execute(client, interaction);
    } catch (err) {
      await handleCommandError(interaction, err);
      logger.error(`Slash command error [${interaction.commandName}]: ${err.stack}`);
    }
  },
};
