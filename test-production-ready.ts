import 'dotenv/config';
import { timeSyncManager, fetchAccountInfo, fetchAllTickers, fetchKlines, fetchOrderBook, fetchOpenPositions, placeOrder } from './src/services/mexcApi';
import { CircuitBreaker } from './src/services/circuitBreaker';
import { calcPositionSize } from './src/services/capitalManager';
import { analyzeNewsSentiment, isSafeToTrade } from './src/services/newsService';
import { DatabaseAdapter } from './src/database/db';
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';

// ===========================================================================
// PRODUCTION READINESS TEST — MEXC Pro Futures Bot v2
// Chay tat ca check nay deu PASS = co the dung tien that
// ===========================================================================

// --- [CONFIG] ---------------------------------------------------------------
const API_KEY    = process.env.MEXC_API_KEY    || '';
const SECRET_KEY = process.env.MEXC_SECRET_KEY || '';
const TEST_SYMBOL = 'BTC_USDT';
// ---------------------------------------------------------------------------

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed:   '\x1b[41m',
  bgYellow: '\x1b[43m',
};

const TOTAL_SECTIONS = 8;
let results: Array<{ section: string; passed: number; failed: number; warnings: number }> = [];
let currentSection = '';
let sectionPassed = 0;
let sectionFailed = 0;
let sectionWarnings = 0;

function beginSection(n: number, title: string) {
  // save previous section
  if (currentSection) {
    results.push({ section: currentSection, passed: sectionPassed, failed: sectionFailed, warnings: sectionWarnings });
  }
  sectionPassed = 0; sectionFailed = 0; sectionWarnings = 0;
  currentSection = title;
  const bar = '='.repeat(56);
  console.log(`\n${C.cyan}${C.bold}${bar}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  [${n}/${TOTAL_SECTIONS}] ${title}${C.reset}`);
  console.log(`${C.cyan}${bar}${C.reset}`);
}

function pass(msg: string, detail?: string) {
  sectionPassed++;
  const d = detail ? `  ${C.dim}(${detail})${C.reset}` : '';
  console.log(`  ${C.green}✅ PASS${C.reset}  ${msg}${d}`);
}

function fail(msg: string, detail?: string) {
  sectionFailed++;
  const d = detail ? `  ${C.dim}(${detail})${C.reset}` : '';
  console.log(`  ${C.red}❌ FAIL${C.reset}  ${msg}${d}`);
}

function warn(msg: string, detail?: string) {
  sectionWarnings++;
  const d = detail ? `  ${C.dim}(${detail})${C.reset}` : '';
  console.log(`  ${C.yellow}⚠️  WARN${C.reset}  ${msg}${d}`);
}

function info(msg: string) {
  console.log(`  ${C.dim}ℹ  ${msg}${C.reset}`);
}

function finalizeSection() {
  results.push({ section: currentSection, passed: sectionPassed, failed: sectionFailed, warnings: sectionWarnings });
  currentSection = '';
  sectionPassed = 0; sectionFailed = 0; sectionWarnings = 0;
}

