#!/bin/sh
set -e

echo "🔷 Memulai Cloudflare WARP..."

# Jalankan warp-svc di background
warp-svc &
WARP_PID=$!

# Tunggu warp-svc siap
sleep 3

# Register (hanya perlu sekali, akan skip jika sudah terdaftar)
warp-cli --accept-tos register 2>/dev/null || true

# Aktifkan WARP mode
warp-cli --accept-tos mode warp 2>/dev/null || true
warp-cli --accept-tos connect 2>/dev/null || true

# Tunggu koneksi WARP established
MAX_WAIT=20
i=0
while [ $i -lt $MAX_WAIT ]; do
  STATUS=$(warp-cli --accept-tos status 2>/dev/null || echo "")
  if echo "$STATUS" | grep -q "Connected"; then
    echo "✅ Cloudflare WARP terhubung"
    break
  fi
  echo "⏳ Menunggu WARP... ($i/$MAX_WAIT)"
  sleep 1
  i=$((i + 1))
done

if [ $i -eq $MAX_WAIT ]; then
  echo "⚠️  WARP timeout — melanjutkan tanpa WARP"
fi

echo "🎵 Memulai Discord Music Bot..."
exec node --dns-result-order=ipv4first src/index.js
