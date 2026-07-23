const logger = require('./logger');
const { errorEmbed } = require('./embeds');

async function handleCommandError(interaction, error, isPrefix = false) {
  logger.error(`Command error: ${error.stack || error.message}`);

  const embed = errorEmbed(
    error.message || 'An unexpected error occurred. Please try again.',
    '❌ Command Error'
  );

  try {
    if (isPrefix) {
      if (interaction.channel) {
        await interaction.channel.send({ embeds: [embed] });
      }
    } else if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (replyErr) {
    logger.error(`Failed to send error reply: ${replyErr.message}`);
  }
}

function setupAntiCrash(client) {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}\nReason: ${reason?.stack || reason}`);
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.stack || error.message}`);
  });

  process.on('uncaughtExceptionMonitor', (error) => {
    logger.error(`Uncaught Exception Monitor: ${error.stack || error.message}`);
  });

  process.on('warning', (warning) => {
    logger.warn(`Process Warning: ${warning.name} - ${warning.message}`);
  });

  if (client) {
    client.on('error', (error) => {
      logger.error(`Discord client error: ${error.stack || error.message}`);
    });

    client.on('warn', (info) => {
      logger.warn(`Discord client warn: ${info}`);
    });

    client.on('shardError', (error) => {
      logger.error(`Shard error: ${error.stack || error.message}`);
    });
  }

  logger.info('Anti-crash system initialized');
}

module.exports = { handleCommandError, setupAntiCrash };