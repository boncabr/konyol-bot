const { useMainPlayer } = require('discord-player');

module.exports = {
    name: 'video',
    description: 'Memutar video dari link YouTube',
    voiceChannel: true,

    async execute({ message, args }) {
        const player = useMainPlayer();
        const url = args[0];
        
        if (!url) return message.reply('Harap masukkan URL video!');

        const queue = player.nodes.create(message.guild, {
            metadata: message.channel
        });

        try {
            if (!message.member.voice.channel) return message.reply('Kamu harus berada di voice channel!');
            await queue.connect(message.member.voice.channel);
            const track = await player.search(url, { requestedBy: message.author });
            await queue.play(track.tracks[0]);
            await message.reply(`Memutar video: ${track.tracks[0].title}`);
        } catch (e) {
            await message.reply('Gagal memutar video.');
        }
    },
};
