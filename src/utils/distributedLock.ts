/**
 * Distributed Lock Mechanism for multi-instance safety.
 * 
 * Uses SQLite-based locking for headless bot instances.
 * For Electron desktop mode, uses file-based locking.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lock file path
const LOCK_FILE_PATH = join(__dirname, '../../.mexc-pro.lock');

export interface DistributedLockOptions {
  /** Lock timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Check interval in milliseconds (default: 100) */
  checkInterval?: number;
}

export class DistributedLock {
  private lockFilePath: string;
  private lockAcquired = false;
  private lockTimeout: number;
  private checkInterval: number;

  constructor(options: DistributedLockOptions = {}) {
    this.lockFilePath = LOCK_FILE_PATH;
    this.lockTimeout = options.timeout ?? 30000;
    this.checkInterval = options.checkInterval ?? 100;
  }

  /**
   * Try to acquire the lock.
   * Returns true if lock was acquired, false otherwise.
   */
  async acquire(): Promise<boolean> {
    if (this.lockAcquired) {
      return true;
    }

    try {
      // Check if lock file exists and is stale
      if (existsSync(this.lockFilePath)) {
        const lockData = this.readLockFile();
        if (lockData) {
          const elapsed = Date.now() - lockData.timestamp;
          if (elapsed < this.lockTimeout) {
            // Lock is still valid
            return false;
          }
          // Lock is stale, try to acquire it
        }
      }

      // Create lock file with current process info
      this.writeLockFile();
      this.lockAcquired = true;

      // Set up periodic renewal
      this.startLockRenewal();

      return true;
    } catch (err) {
      console.error('[DistributedLock] Failed to acquire lock:', err);
      return false;
    }
  }

  /**
   * Release the lock.
   */
  release(): void {
    if (!this.lockAcquired) {
      return;
    }

    try {
      this.stopLockRenewal();
      if (existsSync(this.lockFilePath)) {
        unlinkSync(this.lockFilePath);
      }
      this.lockAcquired = false;
      this.lockPid = null;
      this.lockTimestamp = null;
    } catch (err) {
      console.error('[DistributedLock] Failed to release lock:', err);
    }
  }

  /**
   * Check if the lock is currently held.
   */
  isLocked(): boolean {
    if (!existsSync(this.lockFilePath)) {
      return false;
    }

    const lockData = this.readLockFile();
    if (!lockData) {
      return false;
    }

    const elapsed = Date.now() - lockData.timestamp;
    return elapsed < this.lockTimeout;
  }

  /**
   * Get the PID of the process holding the lock.
   */
  getLockHolderPid(): number | null {
    if (!existsSync(this.lockFilePath)) {
      return null;
    }

    const lockData = this.readLockFile();
    return lockData?.pid ?? null;
  }

  /**
   * Get the timestamp when the lock was acquired.
   */
  getLockTimestamp(): number | null {
    if (!existsSync(this.lockFilePath)) {
      return null;
    }

    const lockData = this.readLockFile();
    return lockData?.timestamp ?? null;
  }

  /**
   * Execute a function with the lock held.
   */
  async execute<T>(fn: () => Promise<T> | T): Promise<T | null> {
    if (!await this.acquire()) {
      console.warn('[DistributedLock] Could not acquire lock, skipping execution');
      return null;
    }

    try {
      const result = await fn();
      return result;
    } finally {
      this.release();
    }
  }

  /**
   * Wait for the lock to become available.
   */
  async waitForLock(timeout?: number): Promise<boolean> {
    const startTime = Date.now();
    const lockTimeout = timeout ?? this.lockTimeout;

    while (Date.now() - startTime < lockTimeout) {
      if (await this.acquire()) {
        return true;
      }
      await this.sleep(this.checkInterval);
    }

    return false;
  }

  private readLockFile(): { pid: number; timestamp: number } | null {
    try {
      const content = readFileSync(this.lockFilePath, 'utf8');
      const data = JSON.parse(content);
      return {
        pid: Number(data.pid),
        timestamp: Number(data.timestamp),
      };
    } catch {
      return null;
    }
  }

  private writeLockFile(): void {
    try {
      // Ensure directory exists
      const dir = dirname(this.lockFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = {
        pid: process.pid,
        timestamp: Date.now(),
      };
      writeFileSync(this.lockFilePath, JSON.stringify(data), 'utf8');
    } catch (err) {
      console.error('[DistributedLock] Failed to write lock file:', err);
      throw err;
    }
  }

  private renewalTimer: NodeJS.Timeout | null = null;

  private startLockRenewal(): void {
    this.stopLockRenewal();
    this.renewalTimer = setInterval(() => {
      if (this.lockAcquired) {
        this.writeLockFile();
      }
    }, this.lockTimeout / 2);
  }

  private stopLockRenewal(): void {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for the application
export const distributedLock = new DistributedLock({
  timeout: 30000,
  checkInterval: 100,
});
