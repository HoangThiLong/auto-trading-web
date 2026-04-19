# Hu01b0u1edbng Du1eabn Su1eed Du1ee5ng: MEXC Pro Futures Terminal v2

## ud83cudf1f Giu1edbi thiu1ec7u tu1ed5ng quan

MEXC Pro Futures Terminal v2 lu00e0 phu1ea7n mu1ec1m giao du1ecbch tu1ef1 u0111u1ed9ng **cu1ea5p u0111u1ed9 production** du00e0nh riu00eang cho thu1ecb tru01b0u1eddng hu1ee3p u0111u1ed3ng tu01b0u01a1ng lai (Futures) tru00ean su00e0n MEXC. Hu1ec7 thu1ed1ng hu1ed7 tru1ee3 2 chu1ebf u0111u1ed9 vu1eadn hu00e0nh:

| Chu1ebf u0111u1ed9 | Mu00f4 tu1ea3 | Khi nu00e0o du00f9ng |
|---|---|---|
| **Desktop** | u1ee8ng du1ee5ng Electron vu1edbi giao diu1ec7n u0111u1ea7y u0111u1ee7 | Giao du1ecbch tru1ef1c quan, theo du00f5i biu1ec3u u0111u1ed3 |
| **Headless** | Bot Node.js chu1ea1y ngu1ea7m, u0111iu1ec1u khiu1ec3n qua REST API | Chu1ea1y 24/7 tru00ean VPS |

---

## ud83dudd27 Tu00ednh nu0103ng chu00ednh

### 1. Phu00e2n tu00edch vu00e0 tu00edn hiu1ec7u giao du1ecbch
- **AI Signal Engine**: 4 nhu00e0 cung cu1ea5p AI (Gemini, Groq, OpenRouter, Together) tranh luu1eadn u0111u1ec3 xu00e1c nhu1eadn tu00edn hiu1ec7u
- **TimesFM**: Du1ef1 bu00e1o giu00e1 du1ef1a tru00ean mu00f4 hu00ecnh Machine Learning cu1ee7a Google Research
- **Phu00e2n tu00edch ku1ef9 thuu1eadt**: RSI, MACD, Bollinger Bands, EMA (20/50/200), ATR, Volume
- **Lu1ecdc tin tu1ee9c**: Tu1ef1 u0111u1ed9ng phu00e2n tu00edch tin tu1ee9c crypto u0111u1ec3 u0111u00e1nh giu00e1 tu00e2m lu00fd thu1ecb tru01b0u1eddng

### 2. Thu1ef1c thi lu1ec7nh
- u0110u1eb7t lu1ec7nh thu1eadt tru1ef1c tiu1ebfp lu00ean MEXC qua API
- Chu1ebf u0111u1ed9 **Simulation** u0111u1ec3 thu1eed nghiu1ec7m khu00f4ng mu1ea5t tiu1ec1n
- Tu1ef1 u0111u1ed9ng gu1ee3i u00fd mu1ee9c **Take Profit** vu00e0 **Stop Loss** tu1ed1i u01b0u
- Trailing Stop u0111u1ed9ng

### 3. Khu1ea3 nu0103ng chu1ecbu lu1ed7i (Phase 2 mu1edbi)
- **Circuit Breaker**: Khi du1ecbch vu1ee5 bu00ean ngou00e0i su1eadp (TimesFM, AI), hu1ec7 thu1ed1ng tu1ef1 u0111u1ed9ng cu00f4 lu1eadp vu00e0 fallback
- **WebSocket Backoff**: Ku1ebft nu1ed1i lu1ea1i thu00f4ng minh (1s u2192 2s u2192 4s u2192 8s... max 30s) tru00e1nh bu1ecb su00e0n chu1eb7n IP
- **Symbol Blacklist**: Coin lu1ed7i liu00ean tu1ee5c su1ebd bu1ecb tu1ea1m du1eebng 15 phu00fat u0111u1ec3 bu1ea3o vu1ec7 vou00f2ng lu1eb7p
- **SQLite**: Lu01b0u tou00e0n bu1ed9 du1eef liu1ec7u vu00e0o file `logs/bot.db` u2014 khu00f4ng mu1ea5t du1eef liu1ec7u khi khu1edfi u0111u1ed9ng lu1ea1i

