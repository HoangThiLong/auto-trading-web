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

## Disclaimer / Miễn trừ trách nhiệm
Trình duyệt web và công cụ này chỉ dành cho mục đích trình diễn kỹ thuật và giáo dục. Giao dịch tiền mã hóa phái sinh luôn tiềm ẩn rủi ro tài chính lớn. Nhà phát triển không chịu trách nhiệm cho bất kỳ tổn thất nào phát sinh.

---
*Developed by HoangLong — Optimized for Precision and Performance.*
