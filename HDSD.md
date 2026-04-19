# Hướng Dẫn Sử Dụng: MEXC Pro Futures Terminal v2

## 🌟 Giới thiệu tổng quan

MEXC Pro Futures Terminal v2 là phần mềm giao dịch tự động **cấp độ production** dành riêng cho thị trường hợp đồng tương lai (Futures) trên sàn MEXC. Hệ thống hỗ trợ 2 chế độ vận hành:

| Chế độ | Mô tả | Khi nào dùng |
|---|---|---|
| **Desktop** | Ứng dụng Electron với giao diện đầy đủ | Giao dịch trực quan, theo dõi biểu đồ |
| **Headless** | Bot Node.js chạy ngầm, điều khiển qua REST API | Chạy 24/7 trên VPS |

---

## 🔧 Tính năng chính

### 1. Phân tích và tín hiệu giao dịch
- **AI Signal Engine**: 4 nhà cung cấp AI (Gemini, Groq, OpenRouter, Together) tranh luận để xác nhận tín hiệu
- **TimesFM**: Dự báo giá dựa trên mô hình Machine Learning của Google Research
- **Phân tích kỹ thuật**: RSI, MACD, Bollinger Bands, EMA (20/50/200), ATR, Volume
- **Lọc tin tức**: Tự động phân tích tin tức crypto để đánh giá tâm lý thị trường

### 2. Thực thi lệnh
- Đặt lệnh thật trực tiếp lên MEXC qua API
- Chế độ **Simulation** để thử nghiệm không mất tiền
- Tự động gợi ý mức **Take Profit** và **Stop Loss** tối ưu
- Trailing Stop động

### 3. Khả năng chịu lỗi (Phase 2 - mới)
- **Circuit Breaker**: Khi dịch vụ bên ngoài sập (TimesFM, AI), hệ thống tự động cô lập và fallback
- **WebSocket Backoff**: Kết nối lại thông minh (1s → 2s → 4s → 8s... max 30s) tránh bị sàn chặn IP
- **Symbol Blacklist**: Coin lỗi liên tục sẽ bị tạm dừng 15 phút để bảo vệ vòng lặp
- **SQLite**: Lưu toàn bộ dữ liệu vào file `logs/bot.db` — không mất dữ liệu khi khởi động lại

### 4. Điều khiển từ xa
- REST API trên port 3000 với 7 endpoint
- Xem trạng thái, bật/dừng bot, xem log từ bất cứ đâu

---

## 🔑 Hướng dẫn cài đặt API Key (Quan trọng)

Để có thể đọc được thông tin tài sản và đặt lệnh thật, bạn cần cấp quyền API cho phần mềm.