### 4. u0110iu1ec1u khiu1ec3n tu1eeb xa
- REST API tru00ean port 3000 vu1edbi 7 endpoint
- Xem tru1ea1ng thu00e1i, bu1eaft/du1eebng bot, xem log tu1eeb bru1ea5t cu1ee9 u0111u00e2u

---

## ud83dudd11 Hu01b0u1edbng du1eabn cu00e0i u0111u1eb7t API Key (Quan tru1ecdng)

u0110u1ec3 cu00f3 thu1ec3 u0111u1ecdc u0111u01b0u1ee3c thu00f4ng tin tu00e0i su1ea3n vu00e0 u0111u1eb7t lu1ec7nh thu1eadt, bu1ea1n cu1ea7n cu1ea5p quyu1ec1n API cho phu1ea7n mu1ec1m.

### Cu00e1ch lu1ea5y API tru00ean MEXC:
1. u0110u0103ng nhu1eadp vu00e0o trang chu1ee7 [MEXC.com](https://www.mexc.com/).
2. u0110u01b0a chuu1ed9t vu00e0o biu1ec3u tu01b0u1ee3ng "Hu1ed3 su01a1 cu00e1 nhu00e2n" (Gu00f3c phu1ea3i tru00ean) u2192 Chu1ecdn **Quu1ea3n lu00fd API**.
3. Bu1ea5m **Tu1ea1o API**.
4. Chu1ecdn cu00e1c quyu1ec1n: Tu00edch chu1ecdn **u0110u1ecdc du1eef liu1ec7u** vu00e0 **Giao du1ecbch Futures**.

> u26a0ufe0f **LU01afU u00dd Bu1ea2O Mu1eacT:** Tuyu1ec7t u0111u1ed1i **KHu00d4NG** tu00edch chu1ecdn quyu1ec1n **Ru00fat tiu1ec1n (Withdraw)** u0111u1ec3 u0111u1ea3m bu1ea3o an tou00e0n 100% cho tu00e0i su1ea3n.

5. Tu1ea1o thu00e0nh cu00f4ng, MEXC su1ebd cu1ea5p cho bu1ea1n 2 mu00e3: `API Key` vu00e0 `Secret Key`. Copy cu1ea3 hai.

### Cu00e1ch nhu1eadp vu00e0o phu1ea7n mu1ec1m:

**Chu1ebf u0111u1ed9 Desktop (giao diu1ec7n):**
1. Chuyu1ec3n sang tab **Cu00e0i u0111u1eb7t (Settings)** (biu1ec3u tu01b0u1ee3ng bu00e1nh ru0103ng).
2. Du00e1n `API Key` vu00e0 `Secret Key`.
3. Bu1ea5m Lu01b0u. Khi hiu1ec3n thu1ecb **API Connected** mu00e0u xanh lu00e1 lu00e0 u0111u00e3 su1eb5n su00e0ng.

**Chu1ebf u0111u1ed9 Headless (VPS):**
1. Thu00eam vu00e0o file `.env`:
```env
MEXC_API_KEY=mu00e3_api_key_cu1ee7a_bu1ea1n
MEXC_SECRET_KEY=mu00e3_secret_key_cu1ee7a_bu1ea1n
```

---

## ud83dude80 Hu01b0u1edbng du1eabn su1eed du1ee5ng

### A. Chu1ebf u0111u1ed9 Desktop (Giao diu1ec7n)

#### Chu1ea1y
```bash
npm run dev
```

#### u0110i lu1ec7nh theo gu1ee3i u00fd AI
1. Truy cu1eadp tab **AI Signals** (biu1ec3u tu01b0u1ee3ng hu00ecnh bu1ed9 nu00e3o).
2. Theo du00f5i cu00e1c tu00edn hiu1ec7u. Chu1ecdn u0111u1ed3ng coin bu1ea1n muu1ed1n.
3. u0110u1ecdc phu1ea7n **Lu00fd do (Reasons)** u0111u1ec3 hiu1ec3u tu1ea1i sao AI khuyu00ean mua/bu00e1n.
4. Nu1ebfu u0111u1ed3ng u00fd, bu1ea5m **u0110u1eb7t lu1ec7nh theo tu00edn hiu1ec7u nu00e0y**.
5. Kiu1ec3m tra lu1ea1i khu1ed1i lu01b0u1ee3ng, u0111ou00f2n bu1ea9y u2192 Bu1ea5m **Mu1edf vu1ecb thu1ebf**.

---

### B. Chu1ebf u0111u1ed9 Headless (Bot VPS)

#### Bu01b0u1edbc 1: Cu1ea5u hu00ecnh
Tu1ea1o file `.env` trong thu01b0 mu1ee5c gu1ed1c:
```env
BOT_MODE=simulation              # simulation = thu1eed nghiu1ec7m, live = thu1eadt
BOT_AUTO_START=true
BOT_SYMBOLS=BTC,ETH,SOL
BOT_MIN_CONFIDENCE=70
BOT_RISK_PERCENT_PER_TRADE=1
BOT_MAX_CONCURRENT_ORDERS=3
BOT_DAILY_LOSS_LIMIT=50
BOT_API_PORT=3000

MEXC_API_KEY=your_api_key
MEXC_SECRET_KEY=your_secret_key

GEMINI_API_KEY=your_gemini_key
```

#### Bu01b0u1edbc 2: Build vu00e0 chu1ea1y
```bash
npm run build:bot
npm run start:bot
```

Bot su1ebd hiu1ec3n thu1ecb:
```
u250cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2510
u2502  ud83eudd16 MEXC Pro Futures Bot v2 u2014 REST API          u2502
u251cu2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2524
u2502  Port:      3000                                       u2502
u2502  Mode:      simulation                                 u2502
u2502  Running:   true                                       u2502
u2514u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2518
```

#### Bu01b0u1edbc 3: u0110iu1ec1u khiu1ec3n tu1eeb xa qua REST API
```bash
# Kiu1ec3m tra bot cu00f2n su1ed1ng khu00f4ng
curl http://localhost:3000/api/health

# Xem tru1ea1ng thu00e1i u0111u1ea7y u0111u1ee7 (balance, PnL, circuit breakers...)
curl http://localhost:3000/api/status

# Du1eebng bot
curl -X POST http://localhost:3000/api/stop

# Bu1eadt lu1ea1i bot
curl -X POST http://localhost:3000/api/start

# Xem 20 lu1ec7nh gu1ea7n nhu1ea5t
curl "http://localhost:3000/api/logs?limit=20"

# Xem lu1ecbch su1eed lu1ec7nh
curl "http://localhost:3000/api/orders?limit=20"

# Reset Circuit Breaker (khi TimesFM u0111u00e3 hu1ed3i lu1ea1i)
curl -X POST http://localhost:3000/api/circuit-breaker/reset \
  -H "Content-Type: application/json" \
  -d '{"name":"timesfm"}'
```

#### Bu01b0u1edbc 4: Chu1ea1y vu1edbi PM2 (khuyu1ebfn nghu1ecb)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup     # Tu1ef1 khu1edfi u0111u1ed9ng khi VPS reboot
```

Cu00e1c lu1ec7nh PM2 hu1eefu u00edch:
```bash
pm2 status              # Tru1ea1ng thu00e1i tu1ea5t cu1ea3 process
pm2 logs mexc-ai-bot    # Log realtime
pm2 restart mexc-ai-bot # Restart
pm2 stop mexc-ai-bot    # Du1eebng
```

---

## ud83dudd12 Quu1ea3n lu00fd ru1ee7i ro

1. **Luu00f4n chu1ea1y `simulation` tru01b0u1edbc**: u0110u1eb7t `BOT_MODE=simulation` u0111u1ec3 kiu1ec3m tra chiu1ebfn lu01b0u1ee3c tru01b0u1edbc khi du00f9ng tiu1ec1n thu1eadt.
2. **Giu1edbi hu1ea1n lu1ed7 ngu00e0y**: u0110u1eb7t `BOT_DAILY_LOSS_LIMIT=50` u0111u1ec3 bot tu1ef1 du1eebng khi lu1ed7 vu01b0u1ee3t ngu01b0u1ee1ng.
3. **Kill Switch**: Bot su1ebd tu1ef1 du1eebng khi `autoTradeRunning = false` hou1eb7c `autoTradeMode = off`.
4. **Giu1edd nghu1ec9**: u0110u1eb7t `BOT_QUIET_HOURS_UTC=2-6` u0111u1ec3 bot khu00f4ng giao du1ecbch trong giu1edd u00edt thanh khou1ea3n.
5. **Lu1ecdc tin tu1ee9c**: `BOT_NEWS_FILTER=true` su1ebd bu1ecf qua lu1ec7nh khi thu1ecb tru01b0u1eddng cu00f3 tin xu1ea5u.
6. **Circuit Breaker**: Khi du1ecbch vu1ee5 bu00ean ngou00e0i lu1ed7i, bot tu1ef1 u0111u1ed9ng lu00e0m viu1ec7c vu1edbi nhuu1eefng gu00ec cu00f2n lu1ea1i (khu00f4ng su1eadp tou00e0n bu1ed9).

---

## u2753 Cu00e2u hu1ecfi thu01b0u1eddng gu1eb7p

**H: Bot cu00f3 tu1ef1 ru00fat tiu1ec1n tu1eeb tu00e0i khou1ea3n cu1ee7a tu00f4i u0111u01b0u1ee3c khu00f4ng?**
A: **Khu00f4ng**. Nu1ebfu bu1ea1n khu00f4ng cu1ea5p quyu1ec1n Withdraw cho API Key, bot chu1ec9 cu00f3 thu1ec3 u0111u1ecdc du1eef liu1ec7u vu00e0 u0111u1eb7t lu1ec7nh, khu00f4ng thu1ec3 chuyu1ec3n tiu1ec1n ra ngou00e0i.

**H: Bot hu1ebft bao nhiu00eau RAM?**
A: Khou1ea3ng 100u2013200MB. PM2 config giu1edbi hu1ea1n tu1ed1i u0111a 250MB.

**H: Du1eef liu1ec7u cu00f3 mu1ea5t khi restart khu00f4ng?**
A: **Khu00f4ng**. Tu1eeb Phase 2, tou00e0n bu1ed9 du1eef liu1ec7u u0111u01b0u1ee3c lu01b0u vu00e0o SQLite (`logs/bot.db`). Khi bot khu1edfi u0111u1ed9ng lu1ea1i, nu00f3 su1ebd tu1ef1 u0111u1ed9ng load lu1ea1i cu00e1c lu1ec7nh u0111ang mu1edf vu00e0 bau00e0i hu1ecdc giao du1ecbch.

**H: TimesFM su1eadp thu00ec sao?**
A: Circuit Breaker su1ebd tu1ef1 u0111u1ed9ng ku00edch hou1ea1t. Bot tiu1ebfp tu1ee5c chu1ea1y du1ef1a tru00ean AI Debate + Phu00e2n tu00edch ku1ef9 thuu1eadt, khu00f4ng cu1ea7n TimesFM.

**H: Mu1ea1ng VPS chu1eadp chu1eddng thu00ec sao?**
A: WebSocket su1ebd tu1ef1 u0111u1ed9ng ku1ebft nu1ed1i lu1ea1i vu1edbi Exponential Backoff (1s u2192 2s u2192 4s... max 30s), tru00e1nh vu1eadn u0111u1ec1 spam ku1ebft nu1ed1i.

---

Chuu00fac bu1ea1n cu00f3 mu1ed9t tru1ea3i nghiu1ec7m giao du1ecbch thuu1eadn lu1ee3i vu00e0 an tou00e0n! ud83dude80
