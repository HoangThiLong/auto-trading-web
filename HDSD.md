# Hướng Dẫn Sử Dụng Chi Tiết Bot MEXC Pro Futures v2

Tài liệu này hướng dẫn đầy đủ cách cài đặt, cấu hình và vận hành Bot giao dịch tự động cho hai nền tảng: Máy tính (Windows/Mac/Linux) và Điện thoại Android (Termux).

---

## Phần 1. Chuẩn Bị Trước Khi Chạy Bot

### Bước 1.1: Lấy Khóa API từ Sàn MEXC

Để bot có thể đọc dữ liệu tài khoản và đặt lệnh giao dịch, bạn cần tạo API Key trên sàn MEXC.

1.  Đăng nhập vào trang chủ [MEXC.com](https://www.mexc.com/).
2.  Rê chuột vào biểu tượng hồ sơ cá nhân ở góc trên cùng bên phải → Chọn **Quản lý API**.
3.  Bấm **Tạo API**.
4.  Chọn quyền:
    -   ✅ Đọc dữ liệu tài khoản (Read)
    -   ✅ Giao dịch Futures (Trade)
    -   ❌ **KHÔNG CHỌN** quyền Rút tiền (Withdraw) vì lý do bảo mật.
5.  Sau khi hoàn tất xác minh, MEXC sẽ hiển thị 2 mã:
    -   `Access Key` (API Key)
    -   `Secret Key`
6.  **Lưu lại ngay** vì Secret Key chỉ hiện một lần duy nhất.

### Bước 1.2: Lấy Khóa AI Gemini

Bot cần AI để phân tích và đưa ra quyết định giao dịch.

1.  Truy cập: [Google AI Studio](https://aistudio.google.com/app/apikey)
2.  Đăng nhập bằng tài khoản Gmail.
3.  Bấm **Create API Key** → Chọn **Create in new project**.
4.  Copy mã API hiện ra.

### Bước 1.3: Tạo Bot Telegram (Không Bắt Buộc)

Nếu bạn muốn nhận thông báo tự động và điều khiển bot từ xa, hãy cấu hình Telegram Bot.

1.  Mở ứng dụng Telegram, tìm kiếm **@BotFather**.
2.  Gõ lệnh `/newbot` để tạo bot mới.
3.  Đặt tên cho bot (ví dụ: `MEXC Trading Bot`).
4.  BotFather sẽ trả về `HTTP API Token` → Copy và lưu lại (đây là `TELEGRAM_BOT_TOKEN`).
5.  Tìm kiếm bot vừa tạo và gửi tin nhắn bất kỳ (ví dụ: `/start`).
6.  Truy cập: `https://api.telegram.org/bot<TOKEN>/getUpdates`
    (Thay `<TOKEN>` bằng token ở bước 4).
7.  Trong kết quả JSON, tìm trường `"chat":{"id": ...` → Copy số ID đó (đây là `TELEGRAM_ADMIN_CHAT_ID`).

> **Lưu ý bảo mật:** Chỉ có Chat ID được cấu hình trong `.env` mới có thể gửi lệnh điều khiển bot. Tin nhắn từ người lạ sẽ bị bỏ qua.

---

## Phần 2. Cấu Hình Bot

### Bước 2.1: Tạo File Cấu Hình

1.  Tìm file `.env.example` trong thư mục gốc của dự án.
2.  Tạo bản sao và đổi tên thành `.env`.
3.  Mở file `.env` bằng Notepad (trên máy tính) hoặc Nano (trên Termux).
4.  Dán nội dung mẫu dưới đây và điền thông tin của bạn:

```env
# ========== THÔNG SỐ CƠ BẢN ==========
# simulation = chạy giả (không mất tiền) | live = tiền thật
BOT_MODE=simulation

# Các đồng coin cách nhau bằng dấu phẩy
BOT_SYMBOLS=BTC,ETH,SOL

# ========== QUẢN LÝ RỦI RO ==========
# % độ tin cậy tối thiểu để bot vào lệnh (70 = an toàn)
BOT_MIN_CONFIDENCE=70

# % vốn dùng cho mỗi lệnh
BOT_RISK_PERCENT_PER_TRADE=1

# Số lệnh mở cùng lúc tối đa
BOT_MAX_CONCURRENT_ORDERS=3

# Lỗ bao nhiêu USDT thì bot tự dừng trong ngày
BOT_DAILY_LOSS_LIMIT=50

# Bật lọc tin tức thị trường? (true/false)
BOT_NEWS_FILTER=true

# Giờ nghỉ (UTC), VD: 2-6 tức là nghỉ từ 9h-1h chiều VN
BOT_QUIET_HOURS_UTC=2-6

# ========== API CỦA BẠN ==========
MEXC_API_KEY=dán_access_key_vào_đây
MEXC_SECRET_KEY=dán_secret_key_vào_đây

# AI dùng để phân tích (Gemini khuyên dùng)
GEMINI_API_KEY=dán_gemini_key_vào_đây
AI_PREFERRED_PROVIDER=gemini

# ========== TELEGRAM BOT (Tùy Chọn) ==========
TELEGRAM_BOT_TOKEN=dán_token_bot_vào_đây
TELEGRAM_ADMIN_CHAT_ID=dán_chat_id_của_bạn_vào_đây
```

*Trên Termux, sau khi dùng lệnh `nano .env`:*
- Nhấn **Ctrl + O** để lưu, **Enter** xác nhận, **Ctrl + X** để thoát.

---

## Phần 3. Cách Chạy Bot Trên Máy Tính (Windows/Mac/Linux)

### Cách A: Chạy Có Giao Diện (Desktop Mode)

Dành cho người muốn nhìn biểu đồ, tin tức và tự bấm nút đặt lệnh.

```bash
# Cài đặt thư viện (chỉ chạy một lần)
npm install

# Chạy phần mềm
npm run dev
```

Khi phần mềm mở ra:
- Vào tab **AI Signals** để xem tín hiệu AI khuyên mua/bán.
- Nếu đồng ý, bấm **Mở Vị Thế** để đặt lệnh.

### Cách B: Chạy Ngầm Tự Động (Headless Mode)

Dành cho người muốn bot tự chạy 24/7 mà không cần mở cửa sổ giao diện.

```bash
# Cài đặt thư viện
npm install

# Build bot
npm run build:bot

# Chạy bot
node dist-bot/bot.js
```

Nếu thành công, màn hình sẽ hiện:

```
┌───────────────────────────────────────────────────────┐
│  🤖 MEXC Pro Futures Bot v2 — REST API                │
├───────────────────────────────────────────────────────┤
│  Port:      3000                                      │
│  Mode:      simulation                                │
│  Running:   true                                      │
└───────────────────────────────────────────────────────┘
```

---

## Phần 4. Cách Chạy Bot Trên Điện Thoại Android (Termux)

Máy tính bạn có thể tắt, nhưng điện thoại thì có thể mang theo. Đây là cách biến điện thoại thành máy chủ bot.

### Bước 4.1: Cài Đặt Termux

1.  **Gỡ Termux** nếu đã cài từ Play Store (bản cũ).
2.  Tải bản mới từ: [https://f-droid.org/repo/com.termux_118.apk](https://f-droid.org/repo/com.termux_118.apk)
3.  Cài đặt file APK.

### Bước 4.2: Cấp Quyền Chạy Ngầm (Quan trọng)

Để bot không bị Android tắt khi tắt màn hình:

1.  Mở Termux, vuốt thanh thông báo xuống.
2.  Nhấn vào dòng **"Acquiring Wake Lock"** để giữ cho ứng dụng hoạt động.
3.  Vào **Cài đặt → Ứng dụng → Termux → Pin**.
4.  Chọn **Không tối ưu hóa**.

### Bước 4.3: Cài Đặt Công Cụ

Mở Termux và chạy từng lệnh:

```bash
# Cập nhật hệ thống
pkg update && pkg upgrade -y
# (Nhấn 'y' nếu được hỏi)

# Cài Node.js và Git
pkg install nodejs-lts git -y
```

### Bước 4.4: Tải Code Về Điện Thoại

**Cách A: Clone từ GitHub (Nếu đã đẩy code lên)**
```bash
git clone https://github.com/HoangThiLong/auto-trading-web.git
cd auto-trading-web
```

**Cách B: Copy thủ công (Nếu chưa push lên GitHub)**
1.  Nén thư mục dự án thành `.zip` trên máy tính.
2.  Gửi file qua Zalo/Telegram/Google Drive.
3.  Trên Termux, vào thư mục chứa file (thường là `/sdcard/download`):
    ```bash
    cd /sdcard/download
    unzip ten_file.zip -d $HOME
    cd ten_folder
    ```

### Bước 4.5: Cài Đặt & Chạy Bot

```bash
# Cài thư viện runtime (KHÔNG cài Electron/Desktop)
npm install --omit=dev

# Cài gói biên dịch tối thiểu cho bot (không kéo theo Electron)
npm install --no-save --omit=dev typescript @types/node @types/express @types/crypto-js

# Build bot (biên dịch code)
npx tsc -p tsconfig.bot.json

# Chạy bot
node dist-bot/bot.js
```

> **Lưu ý:** Trên Termux KHÔNG dùng `npm install` thường vì nó sẽ cố cài Electron (không hỗ trợ Android).

**Để chạy ổn định 24/7, cài đặt PM2:**

```bash
npm install -g pm2

# Chạy bot bằng PM2 (tự khởi động lại khi bị lỗi)
pm2 start dist-bot/bot.js --name "mexc-bot"

# Lưu cấu hình PM2
pm2 save
```

**Các lệnh PM2 cần nhớ:**
| Lệnh | Công dụng |
|------|-----------|
| `pm2 status` | Xem bot còn chạy không |
| `pm2 logs mexc-bot` | Xem log giao dịch realtime |
| `pm2 restart mexc-bot` | Khởi động lại bot |
| `pm2 stop mexc-bot` | Dừng bot |

### Bước 4.6: Truy Cập Bot Từ Trình Duyệt

**Trên điện thoại:**
Mở Chrome và gõ: `http://localhost:3000/api/status`

**Từ máy tính (cùng Wi-Fi):**
1.  Trong Termux, gõ `ifconfig`, tìm địa chỉ `192.168.x.x`.
2.  Trên máy tính, gõ: `http://192.168.x.x:3000/api/status`

---

## Phần 5. Kiểm Tra Bot Khi Chạy Ngầm

Khi bot chạy ở chế độ Headless, nó mở cổng `3000`. Bạn có thể kiểm tra bằng trình duyệt hoặc lệnh curl:

| Mục đích | Địa chỉ / Lệnh |
|----------|----------------|
| Xem tình hình tiền & lãi/lỗ | [http://localhost:3000/api/status](http://localhost:3000/api/status) |
| Xem lịch sử lệnh | [http://localhost:3000/api/orders?limit=10](http://localhost:3000/api/orders?limit=10) |
| Xem log giao dịch | [http://localhost:3000/api/logs?limit=10](http://localhost:3000/api/logs?limit=10) |
| Kiểm tra bot còn sống | `curl http://localhost:3000/api/health` |
| **Dừng bot khẩn cấp** | `curl -X POST http://localhost:3000/api/stop` |
| Bật bot lại | `curl -X POST http://localhost:3000/api/start` |

### Phần 5.1: Kết Nối Telegram Với Bot

Sau khi đã cấu hình `TELEGRAM_BOT_TOKEN` và `TELEGRAM_ADMIN_CHAT_ID` trong `.env`:

1.  Build lại bot:
    ```bash
    npm run build:bot
    ```
2.  Chạy bot:
    ```bash
    node dist-bot/bot.js
    ```
3.  Mở Telegram, vào đúng bot bạn đã tạo ở Bước 1.3.
4.  Trong chính tài khoản Telegram có Chat ID đã khai báo, gửi lệnh `/status`.
5.  Nếu bot trả trạng thái hệ thống, kết nối Telegram đã thành công.

> **Quan trọng:** Chỉ Chat ID trùng với `TELEGRAM_ADMIN_CHAT_ID` mới điều khiển được bot. Chat ID lạ sẽ bị từ chối im lặng.

### Phần 5.2: Cách Sử Dụng Telegram Để Điều Khiển Bot

| Lệnh Telegram | Công dụng |
|---------------|-----------|
| `/status` | Xem nhanh trạng thái bot (mode, running, balance, PnL, thống kê lệnh) |
| `/startbot` | Bật bot giao dịch tự động từ xa |
| `/stopbot` | Dừng bot giao dịch tự động từ xa |

### Phần 5.3: Các Cảnh Báo Telegram Bạn Sẽ Nhận

Khi Telegram đã kết nối, bot sẽ gửi cảnh báo theo sự kiện:

- `ORDER_OPENED`: Có lệnh mới được mở.
- `TP_HIT`: Lệnh chạm Take Profit.
- `SL_HIT`: Lệnh chạm Stop Loss.
- `DAILY_LOSS_LIMIT`: Chạm mức lỗ ngày, bot tự dừng để bảo vệ vốn.
- Trạng thái Circuit Breaker đổi (`CLOSED` ↔ `HALF_OPEN` ↔ `OPEN`).

---

## Phần 6. Câu Hỏi Thường Gặp (Q&A)

**H: Bot không chạy, toàn báo lỗi đỏ là sao?**
A: Kiểm tra lại file `.env` đã điền đủ GEMINI_API_KEY chưa. Nếu để trống, bot sẽ không có AI để phân tích và báo lỗi ngay từ đầu.

**H: Tại sao bot không chịu đặt lệnh dù thị trường lên xuống?**
A: Bot hoạt động theo nguyên tắc "Debate" - tức là 4 AI phải đồng thuận. Nếu đang trong giờ nghỉ (Quiet Hours), hoặc tin tức thị trường xấu (News Filter), hoặc độ tin cậy chưa đạt mức tối thiểu (MIN_CONFIDENCE), bot sẽ không vào lệnh. Đây là cơ chế an toàn.

**H: Điện thoại bị tắt màn hình liệu bot có chết không?**
A: Nếu bạn đã cấp quyền Wake Lock và cài PM2, bot sẽ tiếp tục chạy. Nếu điện thoại tắt hẳn, khi bật lại và gõ lệnh `pm2 start` hoặc `node dist-bot/bot.js`, bot sẽ tự động load lại toàn bộ trạng thái từ cơ sở dữ liệu SQLite (`logs/bot.db`) - các lệnh đang mở sẽ được nhớ lại.

**H: Tôi muốn chạy thử (Simulation) trước khi dùng tiền thật?**
A: Đảm bảo trong file `.env` có dòng `BOT_MODE=simulation`. Bot sẽ dùng 10,000 USDT ảo để giao dịch. Khi thấy ổn định, đổi thành `BOT_MODE=live`.

**H: API Key lộ ra ngoài có nguy hiểm không?**
A: Miễn là bạn **không cấp quyền Withdraw** (Rút tiền) khi tạo API trên MEXC, dù ai đó có lấy được API Key cũng không thể chuyển tiền ra khỏi tài khoản của bạn.

---

## Tóm Tắt Lệnh Quan Trọng

```bash
# === TRÊN MÁY TÍNH ===
npm install              # Cài thư viện
npm run dev              # Chạy giao diện
npm run build:bot        # Build bot ngầm
node dist-bot/bot.js     # Chạy bot ngầm

# === TRÊN TERMUX (ĐIỆN THOẠI) ===
cd auto-trading-web
npm install --omit=dev
npm install --no-save --omit=dev typescript @types/node @types/express @types/crypto-js
npx tsc -p tsconfig.bot.json
node dist-bot/bot.js
pm2 start dist-bot/bot.js --name "mexc-bot"
pm2 status              # Xem trạng thái
pm2 logs mexc-bot        # Xem log

# === KIỂM TRA ===
curl http://localhost:3000/api/status   # Xem trạng thái
curl -X POST http://localhost:3000/api/stop   # Dừng bot
```
