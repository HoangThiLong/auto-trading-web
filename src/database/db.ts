/**
 * DatabaseAdapter — SQLite persistence layer for Headless Bot.
 *
 * Uses `sql.js` (pure WASM-based SQLite) so it works on any machine
 * without native build tools (no C++ compiler, no node-gyp).
 *
 * This module is ONLY imported in `bot.ts` (Node.js headless mode).
 * It is NOT imported in the React frontend — the browser uses Zustand + localStorage.
 *
 * Tables:
 *   auto_trade_logs  — full trade log history
 *   order_history    — placed order records
 *   system_state     — key-value store for bot runtime state
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ─── Types matching src/types/index.ts ──────────────────────────────────────

export interface DbAutoTradeLog {
  id: string;
  intentId?: string;
  timestamp: number;
  symbol: string;
  mode: string;
  side: string;
  entry: number;
  tp: number;
  sl: number;
  quantity: number;
  leverage: number;
  confidence: number;
  winRate: number;
  aiProvider: string;
  aiAnalysis?: string;
  status: string;
  skipReason?: string;
  pnl?: number;
  orderId?: string;
}

export interface DbOrderRecord {
  id: string;
  intentId?: string;
  symbol: string;
  side: string;
  type: string;
  price: number;
  quantity: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  status: string;
  createdAt: number;
  isSimulation: boolean;
  aiAnalysis?: string;
}

// ─── DatabaseAdapter ────────────────────────────────────────────────────────

export class DatabaseAdapter {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private isDirty = false;

  /** Debounce interval for flushing WAL to disk (ms). */
  private static readonly SAVE_DEBOUNCE_MS = 2_000;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Initialize the database. Must be called before any other method.
   * Loads existing DB file or creates a new one with schema.
   */
  async init(): Promise<void> {
    const SQL = await initSqlJs();

    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Load existing database or create new
    if (existsSync(this.dbPath)) {
      const fileBuffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
      console.log(`[DB] Loaded existing database from ${this.dbPath}`);
    } else {
      this.db = new SQL.Database();
      console.log(`[DB] Created new database at ${this.dbPath}`);
    }

    this.createTables();
  }

  private ensureDb(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('[DB] Database not initialized. Call init() first.');
    }
    return this.db;
  }

  private createTables(): void {
    const db = this.ensureDb();

    db.run(`
      CREATE TABLE IF NOT EXISTS auto_trade_logs (
        id TEXT PRIMARY KEY,
        intentId TEXT,
        timestamp INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        mode TEXT NOT NULL,
        side TEXT NOT NULL,
        entry REAL NOT NULL,
        tp REAL NOT NULL,
        sl REAL NOT NULL,
        quantity REAL NOT NULL,
        leverage INTEGER NOT NULL,
        confidence INTEGER NOT NULL,
        winRate INTEGER NOT NULL,
        aiProvider TEXT NOT NULL DEFAULT 'local',
        aiAnalysis TEXT,
        status TEXT NOT NULL DEFAULT 'OPENED',
        skipReason TEXT,
        pnl REAL,
        orderId TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS order_history (
        id TEXT PRIMARY KEY,
        intentId TEXT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        type TEXT NOT NULL,
        price REAL NOT NULL,
        quantity REAL NOT NULL,
        leverage INTEGER NOT NULL,
        stopLoss REAL,
        takeProfit REAL,
        status TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        isSimulation INTEGER NOT NULL DEFAULT 0,
        aiAnalysis TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS system_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    // Create indexes for frequent queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_atl_status ON auto_trade_logs(status);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_atl_timestamp ON auto_trade_logs(timestamp);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_atl_symbol ON auto_trade_logs(symbol);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_oh_createdAt ON order_history(createdAt);`);

    this.scheduleSave();
  }

  // ─── Disk persistence (sql.js is in-memory, we flush to file) ──────────

  /** Mark data as changed and schedule a debounced save. */
  private scheduleSave(): void {
    this.isDirty = true;
    if (this.saveTimer) return; // already scheduled

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flushToDisk();
    }, DatabaseAdapter.SAVE_DEBOUNCE_MS);
  }

  /** Write the in-memory database to disk immediately. */
  flushToDisk(): void {
    if (!this.db || !this.isDirty) return;

    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.dbPath, buffer);
      this.isDirty = false;
    } catch (err) {
      console.error('[DB] Failed to flush to disk:', err);
    }
  }

  // ─── Auto Trade Logs ────────────────────────────────────────────────────

  upsertTradeLog(log: DbAutoTradeLog): void {
    const db = this.ensureDb();

    db.run(
      `INSERT OR REPLACE INTO auto_trade_logs
       (id, intentId, timestamp, symbol, mode, side, entry, tp, sl,
        quantity, leverage, confidence, winRate, aiProvider, aiAnalysis,
        status, skipReason, pnl, orderId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.intentId ?? null,
        log.timestamp,
        log.symbol,
        log.mode,
        log.side,
        log.entry,
        log.tp,
        log.sl,
        log.quantity,
        log.leverage,
        log.confidence,
        log.winRate,
        log.aiProvider,
        log.aiAnalysis ?? null,
        log.status,
        log.skipReason ?? null,
        log.pnl ?? null,
        log.orderId ?? null,
      ],
    );

    this.scheduleSave();
  }

  getTradeLogsByStatus(status: string): DbAutoTradeLog[] {
    const db = this.ensureDb();
    const stmt = db.prepare('SELECT * FROM auto_trade_logs WHERE status = ? ORDER BY timestamp DESC');
    stmt.bind([status]);

    const results: DbAutoTradeLog[] = [];
    while (stmt.step()) {
      results.push(this.rowToTradeLog(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  getAllTradeLogs(limit = 500): DbAutoTradeLog[] {
    const db = this.ensureDb();
    const stmt = db.prepare('SELECT * FROM auto_trade_logs ORDER BY timestamp DESC LIMIT ?');
    stmt.bind([limit]);

    const results: DbAutoTradeLog[] = [];
    while (stmt.step()) {
      results.push(this.rowToTradeLog(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  updateTradeLogStatus(id: string, status: string, pnl?: number): void {
    const db = this.ensureDb();

    if (pnl !== undefined) {
      db.run(
        'UPDATE auto_trade_logs SET status = ?, pnl = ? WHERE id = ?',
        [status, pnl, id],
      );
    } else {
      db.run(
        'UPDATE auto_trade_logs SET status = ? WHERE id = ?',
        [status, id],
      );
    }

    this.scheduleSave();
  }

  /**
   * Get logs for daily PnL calculation.
   * Returns all logs with a pnl value since the given timestamp.
   */
  getLogsForPnlCalculation(sinceTimestamp: number): { pnl: number; timestamp: number }[] {
    const db = this.ensureDb();
    const stmt = db.prepare(
      'SELECT pnl, timestamp FROM auto_trade_logs WHERE timestamp >= ? AND pnl IS NOT NULL',
    );
    stmt.bind([sinceTimestamp]);

    const results: { pnl: number; timestamp: number }[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { pnl: number; timestamp: number };
      results.push({ pnl: row.pnl, timestamp: row.timestamp });
    }
    stmt.free();
    return results;
  }

  // ─── Order History ──────────────────────────────────────────────────────

  insertOrder(order: DbOrderRecord): void {
    const db = this.ensureDb();

    db.run(
      `INSERT OR REPLACE INTO order_history
       (id, intentId, symbol, side, type, price, quantity, leverage,
        stopLoss, takeProfit, status, createdAt, isSimulation, aiAnalysis)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.intentId ?? null,
        order.symbol,
        order.side,
        order.type,
        order.price,
        order.quantity,
        order.leverage,
        order.stopLoss ?? null,
        order.takeProfit ?? null,
        order.status,
        order.createdAt,
        order.isSimulation ? 1 : 0,
        order.aiAnalysis ?? null,
      ],
    );

    this.scheduleSave();
  }

  getOrderHistory(limit = 100): DbOrderRecord[] {
    const db = this.ensureDb();
    const stmt = db.prepare('SELECT * FROM order_history ORDER BY createdAt DESC LIMIT ?');
    stmt.bind([limit]);

    const results: DbOrderRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, any>;
      results.push({
        id: String(row.id),
        intentId: row.intentId ? String(row.intentId) : undefined,
        symbol: String(row.symbol),
        side: String(row.side),
        type: String(row.type),
        price: Number(row.price),
        quantity: Number(row.quantity),
        leverage: Number(row.leverage),
        stopLoss: row.stopLoss != null ? Number(row.stopLoss) : undefined,
        takeProfit: row.takeProfit != null ? Number(row.takeProfit) : undefined,
        status: String(row.status),
        createdAt: Number(row.createdAt),
        isSimulation: Boolean(row.isSimulation),
        aiAnalysis: row.aiAnalysis ? String(row.aiAnalysis) : undefined,
      });
    }
    stmt.free();
    return results;
  }

  // ─── System State (Key-Value Store) ─────────────────────────────────────

  setState(key: string, value: string): void {
    const db = this.ensureDb();
    db.run(
      'INSERT OR REPLACE INTO system_state (key, value, updatedAt) VALUES (?, ?, ?)',
      [key, value, Date.now()],
    );
    this.scheduleSave();
  }

  getState(key: string): string | null {
    const db = this.ensureDb();
    const stmt = db.prepare('SELECT value FROM system_state WHERE key = ?');
    stmt.bind([key]);

    let result: string | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value: string };
      result = row.value;
    }
    stmt.free();
    return result;
  }

  deleteState(key: string): void {
    const db = this.ensureDb();
    db.run('DELETE FROM system_state WHERE key = ?', [key]);
    this.scheduleSave();
  }

  // ─── Statistics ─────────────────────────────────────────────────────────

  getTradeStats(): {
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    totalPnl: number;
    winCount: number;
    lossCount: number;
  } {
    const db = this.ensureDb();

    const totalRow = db.exec('SELECT COUNT(*) as cnt FROM auto_trade_logs')[0];
    const totalTrades = totalRow ? Number(totalRow.values[0][0]) : 0;

    const openRow = db.exec("SELECT COUNT(*) as cnt FROM auto_trade_logs WHERE status = 'OPENED'")[0];
    const openTrades = openRow ? Number(openRow.values[0][0]) : 0;

    const closedRow = db.exec(
      "SELECT COUNT(*) as cnt FROM auto_trade_logs WHERE status IN ('TP_HIT', 'SL_HIT', 'CLOSED')",
    )[0];
    const closedTrades = closedRow ? Number(closedRow.values[0][0]) : 0;

    const pnlRow = db.exec(
      "SELECT COALESCE(SUM(pnl), 0) as total FROM auto_trade_logs WHERE pnl IS NOT NULL",
    )[0];
    const totalPnl = pnlRow ? Number(pnlRow.values[0][0]) : 0;

    const winRow = db.exec(
      "SELECT COUNT(*) as cnt FROM auto_trade_logs WHERE pnl > 0",
    )[0];
    const winCount = winRow ? Number(winRow.values[0][0]) : 0;

    const lossRow = db.exec(
      "SELECT COUNT(*) as cnt FROM auto_trade_logs WHERE pnl IS NOT NULL AND pnl <= 0",
    )[0];
    const lossCount = lossRow ? Number(lossRow.values[0][0]) : 0;

    return { totalTrades, openTrades, closedTrades, totalPnl, winCount, lossCount };
  }

  // ─── Cleanup & Close ────────────────────────────────────────────────────

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    // Final flush before closing
    this.flushToDisk();

    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[DB] Database closed gracefully.');
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private rowToTradeLog(row: Record<string, any>): DbAutoTradeLog {
    return {
      id: String(row.id),
      intentId: row.intentId ? String(row.intentId) : undefined,
      timestamp: Number(row.timestamp),
      symbol: String(row.symbol),
      mode: String(row.mode),
      side: String(row.side),
      entry: Number(row.entry),
      tp: Number(row.tp),
      sl: Number(row.sl),
      quantity: Number(row.quantity),
      leverage: Number(row.leverage),
      confidence: Number(row.confidence),
      winRate: Number(row.winRate),
      aiProvider: String(row.aiProvider),
      aiAnalysis: row.aiAnalysis ? String(row.aiAnalysis) : undefined,
      status: String(row.status),
      skipReason: row.skipReason ? String(row.skipReason) : undefined,
      pnl: row.pnl != null ? Number(row.pnl) : undefined,
      orderId: row.orderId ? String(row.orderId) : undefined,
    };
  }
}
