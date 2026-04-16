# MEXC Pro Futures Terminal v2

Tài liệu kỹ thuật đầy đủ cho mục đích **code audit chuyên sâu** (performance, stability, scalability) của hệ thống giao dịch futures tích hợp AI + TimesFM.

---

## 1) Mục tiêu dự án

MEXC Pro Futures Terminal là một trading terminal chạy trên web, tập trung vào:

- Phân tích kỹ thuật tự động (RSI, MACD, EMA, Bollinger, ATR, Stoch RSI).
- Tín hiệu AI đa nhà cung cấp (Gemini, Groq, OpenRouter, Together).
- Tự động giao dịch (simulation/live) với risk controls cơ bản.
- Dự báo chuỗi thời gian bằng **TimesFM backend** (FastAPI + PyTorch).
- Đồng bộ dữ liệu thị trường theo thời gian thực từ MEXC (REST + WebSocket).

Tài liệu này được viết để một senior developer có thể:

1. Nắm kiến trúc nhanh.
2. Định vị đúng các điểm nghẽn/bất ổn.
3. Đề xuất refactor có thứ tự ưu tiên.

---

## 2) Tech Stack thực tế trong code

## Frontend

- React 19 + TypeScript + Vite 7
- Zustand 5 + persist middleware
- lightweight-charts (biểu đồ)
- react-hot-toast
- lucide-react
- TailwindCSS 4

## Backend TimesFM

- Python 3.11
- FastAPI + Uvicorn
- NumPy
- PyTorch
- timesfm cài từ GitHub: `git+https://github.com/google-research/timesfm.git`

## Dữ liệu ngoài

- MEXC Futures REST API + WebSocket (`contract.mexc.com`)
- CryptoPanic API (tuỳ chọn key) + RSS fallback
- AI providers: Gemini, Groq, OpenRouter, Together

---

## 3) Cấu trúc thư mục

```text
information-about-mexc-exchange/
├─ src/
│  ├─ App.tsx
│  ├─ index.css
│  ├─ components/
│  │  ├─ AutoTradePanel.tsx
│  │  ├─ SignalPanel.tsx
│  │  ├─ TradingChart.tsx
│  │  ├─ OrderPanel.tsx
│  │  ├─ AccountPanel.tsx
│  │  ├─ ApiKeyModal.tsx
│  │  ├─ SettingsPanel.tsx
│  │  ├─ CoinList.tsx
│  │  ├─ OrderBook.tsx
│  │  ├─ TickerBar.tsx
│  │  └─ NewsFeed.tsx
│  ├─ services/
│  │  ├─ analysis.ts
│  │  ├─ capitalManager.ts
│  │  ├─ mexcApi.ts
│  │  ├─ geminiAi.ts
│  │  ├─ newsService.ts
│  │  └─ timesfmService.ts
│  ├─ store/
│  │  └─ useStore.ts
│  └─ types/
│     └─ index.ts
├─ timesfm-backend/
│  ├─ main.py
│  └─ requirements.txt
├─ vite.config.ts
├─ package.json
├─ HDSD.md
└─ README.md
```

---

## 4) Cài đặt và chạy local

## 4.1 Frontend

Yêu cầu: Node.js 18+ (khuyến nghị 20+)

```bash
npm install
npm run dev
```

Mặc định Vite chạy local (thường `http://localhost:5173`).

## 4.2 TimesFM Backend

Yêu cầu: Python 3.11

Cài dependencies trong `timesfm-backend/requirements.txt`.

Khởi chạy backend:

```bash
python main.py
```

hoặc:

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend đang gọi endpoint cố định:

- `http://127.0.0.1:8000/api/forecast`

## 4.3 Vite Proxy

`vite.config.ts` đã proxy:

- `/api/v1/contract/*` -> `https://contract.mexc.com`
- `/api/v1/private/*` -> `https://contract.mexc.com`

Điều này giúp frontend gọi MEXC bằng relative path, giảm lỗi CORS.

---

