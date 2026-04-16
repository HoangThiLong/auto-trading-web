# Hướng Dẫn Sử Dụng: MEXC Pro Futures Terminal

## 🌟 Giới thiệu tổng quan
MEXC Pro Futures Terminal là một phần mềm giao dịch tự tùy chỉnh được thiết kế dành riêng cho thị trường hợp đồng tương lai (Futures) trên sàn MEXC. Điểm nổi bật nhất của phần mềm là tích hợp hệ thống **AI Signal Engine** - tự động phân tích thị trường 24/7 và gợi ý lệnh chuẩn xác.

## 🛠️ Tính năng chính
1. **Biểu đồ thời gian thực (Chart):** Tích hợp biểu đồ nến siêu mượt từ TradingView (Lightweight Charts), liên tục cập nhật giá từ MEXC.
2. **Hệ thống tín hiệu AI (AI Signal):** 
   - Tự động lấy các dữ liệu nến.
   - Chạy qua các màng lọc phân tích kỹ thuật: RSI, MACD, Bollinger Bands, EMA (20, 50, 200), ATR và Khối lượng giao dịch (Volume).
   - Đưa ra khuyến nghị **LONG** hoặc **SHORT** với giải thích rõ ràng tại sao lại mua/bán.
   - Tự động gợi ý mức **Chốt lời (Take Profit)** và **Cắt lỗ (Stop Loss)** tối ưu.
3. **Thực thi lệnh thật (Live Execution):** Đẩy lệnh thẳng lên server MEXC thông qua API chỉ với 1 cú click.

---

## 🔑 Hướng dẫn cài đặt API Key (Quan trọng)
Để có thể đọc được thông tin tài sản và đặt lệnh thật, bạn cần cấp quyền API cho phần mềm.

**Cách lấy API trên MEXC:**
1. Đăng nhập vào trang chủ [MEXC.com](https://www.mexc.com/).
2. Đưa chuột vào biểu tượng "Hồ sơ cá nhân" (Góc phải trên) -> Chọn **Quản lý API** (API Management).
3. Bấm **Tạo API**.
4. Chọn các quyền (Permissions): Tích chọn các quyền liên quan đến **Đọc dữ liệu** và **Giao dịch Futures** (Ví dụ: Đặt lệnh, Xem vị thế).
   > **⚠️ LƯU Ý BẢO MẬT:** Tuyệt đối KHÔNG tích chọn quyền **Rút tiền (Withdraw)** để đảm bảo an toàn 100% cho tài sản của bạn.
5. Tạo thành công, MEXC sẽ cấp cho bạn 2 mã: `API Key` và `Secret Key`. Hãy copy cả hai mã này.

**Cách nhập vào phần mềm:**
1. Trên giao diện phần mềm, chuyển sang tab **Cài đặt (Settings)** (biểu tượng bánh răng).
2. Dán `API Key` và `Secret Key` vừa copy vào.
3. Bấm Lưu. Khi thanh trạng thái phía trên hiển thị **API Connected** màu xanh lá nghĩa là phần mềm đã sẵn sàng.

---

## 🚀 Hướng dẫn đi lệnh gợi ý từ AI
1. Truy cập tab **AI Signals (Tín hiệu AI)** (biểu tượng hình bộ não).
2. Theo dõi các tín hiệu được đẩy ra. Chọn đồng coin bạn muốn.
3. Đọc phần **Lý do (Reasons)** để hiểu tại sao AI lại khuyên mua/bán ở điểm đó.
4. Nếu bạn đồng ý với tín hiệu, bấm nút **Đặt lệnh thao tín hiệu này** (hoặc biểu tượng hình túi xách rổ hàng).
5. Phần mềm sẽ tự động chuyển sang tab Đặt lệnh, điền sẵn thông số giá Entry, Take Profit và Stop Loss.
6. Bạn hãy kiểm tra lại Khối lượng (Vol) và Đòn bẩy (Leverage) -> Bấm **Mở vị thế**.

Chúc bạn có một trải nghiệm giao dịch thuận lợi và an toàn!
