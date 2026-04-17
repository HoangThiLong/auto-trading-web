# MEXC Pro Futures Trading Terminal v2

An advanced, automated trading platform for MEXC Futures, integrating Google's TimesFM time-series foundation model and Gemini AI for signal processing and automated execution.

---

## Overview

MEXC Pro Futures Terminal v2 is a high-performance trading interface and automated execution engine designed for professional traders. The system focuses on real-time data processing, predictive analytics, and robust risk management.

## Technical Highlights

*   **Predictive Analytics**: Integration with **TimesFM** (Google Research), providing advanced time-series forecasting to anticipate market trends.
*   **AI-Driven Signal Processing**: Utilizing **Gemini AI** and high-speed LLMs (via Groq) to analyze market indicators, filtering noise and validating entry/exit signals.
*   **Autonomous Execution Engine**: A multi-threaded trading engine that handles position management, dynamic SL/TP updates, and order execution 24/7.
*   **Professional UI/UX**: A split-screen terminal built with a robust design system, prioritizing data density and financial-grade reliability.
*   **Risk Management Protocol**: Integrated safety features including 'Kill Switch', daily loss limits, and news-based filters to protect capital.

## Technology Stack

### Frontend
- **Framework**: React 19 (TypeScript)
- **Build Tool**: Vite
- **State Management**: Zustand 5 (Global persistent store)
- **Styling**: Modern CSS with semantic tokenization (Coinbase-inspired)
- **Data Fetching**: Custom WebSocket handlers & MEXC REST API v3

### Backend & AI
- **TimesFM Intelligence**: FastAPI / PyTorch backend for time-series foundation model inference.
- **LLM Integration**: Gemini API & Groq for low-latency market analysis.
- **Processing**: Off-main-thread Web Workers for high-frequency signal calculation.

## Getting Started

### Prerequisites
- Node.js (v18+)
- NPM or Yarn
- (Optional) Python 3.10+ for TimesFM backend

### Installation

1.  **Clone and Install Dependencies:**
    ```bash
    git clone https://github.com/HoangThiLong/auto-trading-web.git
    cd auto-trading-web
    npm install
    ```

2.  **Environment Setup:**
    Create a `.env` file in the root directory (refer to documentation for required API keys).

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```

4.  **TimesFM Backend (Optional):**
    Navigate to `/timesfm-backend` and follow the instructions in the directory to start the inference server.

## Disclaimer

This software is for technical demonstration and educational purposes. Trading cryptocurrency futures involves significant risk. The developers are not responsible for financial losses incurred through the use of this terminal. Always test extensively in simulation mode before deploying capital.

---

*Developed by HoangLong — Optimized for Precision and Performance.*