## 5) Luồng dữ liệu tổng quan

## 5.1 Market data flow

1. `App.tsx` poll `fetchAllTickers()` + `fetchContractInfo()` mỗi 10 giây.
2. `App.tsx` mở WS ticker cho `selectedSymbol`, cập nhật giá ~500ms throttle.
3. `TradingChart.tsx` mở WS kline cho chart hiện tại.
4. Data đổ vào Zustand (`useStore.ts`) -> nhiều component đọc chung.

## 5.2 Signal flow

1. `SignalPanel.tsx` lấy candles.
2. `analysis.ts/generateSignal()` tạo tín hiệu local.
3. Nếu có AI key: `geminiAi.ts/analyzeWithAI()` refine tín hiệu.
4. Nếu backend chạy: `timesfmService.ts` gọi TimesFM forecast để bổ sung context AI prompt.
5. Tín hiệu lưu về `signals[symbol]` trong store.

## 5.3 Auto-trade flow

1. Bật mode trong `AutoTradePanel.tsx` (`simulation` hoặc `live`).
2. Loop `setInterval(30s)` quét danh sách symbol.
3. Mỗi symbol: lấy signal (cache hoặc tính mới), kiểm tra risk/news/confidence.
4. Tính quantity bằng `calcPositionSize`.
5. Simulation: ghi `autoTradeLogs` + `pendingOrders`.
6. Live: gọi `placeOrder()` qua MEXC private API.
7. Loop riêng mỗi 15s check TP/SL cho lệnh open (local PnL tracking).

## 5.4 TimesFM flow

1. Frontend gửi `{ history, horizon }` -> `/api/forecast`.
2. `timesfm-backend/main.py` load model lúc startup.
3. Backend tương thích 2 nhánh API:
   - TimesFM 2.5 (`TimesFM_2p5_200M_torch` + `ForecastConfig`)
   - Legacy 1.x (`TimesFm` + `TimesFmHparams`)
4. Trả về `point_forecast` (array float) cho frontend.

---

## 6) Thành phần chính và trách nhiệm

## `src/store/useStore.ts`

- Single global store chứa cả:
  - market data
  - UI state
  - credentials
  - signals
  - orders
  - auto-trade config/logs
  - news sentiment
- Persist vào localStorage key: `mexc-pro-v2`.

## `src/components/App.tsx`

- Bố cục terminal chính.
- Poll market data, WS ticker, tab routing, panel sizing.
- Persist layout key: `mexc_layout_sizes_v1`.

## `src/services/mexcApi.ts`

- Wrapper REST bằng `fetch` (custom minimal client).
- Signed requests bằng HMAC SHA256 cho private API.
- WebSocket manager tự reconnect + ref-count subscription.

## `src/services/analysis.ts`

- Indicator engine + scoring LONG/SHORT.
- Market regime detection (TRENDING/RANGING/VOLATILE).
- Tạo output `TradeSignal` đầy đủ (TP/SL, confidence, reasons, etc.).

## `src/services/capitalManager.ts`

- Position sizing theo risk% + margin constraints.
- Kelly fraction helper.
- Quick historical win-rate estimation.
- Dynamic TP/SL helper.

## `src/components/SignalPanel.tsx`

- Trigger phân tích cho symbol hiện tại.
- Scan top market pairs theo volume.
- Hợp nhất local signal + AI signal + TimesFM context.

## `src/components/AutoTradePanel.tsx`

- Auto trading daemon (embedded trong React component).
- Risk checks: daily loss limit, max concurrent, news filter.
- Có simulation/live mode + kill switch UI.

## `timesfm-backend/main.py`

- Service dự báo riêng, khởi tạo model khi startup.
- Endpoint chính: `POST /api/forecast`.

---

## 7) Persistence & local state quan trọng

- `mexc-pro-v2` (Zustand persist):
  - API credentials, AI credentials
  - symbol/interval
  - autoTradeConfig
  - pendingOrders
  - tradeLessons
  - autoTradeLogs
  - autoTradeMode + autoTradeRunning
  - demoBalance
