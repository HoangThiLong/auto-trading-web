import { contextBridge, ipcRenderer } from 'electron';

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

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  saveCredentials: (payload: SecureCredentialPayload) => ipcRenderer.invoke('save-credentials', payload),
  loadCredentials: () => ipcRenderer.invoke('load-credentials'),
  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),
});
