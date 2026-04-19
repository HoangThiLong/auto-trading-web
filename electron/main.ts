import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type SecureCredentialPayload = {
  credentials: { apiKey: string; secretKey: string } | null;
  aiCredentials:
    | {
        gemini?: string;
        groq?: string;
        openrouter?: string;
        together?: string;
        cryptopanic?: string;
        preferredProvider?: 'gemini' | 'groq' | 'openrouter' | 'together';
      }
    | null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIAL_FILE_PATH = path.join(app.getPath('userData'), 'credentials.enc');

let timesfmProcess: ChildProcess | null = null;

const defaultCredentialPayload = (): SecureCredentialPayload => ({
  credentials: null,
  aiCredentials: null,
});

const saveEncryptedCredentials = (payload: SecureCredentialPayload) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this system.');
  }

  const raw = JSON.stringify(payload);
  const encrypted = safeStorage.encryptString(raw);
  fs.writeFileSync(CREDENTIAL_FILE_PATH, encrypted);
};

const loadEncryptedCredentials = (): SecureCredentialPayload => {
  if (!fs.existsSync(CREDENTIAL_FILE_PATH)) {
    return defaultCredentialPayload();
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this system.');
  }

  const encryptedBuffer = fs.readFileSync(CREDENTIAL_FILE_PATH);
  const decryptedRaw = safeStorage.decryptString(encryptedBuffer);

  try {
    const parsed = JSON.parse(decryptedRaw) as Partial<SecureCredentialPayload>;
    return {
      credentials: parsed.credentials ?? null,
      aiCredentials: parsed.aiCredentials ?? null,
    };
  } catch {
    return defaultCredentialPayload();
  }
};

const clearEncryptedCredentials = () => {
  if (fs.existsSync(CREDENTIAL_FILE_PATH)) {
    fs.unlinkSync(CREDENTIAL_FILE_PATH);
  }
};

const registerIpcHandlers = () => {
  ipcMain.handle('save-credentials', (_event, payload: SecureCredentialPayload) => {
    try {
      saveEncryptedCredentials(payload);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('load-credentials', () => {
    try {
      return loadEncryptedCredentials();
    } catch {
      return defaultCredentialPayload();
    }
  });

  ipcMain.handle('clear-credentials', () => {
    try {
      clearEncryptedCredentials();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  });
};

const resolveBackendScriptPath = (): string => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'timesfm-backend', 'main.py');
  }

  return path.join(__dirname, '../timesfm-backend/main.py');
};

const startTimesfmSidecar = () => {
  if (timesfmProcess) {
    return;
  }

  const backendScriptPath = resolveBackendScriptPath();
  const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

  try {
    const child = spawn(pythonCommand, [backendScriptPath], {
      cwd: path.dirname(backendScriptPath),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    timesfmProcess = child;

    child.stdout?.on('data', (chunk: Buffer) => {
      console.log(`[TimesFM] ${chunk.toString().trimEnd()}`);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      console.error(`[TimesFM:ERR] ${chunk.toString().trimEnd()}`);
    });

    child.on('close', (code, signal) => {
      console.log(`[TimesFM] process closed (code=${code}, signal=${signal})`);
      timesfmProcess = null;
    });

    child.on('error', (error) => {
      console.error('[TimesFM] spawn error:', error);
      timesfmProcess = null;
    });
  } catch (error) {
    console.error('[TimesFM] failed to start sidecar:', error);
    timesfmProcess = null;
  }
};

const stopTimesfmSidecar = () => {
  if (!timesfmProcess || timesfmProcess.killed) {
    return;
  }

  if (process.platform === 'win32' && timesfmProcess.pid) {
    spawn('taskkill', ['/pid', String(timesfmProcess.pid), '/f', '/t']);
  } else {
    timesfmProcess.kill('SIGTERM');
  }

  timesfmProcess = null;
};

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
};

app.whenReady().then(() => {
  registerIpcHandlers();
  startTimesfmSidecar();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('will-quit', () => {
  stopTimesfmSidecar();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