- `mexc_layout_sizes_v1`:
  - chiều rộng/cao panel trong App layout

---

## 8) Danh sách endpoint/API đang dùng

## MEXC Public

- `GET /api/v1/contract/ticker`
- `GET /api/v1/contract/kline/{symbol}`
- `GET /api/v1/contract/depth/{symbol}`
- `GET /api/v1/contract/funding_rate/{symbol}`
- `GET /api/v1/contract/detail`
- `GET /api/v1/contract/deals/{symbol}`

## MEXC Private (signed)

- `GET /api/v1/private/account/assets`
- `POST /api/v1/private/order/submit`
- `GET /api/v1/private/position/open_positions`
- `GET /api/v1/private/order/list/open_orders/{symbol?}`

## WebSocket

- `sub.ticker`
- `sub.kline`
- `sub.depth`
- `sub.deal`

## Local backend

- `POST http://127.0.0.1:8000/api/forecast`

---

## 9) Audit Hotspots (ưu tiên cao)

## P0 – Ảnh hưởng trực tiếp tới độ ổn định/lệnh

1. **Auto-trade loop gắn với React lifecycle** (`AutoTradePanel.tsx`).
2. **Không có mutex chống overlap run()**: nếu 1 vòng > 30s có thể chồng vòng kế tiếp.
3. **Rate-limit/429 handling còn thiếu** ở REST layer (retry/backoff/circuit breaker).
4. **Clock drift / signature timing** chưa có cơ chế sync thời gian server.

## P1 – Ảnh hưởng hiệu năng & scaling

1. **Zustand monolith**: cập nhật ticker thường xuyên có nguy cơ kéo re-render diện rộng.
2. **Indicator compute trên main thread** (`analysis.ts`) + scan nhiều cặp liên tục.
3. **TimesFM backend không có queue/semaphore**: dễ nghẽn khi concurrent requests tăng.

## P2 – Logic correctness / technical debt

1. `detectMarketRegime()` có biểu thức `rangeEfficiency` thực tế luôn ~1 (logic không còn ý nghĩa).
2. Một số PnL/margin đang dùng `0.0001` hardcoded thay vì `contractSize` theo từng symbol.
3. Simulation/lệnh hiển thị ở `AccountPanel` lọc `id.startsWith('sim_')`, trong khi auto simulation dùng `auto_*`.
4. `autoTradeRunning` được persist nhưng `App.tsx` mới chỉ log TODO, chưa có cơ chế resume daemon rõ ràng sau reload.

---

## 10) Các rủi ro kỹ thuật chi tiết (Risk Register)

| ID | Rủi ro | Mức độ | Thành phần |
|---|---|---|---|
| R1 | Overlap auto-trade cycles gây double-order | Critical | AutoTradePanel |
| R2 | Browser background throttling làm trễ loop | High | AutoTradePanel |
| R3 | Re-render nhiều do ticker updates vào global store | High | useStore + App |
| R4 | Thiếu retry/backoff chuẩn cho MEXC 429 | High | mexcApi |
| R5 | Main-thread analysis gây lag UI khi scan nhiều coin | Medium/High | analysis + SignalPanel |
| R6 | TimesFM backend dễ nghẽn khi gọi đồng thời | High | timesfm-backend |
| R7 | Sai số risk/PnL do contract size hardcode | Medium | AutoTradePanel/TradingChart |
| R8 | Persist state chứa credentials plaintext trong localStorage | Medium (security) | useStore |

---

## 11) Security review notes

- API key/secret hiện lưu localStorage qua Zustand persist.
- Không có lớp mã hoá ứng dụng-level cho dữ liệu nhạy cảm.
- Không có key rotation/audit logging.
- Cần review thêm CSP, XSS surface (vì key nằm phía client).

---

## 12) Observability / Debugging hiện trạng

Hiện hệ thống chủ yếu dùng `console.log/error` + toast, chưa có:

