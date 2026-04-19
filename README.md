# MEXC Pro Futures Trading Terminal v2

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

<a name="english"></a>
## English Version

An advanced, automated trading platform for MEXC Futures, integrating Google's TimesFM time-series foundation model and Gemini AI for signal processing and automated execution.

### Overview
MEXC Pro Futures Terminal v2 is a high-performance trading interface and automated execution engine designed for professional traders. The system focuses on real-time data processing, predictive analytics, and robust risk management.

### Technical Highlights
*   **Predictive Analytics**: Integration with **TimesFM** (Google Research), providing advanced time-series forecasting to anticipate market trends.
*   **AI-Driven Signal Processing**: Utilizing **Gemini AI** and high-speed LLMs (via Groq) to analyze market indicators, filtering noise and validating entry/exit signals.
*   **Autonomous Execution Engine**: A multi-threaded trading engine that handles position management, dynamic SL/TP updates, and order execution 24/7.
*   **Professional UI/UX**: A split-screen terminal built with a robust design system, prioritizing data density and financial-grade reliability.
*   **Risk Management Protocol**: Integrated safety features including 'Kill Switch', daily loss limits, and news-based filters to protect capital.

### Technology Stack
- **Frontend**: React 19 (TypeScript), Vite, Zustand 5, Modern CSS (Design System).
- **Backend & AI**: FastAPI / PyTorch (TimesFM), Gemini API, Groq.
- **Data**: MEXC WebSocket & REST API v3.

---

<a name="tiếng-việt"></a>
## Tiếng Việt

Nền tảng giao dịch tự động nâng cao cho MEXC Futures, tích hợp mô hình dự báo chuỗi thời gian TimesFM từ Google và trí tuệ nhân tạo Gemini để xử lý tín hiệu và thực thi lệnh tự động.

### Tổng quan
MEXC Pro Futures Terminal v2 là giao diện giao dịch hiệu suất cao và công cụ thực thi tự động dành cho các nhà giao dịch chuyên nghiệp. Hệ thống tập trung vào xử lý dữ liệu thời gian thực, phân tích dự báo và quản trị rủi ro chặt chẽ.

### Điểm nhấn Kỹ thuật
*   **Phân tích Dự báo**: Tích hợp **TimesFM** (Google Research), cung cấp khả năng dự báo chuỗi thời gian tiên tiến để đón đầu xu hướng thị trường.
*   **Xử lý Tín hiệu bằng AI**: Sử dụng **Gemini AI** và các mô hình ngôn ngữ lớn tốc độ cao (qua Groq) để phân tích các chỉ báo, loại bỏ nhiễu và xác nhận điểm vào/thoát lệnh.
*   **Cơ chế Thực thi Tự động**: Hệ thống giao dịch đa luồng xử lý quản lý vị thế, cập nhật SL/TP động và thực thi lệnh liên tục 24/7.
*   **Giao diện Chuyên nghiệp**: Terminal chia màn hình (split-screen) được xây dựng trên hệ thống thiết kế chuẩn mực, ưu tiên mật độ dữ liệu và độ tin cậy cấp độ tài chính.
*   **Giao thức Quản trị Rủi ro**: Tích hợp các tính năng an toàn như 'Kill Switch', giới hạn lỗ hàng ngày và bộ lọc tin tức để bảo vệ vốn.

### Công nghệ sử dụng
- **Frontend**: React 19 (TypeScript), Vite, Zustand 5, Modern CSS.
- **Backend & AI**: FastAPI / PyTorch (TimesFM), Gemini API, Groq.
- **Dữ liệu**: MEXC WebSocket & REST API v3.

---

## Getting Started / Khởi động

### Installation / Cài đặt
1.  **Clone and Install:**
    ```bash
    git clone https://github.com/HoangThiLong/auto-trading-web.git
    cd auto-trading-web
    npm install
    ```
2.  **Run:**
    ```bash
    npm run dev
    ```

---

## Hướng dẫn đưa Bot lên VPS Linux (Headless Mode)

### Bước 1: Cài đặt PM2
```bash
npm install -g pm2
```

### Bước 2: Tạo file .env trên VPS
Tạo file `.env` trong thư mục gốc của project với các biến môi trường cần thiết:

```env
# Bot Configuration
BOT_MODE=simulation
BOT_AUTO_START=true
BOT_SYMBOLS=BTC,ETH,SOL
BOT_MIN_CONFIDENCE=70
BOT_RISK_PERCENT_PER_TRADE=1
BOT_MAX_CONCURRENT_ORDERS=3
BOT_DAILY_LOSS_LIMIT=50

# MEXC API Keys (Live Mode)
MEXC_API_KEY=your_api_key_here
MEXC_SECRET_KEY=your_secret_key_here

# AI Provider (Optional)
GEMINI_API_KEY=your_gemini_key
# Hoặc sử dụng các provider khác:
# GROQ_API_KEY=your_groq_key
# OPENROUTER_API_KEY=your_openrouter_key
# TOGETHER_API_KEY=your_together_key

# TimesFM Backend (Optional, nếu có local server)
# TIMESFM_API_BASE_URL=http://127.0.0.1:8000

# Logging
BOT_LOG_LEVEL=info
```

### Bước 3: Build Bot và Deploy
```bash
# Build bot
npm run build:bot

# Khởi động với PM2
pm2 start ecosystem.config.js

# Lưu cấu hình PM2 để tự khởi động khi VPS reboot
pm2 save

# Cấu hình startup script (sau khi chạy pm2 save, chạy lệnh này để lấy startup command)
pm2 startup
```

### Các lệnh vận hành
```bash
# Xem trạng thái bot
pm2 status mexc-ai-bot

# Xem log realtime
pm2 logs mexc-ai-bot

# Hoặc xem log file
tail -f logs/bot_trading.log

# Restart bot
pm2 restart mexc-ai-bot

# Dừng bot
pm2 stop mexc-ai-bot

# Xóa bot khỏi PM2
pm2 delete mexc-ai-bot
```

### Quản lý Rủi ro
- Đặt `BOT_MODE=simulation` để chạy ở chế độ mô phỏng trước.
- Giới hạn RAM: 250MB trong `ecosystem.config.js`.
- Tự động restart khi crash: `autorestart: true`.

## Disclaimer / Miễn trừ trách nhiệm
Trình duyệt web và công cụ này chỉ dành cho mục đích trình diễn kỹ thuật và giáo dục. Giao dịch tiền mã hóa phái sinh luôn tiềm ẩn rủi ro tài chính lớn. Nhà phát triển không chịu trách nhiệm cho bất kỳ tổn thất nào phát sinh.

---
*Developed by HoangLong — Optimized for Precision and Performance.*