### Cách lấy API trên MEXC:
1. Đăng nhập vào trang chủ [MEXC.com](https://www.mexc.com/).
2. Đưa chuột vào biểu tượng "Hồ sơ cá nhân" (Góc phải trên) → Chọn **Quản lý API**.
3. Bấm **Tạo API**.
4. Chọn các quyền: Tích chọn **Đọc dữ liệu** và **Giao dịch Futures**.

> ⚠️ **LƯU Ý BẢO MẬT:** Tuyệt đối **KHÔNG** tích chọn quyền **Rút tiền (Withdraw)** để đảm bảo an toàn 100% cho tài sản.

5. Tạo thành công, MEXC sẽ cấp cho bạn 2 mã: `API Key` và `Secret Key`. Copy cả hai.

### Cách nhập vào phần mềm:

**Chế độ Desktop (giao diện):**
1. Chuyển sang tab **Cài đặt (Settings)** (biểu tượng bánh răng).
2. Dán `API Key` và `Secret Key`.
3. Bấm Lưu. Khi hiển thị **API Connected** màu xanh lá là đã sẵn sàng.

**Chế độ Headless (VPS):**
1. Thêm vào file `.env`:
```env
MEXC_API_KEY=mã_api_key_của_bạn
MEXC_SECRET_KEY=mã_secret_key_của_bạn
```

---

## 🚀 Hướng dẫn sử dụng

### A. Chế độ Desktop (Giao diện)

#### Chạy
```bash
npm run dev
```

#### Đi lệnh theo gợi ý AI
1. Truy cập tab **AI Signals** (biểu tượng hình bộ não).
2. Theo dõi các tín hiệu. Chọn đồng coin bạn muốn.
3. Đọc phần **Lý do (Reasons)** để hiểu tại sao AI khuyên mua/bán.
4. Nếu đồng ý, bấm **Đặt lệnh theo tín hiệu này**.
5. Kiểm tra lại khối lượng, đòn bẩy → Bấm **Mở vị thế**.

---

### B. Chế độ Headless (Bot VPS)

#### Bước 1: Cấu hình
Tạo file `.env` trong thư mục gốc:
```env
BOT_MODE=simulation              # simulation = thử nghiệm, live = thật
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

#### Bước 2: Build và chạy
```bash
npm run build:bot
npm run start:bot
```

Bot sẽ hiển thị:
```
┌───────────────────────────────────────────────────────┐
│  🤖 MEXC Pro Futures Bot v2 — REST API                │
├───────────────────────────────────────────────────────┤
│  Port:      3000                                      │
│  Mode:      simulation                                │
│  Running:   true                                      │
└───────────────────────────────────────────────────────┘
```

#### Bước 3: Điều khiển từ xa qua REST API
```bash
# Kiểm tra bot còn sống không
curl http://localhost:3000/api/health

# Xem trạng thái đầy đủ (balance, PnL, circuit breakers...)
curl http://localhost:3000/api/status

# Dừng bot
curl -X POST http://localhost:3000/api/stop

# Bật lại bot
curl -X POST http://localhost:3000/api/start

# Xem 20 lệnh gần nhất
curl "http://localhost:3000/api/logs?limit=20"

# Xem lịch sử lệnh
curl "http://localhost:3000/api/orders?limit=20"

# Reset Circuit Breaker (khi TimesFM đã hồi lại)
curl -X POST http://localhost:3000/api/circuit-breaker/reset \
  -H "Content-Type: application/json" \
  -d '{"name":"timesfm"}'
```

#### Bước 4: Chạy với PM2 (khuyến nghị)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup     # Tự khởi động khi VPS reboot
```

Các lệnh PM2 hữu ích:
```bash
pm2 status              # Trạng thái tất cả process
pm2 logs mexc-ai-bot    # Log realtime
pm2 restart mexc-ai-bot # Restart
pm2 stop mexc-ai-bot    # Dừng
```

---

## 🔒 Quản lý rủi ro

1. **Luôn chạy `simulation` trước**: Đặt `BOT_MODE=simulation` để kiểm tra chiến lược trước khi dùng tiền thật.
2. **Giới hạn lỗ ngày**: Đặt `BOT_DAILY_LOSS_LIMIT=50` để bot tự dừng khi lỗ vượt ngưỡng.
3. **Kill Switch**: Bot sẽ tự dừng khi `autoTradeRunning = false` hoặc `autoTradeMode = off`.
4. **Giờ nghỉ**: Đặt `BOT_QUIET_HOURS_UTC=2-6` để bot không giao dịch trong giờ ít thanh khoản.
5. **Lọc tin tức**: `BOT_NEWS_FILTER=true` sẽ bỏ qua lệnh khi thị trường có tin xấu.
6. **Circuit Breaker**: Khi dịch vụ bên ngoài lỗi, bot tự động làm việc với những gì còn lại (không sập toàn bộ).

---

## ❓ Câu hỏi thường gặp

**H: Bot có tự rút tiền từ tài khoản của tôi được không?**

A: **Không**. Nếu bạn không cấp quyền Withdraw cho API Key, bot chỉ có thể đọc dữ liệu và đặt lệnh, không thể chuyển tiền ra ngoài.

**H: Bot hết bao nhiêu RAM?**

A: Khoảng 100–200MB. PM2 config giới hạn tối đa 250MB.

**H: Dữ liệu có mất khi restart không?**

A: **Không**. Từ Phase 2, toàn bộ dữ liệu được lưu vào SQLite (`logs/bot.db`). Khi bot khởi động lại, nó sẽ tự động load lại các lệnh đang mở và bài học giao dịch.

**H: TimesFM sập thì sao?**

A: Circuit Breaker sẽ tự động kích hoạt. Bot tiếp tục chạy dựa trên AI Debate + Phân tích kỹ thuật, không cần TimesFM.

**H: Mạng VPS chập chờn thì sao?**

A: WebSocket sẽ tự động kết nối lại với Exponential Backoff (1s → 2s → 4s... max 30s), tránh vấn đề spam kết nối.

---

Chúc bạn có một trải nghiệm giao dịch thuận lợi và an toàn! 🚀
