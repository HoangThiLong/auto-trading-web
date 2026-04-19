# MEXC Pro Futures Trading Terminal v2

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

<a name="english"></a>
## English Version

An advanced, automated trading platform for MEXC Futures, integrating Google's TimesFM time-series foundation model and multi-AI debate system for signal processing and autonomous execution.

### Overview
MEXC Pro Futures Terminal v2 is a **production-grade** trading interface and automated execution engine designed for professional traders. The system runs in two modes:
- **Desktop Mode** — Electron app with a full trading UI (charts, order management, AI signals).
- **Headless Mode** — Node.js daemon for VPS deployment with REST API remote control.

### Technical Highlights
*   **Predictive Analytics**: Integration with **TimesFM** (Google Research), providing advanced time-series forecasting to anticipate market trends.
*   **Multi-AI Debate System**: 4 AI providers (Gemini, Groq, OpenRouter, Together) with a Proposer-Critic debate pattern to validate trade signals and reduce false positives.
*   **Circuit Breaker**: Automatically isolates failing services. When the Python backend crashes, the bot gracefully falls back to Technical Analysis only.
*   **SQLite Persistence**: All trade logs, order history, and bot state are stored in `logs/bot.db` — survives restarts and VPS migrations.
*   **WebSocket Exponential Backoff**: Smart reconnection (1s, 2s, 4s, 8s... max 30s + jitter) prevents IP banning from MEXC.
*   **Symbol Auto-Blacklist**: Coins with 5+ consecutive errors are temporarily blacklisted for 15 minutes.
*   **REST API**: Built-in Express server (port 3000) for remote monitoring and control.
*   **Professional UI/UX**: Split-screen terminal with real-time charts, order overlay, financial-grade design.
*   **Risk Management**: Kill Switch, daily loss limits, quiet hours, trailing stops, news-based filtering.

### Technology Stack
| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Zustand 5, Modern CSS |
| **Desktop** | Electron (safeStorage, auto-spawn Python backend) |
| **Headless Bot** | Node.js, Express, sql.js (WASM SQLite), Pino logger |
| **AI / ML** | TimesFM (FastAPI/PyTorch), Gemini, Groq, OpenRouter, Together |
| **Data** | MEXC WebSocket & REST API v3 |
| **DevOps** | PM2, tsconfig.bot.json (dedicated bot build) |

---

<a name="tiếng-việt"></a>
## Tiếng Việt

Nền tảng giao dịch tự động nâng cao cho MEXC Futures, tích hợp mô hình dự báo chuỗi thời gian TimesFM từ Google và hệ thống tranh luận đa-AI để xử lý tín hiệu và thực thi lệnh tự động.

### Tổng quan
MEXC Pro Futures Terminal v2 là hệ thống giao dịch **cấp độ production** với 2 chế độ vận hành:
- **Chế độ Desktop** — Ứng dụng Electron với giao diện đầy đủ (biểu đồ, quản lý lệnh, tín hiệu AI).
- **Chế độ Headless** — Bot Node.js chạy ngầm trên VPS, điều khiển từ xa qua REST API.

### Điểm nổi bật
*   **Dự báo bằng AI**: Tích hợp **TimesFM** (Google Research) — dự báo giá dựa trên chuỗi thời gian.
*   **Hệ thống tranh luận đa-AI**: 4 nhà cung cấp AI (Gemini, Groq, OpenRouter, Together) với cơ chế đề xuất – phản biện giúp loại bỏ tín hiệu nhiễu.
*   **Circuit Breaker**: Tự động cô lập dịch vụ lỗi. Khi Python backend sập, bot fallback sang Phân tích kỹ thuật thuần túy.
*   **Lưu trữ SQLite**: Toàn bộ log giao dịch, lịch sử lệnh, trạng thái bot được lưu vĩnh viễn vào `logs/bot.db`.
*   **WebSocket Exponential Backoff**: Kết nối lại thông minh (1s, 2s, 4s... max 30s) tránh bị MEXC chặn IP.
*   **Symbol Blacklist**: Coin lỗi ≥5 lần liên tiếp sẽ bị bỏ qua 15 phút.
*   **REST API**: Server Express (port 3000) điều khiển bot từ xa.
*   **Quản trị rủi ro**: Kill Switch, giới hạn lỗ ngày, quiet hours, trailing stop, lọc tin tức.

### Công nghệ sử dụng
| Tầng | Công nghệ |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Zustand 5, Modern CSS |
| **Desktop** | Electron (safeStorage, tự động khởi chạy Python backend) |
| **Headless Bot** | Node.js, Express, sql.js (WASM SQLite), Pino logger |
| **AI / ML** | TimesFM (FastAPI/PyTorch), Gemini, Groq, OpenRouter, Together |
| **Dữ liệu** | MEXC WebSocket & REST API v3 |
| **DevOps** | PM2, tsconfig.bot.json (build riêng cho bot) |

---

## Khởi động nhanh

### 1. Cài đặt
```bash
git clone https://github.com/HoangThiLong/auto-trading-web.git
cd auto-trading-web
npm install
```

### 2. Chạy chế độ Desktop (Giao diện)
```bash
npm run dev
```

### 3. Chạy chế độ Headless Bot (VPS)
```bash
# Tạo file .env từ mẫu
cp .env.example .env
# Sửa thông tin API và cấu hình trong .env

# Build và chạy
npm run build:bot
npm run start:bot
```