// ===========================================================================
// MAIN
// ===========================================================================
async function main() {
  const startTs = Date.now();

  // Header
  console.log(`\n${C.bold}${C.cyan}`);
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║    MEXC PRO FUTURES BOT v2 — PRODUCTION READINESS   ║');
  console.log('  ║            ALL-IN-ONE SYSTEM TEST SUITE             ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log(C.reset);
  console.log(`  ${C.dim}Timestamp : ${new Date().toLocaleString('vi-VN')}${C.reset}`);
  console.log(`  ${C.dim}Symbol    : ${TEST_SYMBOL}${C.reset}`);
  console.log(`  ${C.dim}API Key   : ${API_KEY.slice(0, 6)}...${API_KEY.slice(-4)}${C.reset}`);

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: TIME SYNC
  // ─────────────────────────────────────────────────────────────────────────
  beginSection(1, 'Dong bo thoi gian (Time Sync)');
  try {
    await timeSyncManager.syncTime();
    const offset = timeSyncManager.getOffset();
    info(`Clock offset voi MEXC server: ${offset}ms`);

    if (Math.abs(offset) > 10000) {
      warn('Do lech thoi gian NGUY HIEM', `${offset}ms > 10000ms — lenh se bi tu choi`);
    } else if (Math.abs(offset) > 5000) {
      warn('Do lech thoi gian kha lon', `${offset}ms (nen < 5000ms)`);
    } else {
      pass('Dong bo thoi gian thanh cong', `offset = ${offset}ms`);
    }

    // Verify timestamp dung duoc de sign request
    const ts = timeSyncManager.getServerTimestamp();
    const tsNum = parseInt(ts, 10);
    if (tsNum > 1_700_000_000_000 && tsNum < 2_000_000_000_000) {
      pass('Server timestamp hop le', ts);
    } else {
      fail('Server timestamp bat thuong', ts);
    }
  } catch (e: any) {
    fail('Khong the dong bo thoi gian', e.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: PUBLIC MARKET DATA
  // ─────────────────────────────────────────────────────────────────────────
  beginSection(2, 'Du lieu thi truong cong khai (Public Market Data)');

  // 2a: Tickers
  try {
    const tickers = await fetchAllTickers();
    if (tickers.length >= 10) {
      pass(`fetchAllTickers()`, `${tickers.length} contracts`);
      const btcTicker = tickers.find(t => t.symbol === TEST_SYMBOL);
      if (btcTicker && Number(btcTicker.lastPrice) > 0) {
        pass(`${TEST_SYMBOL} gia hien tai`, `$${Number(btcTicker.lastPrice).toLocaleString()}`);
      } else {
        warn(`Khong tim thay ticker ${TEST_SYMBOL}`);
      }
    } else {
      fail('fetchAllTickers() tra ve qua it ket qua', `${tickers.length}`);
    }
  } catch (e: any) {
    fail('fetchAllTickers() loi', e.message);
  }

  // 2b: Klines
  try {
    const klines = await fetchKlines(TEST_SYMBOL, 'Min15', 100);
    if (klines && Array.isArray(klines.close) && klines.close.length >= 50) {
      pass(`fetchKlines(${TEST_SYMBOL})`, `${klines.close.length} candles`);

      // Validate candle data
      const lastClose = klines.close[klines.close.length - 1];
      if (lastClose > 0) {
        pass('Gia dong cua cuoi cung hop le', `$${lastClose.toLocaleString()}`);
      } else {
        fail('Gia dong cua = 0 hoac am');
      }
    } else {
      fail(`fetchKlines(${TEST_SYMBOL}) tra ve du lieu khong du`, `${klines?.close?.length ?? 0} candles`);
    }
  } catch (e: any) {
    fail('fetchKlines() loi', e.message);
  }

  // 2c: Order Book
  try {
    const ob = await fetchOrderBook(TEST_SYMBOL, 5);
    if (ob && ob.bids && ob.asks && ob.bids.length > 0 && ob.asks.length > 0) {
      const bestBid = ob.bids[0];
      const bestAsk = ob.asks[0];
      pass('fetchOrderBook() hop le', `bid=${bestBid[0]}, ask=${bestAsk[0]}`);
      const spread = (Number(bestAsk[0]) - Number(bestBid[0])) / Number(bestBid[0]) * 100;
      if (spread < 0.1) {
        pass('Spread hop ly', `${spread.toFixed(4)}%`);
      } else {
        warn('Spread lon bat thuong', `${spread.toFixed(4)}%`);
      }
    } else {
      fail('fetchOrderBook() tra ve du lieu khong hop le');
    }
  } catch (e: any) {
    fail('fetchOrderBook() loi', e.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: API KEY & AUTHENTICATED ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────
  beginSection(3, 'Kiem tra API Key & Quyen truy cap');
  let accountBalance = 0;

  // 3a: Account info
  try {
    const acct = await fetchAccountInfo(API_KEY, SECRET_KEY);
    if (acct !== null && acct !== undefined) {
      pass('fetchAccountInfo() thanh cong — API Key hop le');
      const assets = Array.isArray(acct) ? acct : [acct];
      info(`So tai san: ${assets.length}`);
      const usdt = assets.find((a: any) => (a.currency || a.asset) === 'USDT');
      if (usdt) {
        accountBalance = Number(usdt.availableBalance ?? usdt.balance ?? usdt.equity ?? 0);
        info(`USDT available: ${accountBalance.toFixed(4)}`);
        pass('Co du lieu so du tai khoan');
      } else {
        warn('Khong tim thay USDT trong danh sach tai san', `${assets.map((a: any) => a.currency || a.asset).join(', ')}`);
      }
    } else {
      fail('fetchAccountInfo() tra ve null — API Key SAI hoac chua cap quyen READ');
    }
  } catch (e: any) {
    fail('fetchAccountInfo() loi mang', e.message);
  }

  // 3b: Open positions
  try {
    const positions = await fetchOpenPositions(API_KEY, SECRET_KEY);
    pass('fetchOpenPositions() thanh cong', `${Array.isArray(positions) ? positions.length : 0} vi the dang mo`);
  } catch (e: any) {
    fail('fetchOpenPositions() loi', e.message);
  }

  // 3c: Trade permission (dat lenh gia ao 1 USD)
  try {
    const orderResult = await placeOrder(API_KEY, SECRET_KEY, {
      symbol: TEST_SYMBOL,
      price: 10000,
      vol: 1,
      leverage: 20,
      side: 1,
      type: 1,
      openType: 1,
    });

    const msg = String(orderResult.message || '').toLowerCase();
    const code = String(orderResult.code || '');
    const isInsufficientBalance = msg.includes('insufficient') || msg.includes('balance')
      || code === '30005' || code === '20001';
    const isSignatureOk = !msg.includes('signature') && !msg.includes('api key')
      && code !== '401' && code !== '403' && code !== '10002';

    if (orderResult.success) {
      pass('Dat lenh thanh cong (tai khoan co tien!)', `orderId: ${orderResult.data}`);
    } else if (isInsufficientBalance && isSignatureOk) {
      pass('Quyen dat lenh OK', 'San tu choi do tai khoan trong — dung nhu mong doi');
    } else if (!isSignatureOk) {
      fail('LOI CHU KY / API KEY SAI hoac chua cap quyen TRADE', JSON.stringify(orderResult));
    } else {
      warn('Phan hoi dat lenh khong ro rang', JSON.stringify(orderResult));
    }
  } catch (e: any) {
    fail('placeOrder() loi mang', e.message);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: CIRCUIT BREAKER
  // ─────────────────────────────────────────────────────────────────────────
  beginSection(4, 'Circuit Breaker Logic');

  const cb = new CircuitBreaker('test', { failureThreshold: 3, cooldownMs: 500 });

  // 4a: Initial state
  if (cb.getState() === 'CLOSED') {
    pass('Initial state = CLOSED');
  } else {
    fail('Initial state khong phai CLOSED');
  }

  // 4b: Opens after threshold
  cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
  if (cb.getState() === 'OPEN') {
    pass('Chuyen sang OPEN sau 3 failures');
  } else {
    fail('Khong chuyen sang OPEN sau threshold');
  }

  // 4c: Fallback khi OPEN
  const result = await cb.execute<string>(
    async () => 'real_value',
    'fallback_value'
  );
  if (result === 'fallback_value') {
    pass('Tra fallback khi circuit OPEN');
  } else {
    fail('Khong tra fallback khi OPEN');
  }

  // 4d: HALF_OPEN after cooldown
  await new Promise(r => setTimeout(r, 600));
  if (cb.getState() === 'HALF_OPEN') {
    pass('Chuyen OPEN -> HALF_OPEN sau cooldown');
  } else {
    fail('Khong chuyen sang HALF_OPEN sau cooldown', `state = ${cb.getState()}`);
  }

  // 4e: Recovery
  const resultHalf = await cb.execute<string>(
    async () => 'real_value',
    'fallback_value'
  );
  if (resultHalf === 'real_value' && cb.getState() === 'CLOSED') {
    pass('Phuc hoi thanh cong: HALF_OPEN -> CLOSED');
  } else {
    fail('Phuc hoi that bai', `state=${cb.getState()}, result=${resultHalf}`);
  }

  // 4f: reset() manual
  cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
  cb.reset();
  if (cb.getState() === 'CLOSED' && cb.getFailureCount() === 0) {
    pass('reset() hoat dong dung');
  } else {
    fail('reset() khong hoat dong');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 5: CAPITAL MANAGER
  // ─────────────────────────────────────────────────────────────────────────
  beginSection(5, 'Capital Manager & Quan ly rui ro');

  // 5a: Basic position sizing
  const balance = 1000;
  const entry = 50000;
  const sl = 49000;
  const leverage = 20;
  const risk = 1; // 1%
  const posSize = calcPositionSize(balance, risk, entry, sl, leverage);
  if (posSize >= 0) {
    pass('calcPositionSize() chay khong loi', `vol = ${posSize} contracts`);
  } else {
    fail('calcPositionSize() tra ve gia tri am');
  }

  // 5b: Zero position when no balance
  const zeroPosNoBalance = calcPositionSize(0, risk, entry, sl, leverage);
  if (zeroPosNoBalance === 0) {
    pass('posSize = 0 khi balance = 0');
  } else {
    fail('posSize khac 0 khi balance = 0');
  }

  // 5c: Zero position when SL == entry
  const zeroPosNoSL = calcPositionSize(balance, risk, entry, entry, leverage);
  if (zeroPosNoSL === 0) {
    pass('posSize = 0 khi SL = entry price');
  } else {
    fail('posSize khac 0 khi stop loss = entry');
  }

  // 5d: Max position limited by margin
  const hugeRisk = 200;
  const limitedPos = calcPositionSize(balance, hugeRisk, entry, sl, leverage);
  const maxByMargin = Math.floor(balance * 0.95 / (entry / leverage));
  if (limitedPos <= maxByMargin) {
    pass('Position size bi gioi han boi available margin');
  } else {
    fail('Vi pham gioi han margin', `${limitedPos} > ${maxByMargin}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: NEWS SERVICE & SENTIMENT
  // ─────────────────────────────────────────────────────────────────────────
  beginSection(6, 'News Service & Safety Check');

  // 6a: isSafeToTrade logic
  const cfg = { newsFilter: true, quietHours: null };

  const { safe: safeBullish } = isSafeToTrade('BULLISH', [], cfg);
  if (safeBullish) pass('Cho phep giao dich khi sentiment BULLISH');
  else fail('Sai logic: BULLISH ma khong cho giao dich');

  const { safe: safeNeutral } = isSafeToTrade('NEUTRAL', [], cfg);
  if (safeNeutral) pass('Cho phep giao dich khi sentiment NEUTRAL');
  else fail('Sai logic: NEUTRAL ma khong cho giao dich');

  const { safe: blockFearful } = isSafeToTrade('FEARFUL', [], cfg);
  if (!blockFearful) pass('Chan giao dich khi sentiment FEARFUL');
  else fail('Sai logic: FEARFUL ma van cho giao dich');

  // 6b: Quiet hours block
  const nowHour = new Date().getUTCHours();
  const qhStart = (nowHour + 0) % 24;
  const qhEnd   = (nowHour + 1) % 24;
  const { safe: blockedByQH } = isSafeToTrade('BULLISH', [], {
    newsFilter: true,
    quietHours: { start: qhStart, end: qhEnd },
  });
  if (!blockedByQH) pass('Chan giao dich trong quiet hours');
  else fail('Sai logic: Khong chan khi trong quiet hours');

  // 6c: analyzeNewsSentiment
  const fakeNews = [
    { id: 1, title: 'Crash dump collapse bear', url: '', source: '', publishedAt: new Date().toISOString(), sentiment: 'negative' as const, votes: { positive: 0, negative: 5, important: 1 } },
    { id: 2, title: 'Crash bear fell drop',     url: '', source: '', publishedAt: new Date().toISOString(), sentiment: 'negative' as const, votes: { positive: 0, negative: 3, important: 0 } },
    { id: 3, title: 'Bull surge rally ETF',     url: '', source: '', publishedAt: new Date().toISOString(), sentiment: 'positive' as const, votes: { positive: 5, negative: 0, important: 0 } },
  ];
  const sentiment = analyzeNewsSentiment(fakeNews);
  if (sentiment === 'BEARISH' || sentiment === 'FEARFUL') {
    pass('analyzeNewsSentiment() phat hien tin xau', `=> ${sentiment}`);
  } else {
    fail('analyzeNewsSentiment() khong phat hien tin xau', `=> ${sentiment}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 7: DATABASE (SQLite)
  // ─────────────────────────────────────────────────────────────────────────
  beginSection(7, 'SQLite Database Adapter');

  const testDbPath = join(process.cwd(), 'logs', '_test_production_check.db');
  const db = new DatabaseAdapter(testDbPath);

  try {
    await db.init();
    pass('DatabaseAdapter.init() thanh cong');

    // Insert a test log
    const testLog = {
      id: 'TEST_' + Date.now(),
      timestamp: Date.now(),
      symbol: 'BTC_USDT',
      mode: 'simulation',
      side: 'LONG',
      entry: 50000,
      tp: 51000,
      sl: 49000,
      quantity: 1,
      leverage: 20,
      confidence: 75,
      winRate: 60,
      aiProvider: 'test',
      status: 'OPENED',
    };
    db.upsertTradeLog(testLog);
    pass('insertAutoTradeLog() thanh cong');

    // Query it back
    const logs = db.getAllTradeLogs(10);
    if (logs.some(l => l.id === testLog.id)) {
      pass('getAutoTradeLogs() tra ve du lieu vua ghi');
    } else {
      fail('Khong doc lai duoc log vua insert');
    }

    // system_state
    db.setState('test_key', 'test_value');
    const val = db.getState('test_key');
    if (val === 'test_value') {
      pass('setState/getState() hoat dong dung');
    } else {
      fail('setState/getState() bi loi', `expected test_value, got ${val}`);
    }

    // Flush to disk
    db.flushToDisk();
    if (existsSync(testDbPath)) {
      pass('flushToDisk() ghi file thanh cong', testDbPath);
    } else {
      fail('flushToDisk() khong tao duoc file');
    }

    // Close and verify reload
    db.close();
    const db2 = new DatabaseAdapter(testDbPath);
    await db2.init();
    const reloadedLogs = db2.getAllTradeLogs(10);
    if (reloadedLogs.some(l => l.id === testLog.id)) {
      pass('Reload database tu file thanh cong (du lieu con sau restart)');
    } else {
      fail('Du lieu mat sau khi dong va mo lai DB');
    }
    db2.close();

  } catch (e: any) {
    fail('DatabaseAdapter gap loi', e.message);
  } finally {
    // cleanup
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 8: ENV & DEPENDENCIES
  // ─────────────────────────────────────────────────────────────────────────
  beginSection(8, 'Bien moi truong & Dependencies');

  // 8a: API keys
  if (API_KEY && API_KEY.length > 5) {
    pass('MEXC_API_KEY duoc cau hinh');
  } else {
    fail('MEXC_API_KEY bi trong hoac qua ngan');
  }

  if (SECRET_KEY && SECRET_KEY.length > 5) {
    pass('MEXC_SECRET_KEY duoc cau hinh');
  } else {
    fail('MEXC_SECRET_KEY bi trong hoac qua ngan');
  }

  // 8b: AI keys (optional)
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;
  const orKey     = process.env.OPENROUTER_API_KEY;

  if (geminiKey) pass('GEMINI_API_KEY co san'); else warn('GEMINI_API_KEY chua set (AI fallback bi han che)');
  if (groqKey)   pass('GROQ_API_KEY co san');   else warn('GROQ_API_KEY chua set');
  if (orKey)     pass('OPENROUTER_API_KEY co san'); else warn('OPENROUTER_API_KEY chua set');

  const aiCount = [geminiKey, groqKey, orKey, process.env.TOGETHER_API_KEY].filter(Boolean).length;
  if (aiCount >= 1) {
    pass(`Co ${aiCount}/4 AI provider key — du de chay AI debate`);
  } else {
    warn('Chua co AI key nao — bot chi chay duoc Technical Analysis');
  }

  // 8c: TimesFM (optional)
  const timesfmUrl = process.env.TIMESFM_API_BASE_URL || process.env.VITE_TIMESFM_API_BASE_URL;
  if (timesfmUrl) {
    info(`TIMESFM_API_BASE_URL = ${timesfmUrl}`);
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(timesfmUrl + '/api/health', { signal: ctrl.signal });
      clearTimeout(tid);
      if (r.ok) {
        pass('TimesFM backend dang chay');
      } else {
        warn('TimesFM backend phan hoi loi', `HTTP ${r.status} — Circuit Breaker se xu ly`);
      }
    } catch {
      warn('TimesFM backend khong chay', 'OK — Circuit Breaker se fallback ve Technical Analysis');
    }
  } else {
    warn('TIMESFM_API_BASE_URL chua set', 'Bot se fallback ve AI Debate + Technical Analysis');
  }

  // 8d: BOT_MODE
  const botMode = process.env.BOT_MODE || 'simulation';
  if (botMode === 'simulation') {
    pass('BOT_MODE = simulation (an toan de test)');
  } else if (botMode === 'live') {
    warn('BOT_MODE = live', 'Bot se dat LENH THAT khi chay!');
  } else {
    warn('BOT_MODE chua set', 'Se dung simulation mac dinh');
  }

  // finalize last section
  finalizeSection();

  // ===========================================================================
  // SUMMARY REPORT
  // ===========================================================================
  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
  const totalPass = results.reduce((s, r) => s + r.passed, 0);
  const totalFail = results.reduce((s, r) => s + r.failed, 0);
  const totalWarn = results.reduce((s, r) => s + r.warnings, 0);
  const allCriticalPass = totalFail === 0;

  console.log(`\n${C.bold}${C.cyan}`);
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║                 SUMMARY REPORT                      ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log(C.reset);

  console.log(`  ${'Section'.padEnd(42)} ${'PASS'.padStart(4)} ${'FAIL'.padStart(4)} ${'WARN'.padStart(4)}`);
  console.log(`  ${'-'.repeat(57)}`);
  for (const r of results) {
    const p = r.passed > 0 ? `${C.green}${r.passed.toString().padStart(4)}${C.reset}` : '   0';
    const f = r.failed > 0 ? `${C.red}${r.failed.toString().padStart(4)}${C.reset}` : '   0';
    const w = r.warnings > 0 ? `${C.yellow}${r.warnings.toString().padStart(4)}${C.reset}` : '   0';
    console.log(`  ${r.section.slice(0, 42).padEnd(42)} ${p} ${f} ${w}`);
  }
  console.log(`  ${'-'.repeat(57)}`);
  console.log(`  ${'TOTAL'.padEnd(42)} ${C.green}${totalPass.toString().padStart(4)}${C.reset} ${C.red}${totalFail.toString().padStart(4)}${C.reset} ${C.yellow}${totalWarn.toString().padStart(4)}${C.reset}`);
  console.log(`\n  Thoi gian: ${elapsed}s`);

  console.log();
  if (allCriticalPass) {
    console.log(`  ${C.bgGreen}${C.bold}  ✅  TAT CA KIEM TRA QUAN TRONG DA PASS                 ${C.reset}`);
    console.log(`  ${C.bgGreen}${C.bold}  🚀  HE THONG SAN SANG CHAY VOI TIEN THAT (LIVE MODE)  ${C.reset}`);
    if (totalWarn > 0) {
      console.log(`\n  ${C.yellow}⚠  Con ${totalWarn} canh bao — xem lai truoc khi deploy production${C.reset}`);
    }
  } else {
    console.log(`  ${C.bgRed}${C.bold}  ❌  CO ${totalFail} LOI QUAN TRONG                              ${C.reset}`);
    console.log(`  ${C.bgRed}${C.bold}  🛑  CHUA SAN SANG CHAY TIEN THAT — FIX TRUOC!          ${C.reset}`);
  }
  console.log();

  timeSyncManager.stopAutoSync();
  // Delay exit to let UV handles close cleanly on Windows
  setTimeout(() => process.exit(allCriticalPass ? 0 : 1), 100);
}

main().catch(e => {
  console.error(`\n${C.red}FATAL ERROR:${C.reset}`, e);
  process.exit(1);
});