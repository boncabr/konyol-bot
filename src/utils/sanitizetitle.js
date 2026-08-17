// util untuk membersihkan judul lagu supaya pencarian lirik lebih akurat
function sanitizeTitle(raw) {
  if (!raw || typeof raw !== 'string') return raw || '';

  let s = raw;

  // hapus konten dalam [] dan ()
  s = s.replace(/\[.*?\]|\(.*?\)/g, ' ');

  // hapus kata/kumpulan kata umum yang membuat noise
  s = s.replace(
    /\b(official music video|official video|music video|lyric video|lyrics|lyric|audio|video|hd|4k|upgrade|remastered|remaster(ed)?|feat\.|featuring|ft\.)\b/gi,
    ' '
  );

  // normalisasi beberapa karakter dash dan ganti multiple dash jadi single
  s = s.replace(/[–—―]+/g, '-');

  // ubah underscore/pipe menjadi spasi
  s = s.replace(/[_|]+/g, ' ');

  // ganti multiple whitespace jadi satu dan trim
  s = s.replace(/\s{2,}/g, ' ').trim();

  return s;
}

module.exports = { sanitizeTitle };
