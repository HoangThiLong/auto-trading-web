# Deploy Checklist (Vercel + Render)

- [ ] Push code lên GitHub (branch sạch, đã commit).
- [ ] Tạo backend service trên Render bằng `render.yaml`.
- [ ] Set env backend trên Render:
  - [ ] `ALLOWED_ORIGINS=https://<your-vercel-domain>`
  - [ ] `MEXC_API_KEY`, `MEXC_SECRET_KEY`
  - [ ] `GEMINI_API_KEY`
- [ ] Deploy backend và test:
  - [ ] `GET /health`
  - [ ] `POST /api/forecast`
  - [ ] `GET /api/proxy/mexc/balance`
  - [ ] `POST /api/proxy/ai/chat`
- [ ] Tạo project frontend trên Vercel (dùng `vercel.json`).
- [ ] Set env frontend trên Vercel:
  - [ ] `VITE_TIMESFM_API_BASE_URL=https://<your-render-backend-domain>`
- [ ] Redeploy frontend và verify flow đặt lệnh + auto trade.
- [ ] Xác nhận browser không còn gọi trực tiếp secret API từ client.