---

## Cấu hình biến môi trường (.env)

```env
# ========== Cấu hình Bot ==========
BOT_MODE=simulation              # simulation | live | off
BOT_AUTO_START=true
BOT_SYMBOLS=BTC,ETH,SOL
BOT_SCAN_ALL_MARKET=true
BOT_MIN_CONFIDENCE=70            # Ngưỡng tin cậy tối thiểu (%)
BOT_RISK_PERCENT_PER_TRADE=1     # % vốn mỗi lệnh
BOT_MAX_CONCURRENT_ORDERS=3      # Số lệnh mở đồng thời tối đa
BOT_DAILY_LOSS_LIMIT=50          # Giới hạn lỗ ngày (USDT)
BOT_TRAILING_STOP=false
BOT_NEWS_FILTER=true
BOT_QUIET_HOURS_UTC=2-6          # Giờ nghỉ (UTC)
BOT_TICK_INTERVAL_MS=30000       # Chu kỳ quét (ms)
BOT_API_PORT=3000                # Port REST API
BOT_LOG_LEVEL=info

# ========== MEXC API ==========
MEXC_API_KEY=your_api_key_here
MEXC_SECRET_KEY=your_secret_key_here

# ========== AI Providers (Tùy chọn) ==========
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key
TOGETHER_API_KEY=your_together_key
CRYPTOPANIC_API_KEY=your_cryptopanic_key
AI_PREFERRED_PROVIDER=gemini     # gemini | groq | openrouter | together

# ========== TimesFM (Tùy chọn) ==========
TIMESFM_API_BASE_URL=http://127.0.0.1:8000
```

---

## REST API điều khiển từ xa

Khi bot chạy ở chế độ Headless, một Express server sẽ lắng nghe trên port 3000:

| Method | Đường dẫn | Mô tả |
|--------|-----------|------|
| `GET` | `/api/health` | Kiểm tra bot còn sống không, uptime |
| `GET` | `/api/status` | Trạng thái đầy đủ: mode, balance, PnL, circuit breakers |
| `POST` | `/api/start` | Bắt đầu bot |
| `POST` | `/api/stop` | Dừng bot |
| `GET` | `/api/logs?limit=50` | Lịch sử giao dịch (từ SQLite) |
| `GET` | `/api/orders?limit=50` | Lịch sử lệnh |
| `POST` | `/api/circuit-breaker/reset` | Reset circuit breaker (`{"name":"timesfm"}`) |

```bash
# Ví dụ sử dụng
curl http://localhost:3000/api/status
curl -X POST http://localhost:3000/api/stop
curl "http://localhost:3000/api/logs?limit=20"
```

---

## Triển khai trên VPS với PM2

```bash
npm install -g pm2
npm run build:bot
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Lệnh vận hành
```bash
pm2 status mexc-ai-bot          # Xem trạng thái
pm2 logs mexc-ai-bot            # Log realtime
pm2 restart mexc-ai-bot         # Restart
pm2 stop mexc-ai-bot            # Dừng
```

---

## Cấu trúc thư mục chính

```
├── bot.ts                      # Entry point cho Headless Bot + Express API
├── tsconfig.bot.json           # TypeScript config riêng cho bot
├── ecosystem.config.js         # PM2 config
├── electron/                   # Electron desktop wrapper
├── src/
│   ├── database/
│   │   └── db.ts               # SQLite adapter (sql.js)
│   ├── services/
│   │   ├── headlessBot.ts      # Core trading engine
│   │   ├── circuitBreaker.ts   # Circuit Breaker pattern
│   │   ├── mexcApi.ts          # MEXC REST + WebSocket
│   │   ├── geminiAi.ts         # Multi-AI debate system
│   │   ├── timesfmService.ts   # TimesFM forecasting
│   │   ├── analysis.ts         # Technical indicators
│   │   ├── capitalManager.ts   # Position sizing, risk management
│   │   └── newsService.ts      # Crypto news sentiment filter
│   ├── store/                  # Zustand state management (UI)
│   ├── components/             # React UI components
│   └── types/                  # TypeScript type definitions
├── timesfm-backend/            # Python FastAPI server (TimesFM ML)
└── logs/
    ├── bot.db                  # SQLite database
    └── headless-bot.log        # Pino structured logs
```

---

## Bảo mật

- **TUYỆT ĐỐI** không cấp quyền **Rút tiền (Withdraw)** cho API Key.
- File `.env` đã được thêm vào `.gitignore` — không bao giờ được push lên GitHub.
- API Key được mã hóa AES-256 trong localStorage (Web) hoặc safeStorage (Electron).
- REST API không có auth mặc định — dùng firewall chặn port 3000, hoặc SSH tunnel: `ssh -L 3000:localhost:3000 user@vps`.

---

## Miễn trừ trách nhiệm

Phần mềm này chỉ dành cho mục đích **trình diễn kỹ thuật và giáo dục**. Giao dịch tiền mã hóa phái sinh luôn tiềm ẩn rủi ro tài chính lớn. Nhà phát triển không chịu trách nhiệm cho bất kỳ tổn thất nào phát sinh từ việc sử dụng phần mềm.

---
*Developed by HoangLong — Optimized for Precision and Performance.*