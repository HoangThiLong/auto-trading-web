# MEXC Pro Futures Trading Terminal v2

[English](#english) | [Tiu1ebfng Viu1ec7t](#tiu1ebfng-viu1ec7t)

---

<a name="english"></a>
## English Version

An advanced, automated trading platform for MEXC Futures, integrating Google's TimesFM time-series foundation model and multi-AI debate system for signal processing and autonomous execution.

### Overview
MEXC Pro Futures Terminal v2 is a **production-grade** trading interface and automated execution engine designed for professional traders. The system runs in two modes:
- **Desktop Mode** u2014 Electron app with a full trading UI (charts, order management, AI signals).
- **Headless Mode** u2014 Node.js daemon for VPS deployment with REST API remote control.

### Technical Highlights
*   **Predictive Analytics**: Integration with **TimesFM** (Google Research), providing advanced time-series forecasting to anticipate market trends.
*   **Multi-AI Debate System**: 4 AI providers (Gemini, Groq, OpenRouter, Together) with a Proposer-Critic debate pattern to validate trade signals and reduce false positives.
*   **Circuit Breaker**: Automatically isolates failing services (TimesFM, AI providers). When the Python backend crashes, the bot gracefully falls back to Technical Analysis only.
*   **SQLite Persistence**: All trade logs, order history, and bot state are stored in a local SQLite database (`logs/bot.db`) u2014 survives restarts, power outages, and VPS migrations.
*   **WebSocket Exponential Backoff**: Smart reconnection (1s, 2s, 4s, 8s... max 30s + jitter) prevents IP banning from MEXC.
*   **Symbol Auto-Blacklist**: Coins with 5+ consecutive API errors are temporarily blacklisted for 15 minutes to protect the trading loop.
*   **REST API**: Built-in Express server (port 3000) for remote monitoring and control (`/api/status`, `/api/start`, `/api/stop`).
*   **Professional UI/UX**: Split-screen terminal with real-time charts, order overlay, and financial-grade design system.
*   **Risk Management**: Kill Switch, daily loss limits, quiet hours, trailing stops, and news-based sentiment filtering.

### Technology Stack
| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Zustand 5, Modern CSS |
| **Desktop** | Electron (safeStorage, auto-spawn Python backend) |
| **Headless Bot** | Node.js, Express, sql.js (WASM SQLite), Pino logger |
| **AI / ML** | TimesFM (FastAPI/PyTorch), Gemini, Groq, OpenRouter, Together |
| **Data** | MEXC WebSocket & REST API v3 |
| **DevOps** | PM2, tsconfig.bot.json (dedicated bot build) |

### Architecture
```
u250cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2510  u250cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2510  u250cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2510
u2502  MEXC Exchange  u2502  u2502  TimesFM Backend   u2502  u2502  AI Providers  u2502
u2502 (WS + REST)    u2502  u2502  (Python/FastAPI)  u2502  u2502 Gemini/Groq.. u2502
u2514u2500u2500u2500u2500u2500u2500u2500u252cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2518  u2514u2500u2500u2500u2500u2500u2500u2500u2500u2500u252cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2518  u2514u2500u2500u2500u2500u2500u2500u2500u252cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2518
        u2502                    u2502                        u2502
        u2514u2500u2500u2500u2500u2500u2500u2500u2500u252cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2534u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2518
                 u2502
    u250cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2534u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2510
    u2502  HeadlessBotService         u2502
    u2502  (Trading Loop + Signals)  u2502
    u2514u2500u2500u2500u2500u2500u2500u252cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u252cu2500u2500u2500u2500u2500u2500u2500u2518
           u2502             u2502
   u250cu2500u2500u2500u2500u2500u2500u2534u2500u2500u2500u2500u2500u2510  u250cu2500u2500u2500u2534u2500u2500u2500u2500u2500u2500u2500u2500u2510
   u2502 SQLite DB  u2502  u2502 Express API u2502
   u2502 (sql.js)   u2502  u2502 (port 3000) u2502
   u2514u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2518  u2514u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2518
```

---

<a name="tiu1ebfng-viu1ec7t"></a>
## Tiu1ebfng Viu1ec7t

Nu1ec1n tu1ea3ng giao du1ecbch tu1ef1 u0111u1ed9ng nu00e2ng cao cho MEXC Futures, tu00edch hu1ee3p mu00f4 hu00ecnh du1ef1 bu00e1o chuu1ed7i thu1eddi gian TimesFM tu1eeb Google vu00e0 hu1ec7 thu1ed1ng tranh luu1eadn u0111a-AI u0111u1ec3 xu1eed lu00fd tu00edn hiu1ec7u vu00e0 thu1ef1c thi lu1ec7nh tu1ef1 u0111u1ed9ng.

### Tu1ed5ng quan
MEXC Pro Futures Terminal v2 lu00e0 hu1ec7 thu1ed1ng giao du1ecbch **cu1ea5p u0111u1ed9 production** vu1edbi 2 chu1ebf u0111u1ed9 vu1eadn hu00e0nh:
- **Chu1ebf u0111u1ed9 Desktop** u2014 u1ee8ng du1ee5ng Electron vu1edbi giao diu1ec7n u0111u1ea7y u0111u1ee7 (biu1ec3u u0111u1ed3, quu1ea3n lu00fd lu1ec7nh, tu00edn hiu1ec7u AI).
- **Chu1ebf u0111u1ed9 Headless** u2014 Bot Node.js chu1ea1y ngu1ea7m tru00ean VPS, u0111iu1ec1u khiu1ec3n tu1eeb xa qua REST API.

### u0110iu1ec3m nu1ed5i bu1eadt
*   **Du1ef1 bu00e1o bu1eb1ng AI**: Tu00edch hu1ee3p **TimesFM** (Google Research) u2014 du1ef1 bu00e1o giu00e1 du1ef1a tru00ean chuu1ed7i thu1eddi gian.
*   **Hu1ec7 thu1ed1ng tranh luu1eadn u0111a-AI**: 4 nhu00e0 cung cu1ea5p AI (Gemini, Groq, OpenRouter, Together) vu1edbi cu01a1 chu1ebf u0111u1ec1 xuu1ea5t u2013 phu1ea3n biu1ec7n giu00fap lou1ea1i bu1ecf tu00edn hiu1ec7u nhiu1ec5u.
*   **Circuit Breaker**: Tu1ef1 u0111u1ed9ng cu00f4 lu1eadp du1ecbch vu1ee5 lu1ed7i. Khi Python backend su1eadp, bot fallback sang Phu00e2n tu00edch ku1ef9 thuu1eadt thuu1ea7n tu00fay.
*   **Lu01b0u tru1eef SQLite**: Tou00e0n bu1ed9 log giao du1ecbch, lu1ecbch su1eed lu1ec7nh, tru1ea1ng thu00e1i bot u0111u01b0u1ee3c lu01b0u vu0129nh viu1ec5n vu00e0o `logs/bot.db`.
*   **WebSocket Exponential Backoff**: Ku1ebft nu1ed1i lu1ea1i thu00f4ng minh (1s, 2s, 4s... max 30s) tru00e1nh bu1ecb MEXC chu1eb7n IP.
*   **Symbol Blacklist**: Coin lu1ed7i u22655 lu1ea7n liu00ean tiu1ebfp su1ebd bu1ecb bu1ecf qua 15 phu00fat.
*   **REST API**: Server Express (port 3000) u0111iu1ec1u khiu1ec3n bot tu1eeb xa.
*   **Quu1ea3n tru1ecb ru1ee7i ro**: Kill Switch, giu1edbi hu1ea1n lu1ed7 ngu00e0y, quiet hours, trailing stop, lu1ecdc tin tu1ee9c.

### Cu00f4ng nghu1ec7 su1eed du1ee5ng
| Tu1ea7ng | Cu00f4ng nghu1ec7 |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Zustand 5, Modern CSS |
| **Desktop** | Electron (safeStorage, tu1ef1 u0111u1ed9ng khu1edfi chu1ea1y Python backend) |
| **Headless Bot** | Node.js, Express, sql.js (WASM SQLite), Pino logger |
| **AI / ML** | TimesFM (FastAPI/PyTorch), Gemini, Groq, OpenRouter, Together |
| **Du1eef liu1ec7u** | MEXC WebSocket & REST API v3 |
| **DevOps** | PM2, tsconfig.bot.json (build riu00eang cho bot) |

---

## Khu1edfi u0111u1ed9ng nhanh

### 1. Cu00e0i u0111u1eb7t
```bash
git clone https://github.com/HoangThiLong/auto-trading-web.git
cd auto-trading-web
npm install
```

### 2. Chu1ea1y chu1ebf u0111u1ed9 Desktop (Giao diu1ec7n)
```bash
npm run dev
```

### 3. Chu1ea1y chu1ebf u0111u1ed9 Headless Bot (VPS)
```bash
# Tu1ea1o file .env tu1eeb mu1eabu
cp .env.example .env
# Su1eeda thu00f4ng tin API vu00e0 cu1ea5u hu00ecnh trong .env

# Build vu00e0 chu1ea1y
npm run build:bot
npm run start:bot
```

---

## Cu1ea5u hu00ecnh biu1ebfn mu00f4i tru01b0u1eddng (.env)

```env
# ========== Cu1ea5u hu00ecnh Bot ==========
BOT_MODE=simulation              # simulation | live | off
BOT_AUTO_START=true              # Tu1ef1 chu1ea1y khi khu1edfi u0111u1ed9ng
BOT_SYMBOLS=BTC,ETH,SOL          # Danh su00e1ch coin theo du00f5i
BOT_SCAN_ALL_MARKET=true         # Quu00e9t tou00e0n bu1ed9 thu1ecb tru01b0u1eddng
BOT_MIN_CONFIDENCE=70            # Ngu01b0u1ee1ng tin cu1eady tu1ed1i thiu1ec3u (%)
BOT_RISK_PERCENT_PER_TRADE=1     # % vu1ed1n mu1ed7i lu1ec7nh
BOT_MAX_CONCURRENT_ORDERS=3      # Su1ed1 lu1ec7nh mu1edf u0111u1ed3ng thu1eddi tu1ed1i u0111a
BOT_DAILY_LOSS_LIMIT=50          # Giu1edbi hu1ea1n lu1ed7 ngu00e0y (USDT)
BOT_TRAILING_STOP=false          # Bu1eadt trailing stop
BOT_NEWS_FILTER=true             # Lu1ecdc theo tin tu1ee9c
BOT_QUIET_HOURS_UTC=2-6          # Giu1edd nghu1ec9 (UTC)
BOT_TICK_INTERVAL_MS=30000       # Chu ku1ef3 quu00e9t (ms)
BOT_API_PORT=3000                # Port REST API
BOT_LOG_LEVEL=info               # debug | info | warn | error

# ========== MEXC API ==========
MEXC_API_KEY=your_api_key_here
MEXC_SECRET_KEY=your_secret_key_here

# ========== AI Providers (Tu00f9y chu1ecdn) ==========
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key
TOGETHER_API_KEY=your_together_key
CRYPTOPANIC_API_KEY=your_cryptopanic_key
AI_PREFERRED_PROVIDER=gemini     # gemini | groq | openrouter | together

# ========== TimesFM (Tu00f9y chu1ecdn) ==========
TIMESFM_API_BASE_URL=http://127.0.0.1:8000
```

---

## REST API u0111iu1ec1u khiu1ec3n tu1eeb xa

Khi bot chu1ea1y u1edf chu1ebf u0111u1ed9 Headless, mu1ed9t Express server su1ebd lu1eafng nghe tru00ean port 3000 (hou1eb7c `BOT_API_PORT`):

| Mu00e9thod | u0110u01b0u1eddng du1eabn | Mu00f4 tu1ea3 |
|--------|-----------|------|
| `GET` | `/api/health` | Kiu1ec3m tra bot cu00f2n su1ed1ng khu00f4ng, uptime |
| `GET` | `/api/status` | Tru1ea1ng thu00e1i u0111u1ea7y u0111u1ee7: mode, balance, PnL, circuit breakers, blacklist |
| `POST` | `/api/start` | Bu1eaft u0111u1ea7u bot |
| `POST` | `/api/stop` | Du1eebng bot |
| `GET` | `/api/logs?limit=50` | Xem lu1ecbch su1eed giao du1ecbch (tu1eeb SQLite) |
| `GET` | `/api/orders?limit=50` | Xem lu1ecbch su1eed lu1ec7nh |
| `POST` | `/api/circuit-breaker/reset` | Reset circuit breaker (`{"name":"timesfm"}`) |

**Vu00ed du1ee5 su1eed du1ee5ng:**
```bash
# Kiu1ec3m tra tru1ea1ng thu00e1i bot
curl http://localhost:3000/api/status

# Du1eebng bot
curl -X POST http://localhost:3000/api/stop

# Xem 20 log gu1ea7n nhu1ea5t
curl "http://localhost:3000/api/logs?limit=20"
```

---

## Triu1ec3n khai tru00ean VPS vu1edbi PM2

### Bu01b0u1edbc 1: Cu00e0i u0111u1eb7t PM2
```bash
npm install -g pm2
```

### Bu01b0u1edbc 2: Tu1ea1o file .env
Tu1ea1o file `.env` trong thu01b0 mu1ee5c gu1ed1c vu1edbi cu1ea5u hu00ecnh u1edf tru00ean.

### Bu01b0u1edbc 3: Build vu00e0 Deploy
```bash
npm run build:bot
pm2 start ecosystem.config.js
pm2 save
pm2 startup     # Tu1ef1 khu1edfi u0111u1ed9ng khi VPS reboot
```

### Lu1ec7nh vu1eadn hu00e0nh
```bash
pm2 status mexc-ai-bot          # Xem tru1ea1ng thu00e1i
pm2 logs mexc-ai-bot            # Log realtime
pm2 restart mexc-ai-bot         # Restart
pm2 stop mexc-ai-bot            # Du1eebng

# Hou1eb7c du00f9ng REST API u0111u1ec3 u0111iu1ec1u khiu1ec3n tu1eeb xa:
curl -X POST http://vps-ip:3000/api/stop
curl -X POST http://vps-ip:3000/api/start
```

---

## Cu1ea5u tru00fac thu01b0 mu1ee5c chu00ednh

```
u251cu2500u2500 bot.ts                      # Entry point cho Headless Bot + Express API
u251cu2500u2500 tsconfig.bot.json           # TypeScript config riu00eang cho bot
u251cu2500u2500 ecosystem.config.js         # PM2 config
u251cu2500u2500 electron/                   # Electron desktop wrapper
u251cu2500u2500 src/
u2502   u251cu2500u2500 database/
u2502   u2502   u2514u2500u2500 db.ts               # SQLite adapter (sql.js)
u2502   u251cu2500u2500 services/
u2502   u2502   u251cu2500u2500 headlessBot.ts      # Core trading engine
u2502   u2502   u251cu2500u2500 circuitBreaker.ts   # Circuit Breaker pattern
u2502   u2502   u251cu2500u2500 mexcApi.ts          # MEXC REST + WebSocket (exp. backoff)
u2502   u2502   u251cu2500u2500 geminiAi.ts         # Multi-AI debate system
u2502   u2502   u251cu2500u2500 timesfmService.ts   # TimesFM forecasting (circuit breaker)
u2502   u2502   u251cu2500u2500 analysis.ts         # Technical indicators (RSI, MACD, BB...)
u2502   u2502   u251cu2500u2500 capitalManager.ts   # Position sizing, risk management
u2502   u2502   u2514u2500u2500 newsService.ts      # Crypto news sentiment filter
u2502   u251cu2500u2500 store/                  # Zustand state management (UI)
u2502   u251cu2500u2500 components/             # React UI components
u2502   u2514u2500u2500 types/                  # TypeScript type definitions
u251cu2500u2500 timesfm-backend/            # Python FastAPI server (TimesFM ML)
u2514u2500u2500 logs/
    u251cu2500u2500 bot.db                  # SQLite database
    u2514u2500u2500 headless-bot.log        # Pino structured logs
```

---

## Bu1ea3o mu1eadt

- **TUYỆT ĐỐI** khu00f4ng cu1ea5p quyu1ec1n **Ru00fat tiu1ec1n (Withdraw)** cho API Key.
- File `.env` u0111u00e3 u0111u01b0u1ee3c thu00eam vu00e0o `.gitignore` u2014 khu00f4ng bao giu1edd u0111u01b0u1ee3c push lu00ean GitHub.
- API Key u0111u01b0u1ee3c mu00e3 hu00f3a AES-256 trong localStorage (Web) hou1eb7c safeStorage (Electron).
- REST API khu00f4ng cu00f3 auth mu1eb7c u0111u1ecbnh u2014 du00f9ng firewall chu1eb7n port 3000, hou1eb7c SSH tunnel: `ssh -L 3000:localhost:3000 user@vps`.

---

## Miu1ec5n tru1eeb tru00e1ch nhiu1ec7m

Phu1ea7n mu1ec1m nu00e0y chu1ec9 du00e0nh cho mu1ee5c u0111u00edch **tru00ecnh diu1ec5n ku1ef9 thuu1eadt vu00e0 giu00e1o du1ee5c**. Giao du1ecbch tiu1ec1n mu00e3 hu00f3a phu00e1i sinh luu00f4n tiu1ec1m u1ea9n ru1ee7i ro tu00e0i chu00ednh lu1edbn. Nhu00e0 phu00e1t triu1ec3n khu00f4ng chu1ecbu tru00e1ch nhiu1ec7m cho bu1ea5t ku1ef3 tu1ed5n thu1ea5t nu00e0o phu00e1t sinh tu1eeb viu1ec7c su1eed du1ee5ng phu1ea7n mu1ec1m.

---
*Developed by HoangLong u2014 Optimized for Precision and Performance.*
