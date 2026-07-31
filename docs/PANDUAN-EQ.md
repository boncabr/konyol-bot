# 🎚️ Panduan EQ Default: Bass Nendang Smooth

Fitur ini membuat bot otomatis memutar musik dengan bass yang nendang namun tetap smooth dan enak di telinga, tanpa perlu command apapun dari user.

---

## Cara Kerja

- Setiap kali bot **join voice channel**, EQ bass smooth otomatis aktif
- Saat user ketik `?filter off` atau `/filter off`, EQ **kembali ke bass smooth** (bukan benar-benar kosong)
- Saat bot **leave** lalu join lagi, EQ otomatis aktif kembali

---

## Kurva EQ

```
Gain
+0.25 |        ██ ██
+0.20 |     ██ ██ ██
+0.15 |  ██ ██       ██
+0.10 |  ██
+0.05 |                    ░░ ░░ ░░ ░░
 0.00 |                 ░░          ░░
-0.05 |                    ██ ██ ██
      └──────────────────────────────
       25  40  63 100 160 250 400 630 1k 1.6k 2.5k 4k 6k 10k 16k Hz
```

| Band | Hz | Gain | Keterangan |
|------|----|------|------------|
| 0 | 25Hz | +0.08 | Sub rumble halus |
| 1 | 40Hz | +0.13 | Sub-bass |
| 2 | 63Hz | +0.22 | **NENDANG** — body kick drum |
| 3 | 100Hz | +0.22 | **NENDANG** — bass guitar fundamental |
| 4 | 160Hz | +0.12 | Upper bass, transisi mulus |
| 5 | 250Hz | +0.03 | Sedikit saja |
| 6 | 400Hz | -0.04 | Potong boxy |
| 7 | 630Hz | -0.05 | Potong zona lumpur/muddy |
| 8 | 1kHz | -0.04 | Smooth |
| 9 | 1.6kHz | 0.00 | Netral |
| 10 | 2.5kHz | +0.03 | Vokal sedikit lebih hadir |
| 11 | 4kHz | +0.05 | Detail instrumen |
| 12 | 6.3kHz | +0.05 | Udara, balance treble |
| 13 | 10kHz | +0.04 | Sedikit airy |
| 14 | 16kHz | 0.00 | Netral |

---

## ❌ Cara Mematikan / Mengembalikan ke Semula

### File 1: `src/music/MusicManager.js`

**Hapus** blok ini (dari atas file, sebelum `const autoplayMap`):
```js
// ─── Default EQ: Bass Nendang Smooth ─────────
const DEFAULT_EQ = [
  { band: 0,  gain:  0.08  },
  ...
  { band: 14, gain:  0.00  },
];

async function applyDefaultEQ(player) {
  try {
    await player.filterManager.setEqualizer(DEFAULT_EQ);
    logger.debug('[EQ] Default bass-smooth EQ diterapkan.');
  } catch (e) {
    logger.warn('[EQ] Gagal terapkan default EQ: ' + e.message);
  }
}
// ────────────────────────────────────────────
```

**Hapus** baris ini (di dalam `getOrCreatePlayer`):
```js
const isNewPlayer = !client.lavalink.getPlayer(guildId);
```

**Hapus** blok ini (di dalam `if (!player.connected)`):
```js
    if (isNewPlayer) {
      await applyDefaultEQ(player);
    }
```

**Hapus** dari `module.exports`:
```js
  DEFAULT_EQ,
```

### File 2: `src/commands/music/filter.js`

**Hapus** baris paling atas:
```js
const { DEFAULT_EQ } = require('../../music/MusicManager');
```

**Hapus** baris di `FILTERS.off.apply`:
```js
      await player.filterManager.setEqualizer(DEFAULT_EQ);
```

Commit dengan pesan: `revert: hapus default EQ bass smooth`

---

## ✅ Cara Menerapkan Kembali

### File 1: `src/music/MusicManager.js`

Cari baris:
```js
const autoplayMap = new Map();
```
Tambahkan **tepat di atasnya**:
```js
// ─── Default EQ: Bass Nendang Smooth ─────────────────────────────────────────
const DEFAULT_EQ = [
  { band: 0,  gain:  0.08  }, // 25Hz   — sub rumble halus
  { band: 1,  gain:  0.13  }, // 40Hz   — sub-bass
  { band: 2,  gain:  0.22  }, // 63Hz   — NENDANG: body kick drum
  { band: 3,  gain:  0.22  }, // 100Hz  — NENDANG: bass guitar fundamental
  { band: 4,  gain:  0.12  }, // 160Hz  — upper bass, transisi mulus
  { band: 5,  gain:  0.03  }, // 250Hz  — sedikit saja, jangan muddy
  { band: 6,  gain: -0.04  }, // 400Hz  — potong boxy
  { band: 7,  gain: -0.05  }, // 630Hz  — potong zona lumpur
  { band: 8,  gain: -0.04  }, // 1kHz   — smooth
  { band: 9,  gain:  0.00  }, // 1.6kHz — netral
  { band: 10, gain:  0.03  }, // 2.5kHz — vokal sedikit lebih hadir
  { band: 11, gain:  0.05  }, // 4kHz   — detail instrumen
  { band: 12, gain:  0.05  }, // 6.3kHz — udara, balance treble
  { band: 13, gain:  0.04  }, // 10kHz  — sedikit airy
  { band: 14, gain:  0.00  }, // 16kHz  — netral
];

async function applyDefaultEQ(player) {
  try {
    await player.filterManager.setEqualizer(DEFAULT_EQ);
    logger.debug('[EQ] Default bass-smooth EQ diterapkan.');
  } catch (e) {
    logger.warn('[EQ] Gagal terapkan default EQ: ' + e.message);
  }
}
// ─────────────────────────────────────────────────────────────────────────────
```

Cari baris:
```js
let player = client.lavalink.getPlayer(guildId);
```
Tambahkan **tepat di atasnya**:
```js
const isNewPlayer = !client.lavalink.getPlayer(guildId);
```

Cari blok:
```js
      logger.debug('[Bitrate] Gagal set bitrate: ' + e.message);
    }
  }

  return player;
```
Ubah menjadi:
```js
      logger.debug('[Bitrate] Gagal set bitrate: ' + e.message);
    }

    if (isNewPlayer) {
      await applyDefaultEQ(player);
    }
  }

  return player;
```

Cari `module.exports = {` dan tambahkan `DEFAULT_EQ,` di baris pertama:
```js
module.exports = {
  DEFAULT_EQ,       // ← tambah ini
  setRadioMode,
  ...
```

### File 2: `src/commands/music/filter.js`

Tambahkan **di baris paling atas**:
```js
const { DEFAULT_EQ } = require('../../music/MusicManager');
```

Cari `FILTERS.off.apply` dan tambahkan satu baris:
```js
    apply: async (player) => {
      await player.filterManager.resetFilters();
      await player.filterManager.setEqualizer(DEFAULT_EQ); // ← tambah ini
    },
```

Commit dengan pesan: `feat: tambah default EQ bass smooth`

---

## 📍 Lokasi File di GitHub

```
konyol-bot/
├── src/
│   ├── music/
│   │   └── MusicManager.js   ← file utama EQ
│   └── commands/music/
│       └── filter.js         ← agar ?filter off kembali ke EQ default
└── docs/
    └── PANDUAN-EQ.md         ← file ini
```
