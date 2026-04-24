import TelegramBot from 'node-telegram-bot-api';

export interface TelegramBotLogger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

export interface TelegramCommandResult {
  success: boolean;
  message: string;
}

export interface TelegramBotHandlers {
  status: () => Promise<string> | string;
  startbot: () => Promise<TelegramCommandResult> | TelegramCommandResult;
  stopbot: () => Promise<TelegramCommandResult> | TelegramCommandResult;
}

export interface TelegramBotServiceOptions {
  token?: string;
  adminChatId?: string;
  logger?: TelegramBotLogger;
}

const noopLogger: TelegramBotLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const normalizeCommand = (input: string): string => {
  const firstToken = input.trim().split(/\s+/)[0] || '';
  const withoutSlash = firstToken.startsWith('/') ? firstToken.slice(1) : firstToken;
  const [cmd] = withoutSlash.split('@');
  return cmd.toLowerCase();
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toSafeHtmlMessage = (message: string): string => escapeHtml(message).replace(/\n/g, '<br/>');

export class TelegramBotService {
  private readonly token?: string;
  private readonly adminChatId?: string;
  private readonly logger: TelegramBotLogger;

  private handlers: TelegramBotHandlers | null = null;
  private bot: TelegramBot | null = null;
  private started = false;

  constructor(options: TelegramBotServiceOptions) {
    this.token = options.token;
    this.adminChatId = options.adminChatId;
    this.logger = options.logger ?? noopLogger;
  }

  public isEnabled(): boolean {
    return Boolean(this.token && this.adminChatId);
  }

  public registerHandlers(handlers: TelegramBotHandlers): void {
    this.handlers = handlers;
  }

  public start(): boolean {
    if (!this.isEnabled()) {
      this.logger.warn('[Telegram] Disabled — missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
      return false;
    }

    if (this.started) {
      return true;
    }

    this.bot = new TelegramBot(this.token!, { polling: true });

    this.bot.on('polling_error', (err) => {
      const pollingError = err as Error & { code?: string };
      this.logger.error('[Telegram] Polling error', {
        code: pollingError.code,
        message: pollingError.message,
      });
    });

    this.bot.on('message', async (msg) => {
      try {
        await this.handleMessage(msg);
      } catch (error) {
        this.logger.error('[Telegram] Failed to handle incoming message', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.started = true;
    this.logger.info('[Telegram] Bot polling started', {
      adminChatId: this.adminChatId,
    });
    return true;
  }

  public async sendAlert(message: string): Promise<void> {
    if (!this.started || !this.bot || !this.adminChatId) return;

    try {
      await this.bot.sendMessage(this.adminChatId, toSafeHtmlMessage(message), {
        disable_web_page_preview: true,
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error('[Telegram] Failed to send alert', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async destroy(): Promise<void> {
    if (!this.bot) return;

    try {
      await this.bot.stopPolling();
      this.logger.info('[Telegram] Bot polling stopped');
    } catch (error) {
      this.logger.error('[Telegram] stopPolling failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.bot.removeAllListeners();
      this.bot = null;
      this.started = false;
    }
  }

  private async handleMessage(msg: TelegramBot.Message): Promise<void> {
    if (!this.bot || !this.adminChatId) return;

    const incomingChatId = String(msg.chat?.id ?? '');

    // Security guard: ignore all non-admin chat IDs
    if (incomingChatId !== this.adminChatId) {
      this.logger.warn('[Telegram] Blocked unauthorized chat message', {
        incomingChatId,
      });
      return;
    }

    const text = msg.text?.trim();
    if (!text) return;

    const command = normalizeCommand(text);
    if (!command) return;

    if (!this.handlers) {
      await this.bot.sendMessage(this.adminChatId, '⚠️ Command handlers chưa sẵn sàng.');
      return;
    }

    if (command === 'status') {
      const statusMessage = await this.handlers.status();
      await this.bot.sendMessage(this.adminChatId, toSafeHtmlMessage(statusMessage), {
        disable_web_page_preview: true,
        parse_mode: 'HTML',
      });
      return;
    }

    if (command === 'startbot') {
      const result = await this.handlers.startbot();
      await this.bot.sendMessage(this.adminChatId, result.message);
      return;
    }

    if (command === 'stopbot') {
      const result = await this.handlers.stopbot();
      await this.bot.sendMessage(this.adminChatId, result.message);
      return;
    }

    await this.bot.sendMessage(
      this.adminChatId,
      '❓ Lệnh không hợp lệ. Dùng: /status, /startbot, /stopbot',
    );
  }
}
