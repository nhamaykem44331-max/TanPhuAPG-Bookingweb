#!/bin/bash
# APG Flight Agent v2.2 — AbayEngine (macOS / Linux)

echo ""
echo "====================================================="
echo "  APG FLIGHT AGENT v2.2 — AbayEngine"
echo "  Tân Phú APG"
echo "====================================================="
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  LỖI: Không tìm thấy Node.js!"
  echo "  Cài đặt tại: https://nodejs.org (chọn phiên bản LTS)"
  exit 1
fi
echo "  Node.js: $(node -v)"

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "  Đang cài dependencies... (lần đầu ~1 phút)"
  npm install
fi

# Create .env.local if missing
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo "  Đã tạo .env.local (chế độ demo)"
fi

echo ""
echo "  🚀 Khởi động server..."
echo "  🌐 Truy cập: http://localhost:3000"
echo "  ⏹  Nhấn Ctrl+C để dừng"
echo ""
npm run dev
