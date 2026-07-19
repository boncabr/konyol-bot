const { useMainPlayer } = require('discord-player');

module.exports = {
    name: 'video',
    description: 'Memutar video dari link YouTube',
    voiceChannel: true,

    async execute({ interaction }) {
        const player = useMainPlayer();
        const url = interaction.options.getString('url');
        
        if (!url) return interaction.reply('Harap masukkan URL video!');

        const queue = player.nodes.create(interaction.guild, {
            metadata: interaction.channel
        });

        try {
            if (!interaction.member.voice.channel) await queue.connect(interaction.member.voice.channel);
            const track = await player.search(url, { requestedBy: interaction.user });
            await queue.play(track.tracks[0]);
            await interaction.reply(`Memutar video: ${track.tracks[0].title}`);
        } catch (e) {
            await interaction.reply('Gagal memutar video.');
        }
    },
};
