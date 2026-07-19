const { useMainPlayer } = require('discord-player');
const lyricsFinder = require('lyrics-finder');

module.exports = {
    name: 'lyrics',
    description: 'Menampilkan lirik lagu yang sedang diputar',

    async execute({ message }) {
        const player = useMainPlayer();
        const queue = player.nodes.get(message.guild.id);

        if (!queue || !queue.currentTrack) {
            return message.reply('Tidak ada lagu yang sedang diputar saat ini.');
        }

        const trackTitle = queue.currentTrack.title;
        const trackArtist = queue.currentTrack.author; 

        try {
            const lyrics = await lyricsFinder(trackArtist, trackTitle) || await lyricsFinder(trackTitle);

            if (!lyrics) {
                return message.reply(`Lirik untuk lagu ${trackTitle} tidak ditemukan.`);
            }

            if (lyrics.length > 2000) {
                const chunks = lyrics.match(/(.|[\r\n]){1,1900}/g);
                for (const chunk of chunks) {
                    await message.channel.send(`\`\`\`${chunk}\`\`\``);
                }
            } else {
                await message.reply(`\`\`\`${lyrics}\`\`\``);
            }
        } catch (e) {
            console.error(e);
            message.reply('Terjadi kesalahan saat mencari lirik.');
        }
    },
};