- Structured logging (theo event type / correlation id).
- Metrics (latency, error rate, retry count, order attempt/success).
- Tracing từ signal -> order.
- Health endpoint đầy đủ cho timesfm backend.

---

## 13) Checklist đề xuất cho Senior Audit

## A. State & Rendering

- [ ] Đo số lần render của các panel chính khi ticker update.
- [ ] Tách store thành nhiều slice hoặc nhiều store theo concern.
- [ ] Áp dụng selector + shallow compare + normalized map cho tickers.

## B. Auto-Trade Engine

- [ ] Tách daemon ra service/worker độc lập React.
- [ ] Thêm lock/mutex chống overlap run.
- [ ] Thêm idempotency guard cho order intent.
- [ ] Backtest deterministic cho logic trigger TP/SL.

## C. API Client Hardening

- [ ] Xây apiClient thống nhất (timeout, retry, jitter backoff).
- [ ] Handler riêng cho 429/5xx/network errors.
- [ ] Clock sync strategy cho signed requests.

## D. Analysis Performance

- [ ] Benchmark chi phí CPU `generateSignal` khi scan 24+ cặp.
- [ ] Đưa heavy compute sang Web Worker.
- [ ] Caching/Memoization theo (symbol, interval, lastCandleTime).

## E. TimesFM Backend

- [ ] Thêm semaphore/queue để giới hạn concurrent forecast.
- [ ] Timeout + request size guard + input length guard.
- [ ] Xem xét worker process riêng cho model inference.
- [ ] Chuẩn hoá endpoint health/readiness.

---

## 14) Gợi ý hướng refactor theo giai đoạn

## Phase 1 (Quick wins)

- Tạo `apiClient` chung với retry/backoff và error classification.
- Thêm mutex cho auto-trade `run()`.
- Sửa các chỗ hardcoded `0.0001` sang `contractSize`.
- Bổ sung structured logs cơ bản cho order lifecycle.

## Phase 2 (Stability)

- Tách auto-trade daemon khỏi React component.
- Tách Zustand store theo domain (`market`, `ui`, `trading`, `auth`).
- Chuyển scan/analysis nặng sang worker.

## Phase 3 (Scalability)

- Queue hóa TimesFM backend (Celery/RQ hoặc async worker pool).
- Thêm metrics + dashboard monitor.
- Chuẩn hoá kiểm thử integration cho signal -> order pipeline.

---

## 15) Troubleshooting nhanh

## TimesFM không trả forecast

- Kiểm tra backend có chạy trên `127.0.0.1:8000`.
- Kiểm tra `timesfm-backend/requirements.txt` đã cài thành công.
- Kiểm tra log startup xem model load thành công (`v2_5` hoặc `legacy`).

## Lỗi private API / không đặt được lệnh

- Xác thực API key/secret đúng.
- Kiểm tra quyền futures trade trong MEXC.
- Kiểm tra thời gian hệ thống máy local.
- Theo dõi response `HTTP 429` hoặc signature errors.

## UI lag khi scan

- Giảm scan frequency.
- Giảm số cặp scan.
- Tắt bớt panel nặng hoặc tối ưu selector store.

---

## 16) Thông tin vận hành quan trọng

- Đây là hệ thống giao dịch có thể gọi lệnh thật (live mode).
- Cần ưu tiên audit theo thứ tự: **độ an toàn lệnh > tính đúng logic > hiệu năng > mở rộng**.
- Mọi thay đổi production cần có guardrail (kill switch, daily loss cap, idempotency).

---

## 17) Ghi chú cuối

README này được biên soạn để phục vụ **technical deep audit** và chuyển giao cho dev có kinh nghiệm hơn.  
Nếu cần, có thể tách tiếp thành:

1. `ARCHITECTURE.md` (chi tiết luồng + sơ đồ).
2. `RISK_REGISTER.md` (tracking issue theo sprint).
3. `REFAC_PLAN.md` (kế hoạch refactor có milestone).
