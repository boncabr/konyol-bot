# Deploy Lavalink Self-Host di Railway

## Langkah-langkah

### Step 1 — Buat service Lavalink baru di Railway

1. Buka project Railway yang sama dengan bot
2. Klik **+ New Service** → **GitHub Repo**
3. Pilih repo `boncabr/konyol-bot`
4. Klik **Settings** → cari **Root Directory** → isi: `lavalink`

### Step 2 — Tambah variable di service Lavalink

| Key | Value |
|---|---|
| `LAVALINK_PASSWORD` | password bebas, contoh: `KonyolBot2024` |
| `PORT` | `2333` |

### Step 3 — Aktifkan public domain Lavalink

Setelah deploy berhasil:
- Klik **Settings** → **Networking** → **Public Networking** → **Generate Domain**
- Catat domain-nya, contoh: `konyol-lavalink.up.railway.app`

### Step 4 — Update variable di service bot (konyol-bot)

| Key | Value baru |
|---|---|
| `LAVALINK_HOST` | `konyol-lavalink.up.railway.app` _(domain dari Step 3)_ |
| `LAVALINK_PORT` | `443` |
| `LAVALINK_PASSWORD` | password yang diset di Step 2 |
| `LAVALINK_SECURE` | `true` |
| `LAVALINK_HOST_2` | _(opsional, public node sebagai fallback)_ |

### Step 5 — Restart bot

Setelah semua variable diupdate, restart service bot agar reconnect ke Lavalink baru.

---

## Catatan

- Railway hanya expose port **443 (HTTPS)** — bot harus connect dengan `LAVALINK_PORT=443` dan `LAVALINK_SECURE=true`
- **First boot** Lavalink lambat (~2–3 menit) karena download plugin dari Maven
- Lavalink butuh minimal **512MB RAM**
- Password dikonfigurasi via env var `LAVALINK_PASSWORD` di `application.yml`

## Struktur file

```
lavalink/
├── Dockerfile          # Build dari ghcr.io/lavalink-devs/lavalink:4
├── application.yml     # Konfigurasi server + plugin (port dari $PORT)
├── railway.toml        # Konfigurasi build & deploy Railway
└── DEPLOY.md           # Panduan ini
```

## Plugin yang digunakan

| Plugin | Versi | Fungsi |
|---|---|---|
| `youtube-plugin` | 1.18.1 | Streaming YouTube |
| `lavasrc-plugin` | 4.4.1 | Spotify, SoundCloud, dll |
