type ViteEnv = Record<string, unknown> | undefined;

const normalize = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readFromViteEnv = (key: string): string | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyGlobal = globalThis as any;
    // Check import.meta.env first (Vite/Electron), fallback to process.env (Node.js)
    const viteEnv = anyGlobal.import?.meta?.env;
    if (viteEnv) {
      return normalize(viteEnv[key]);
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const readFromProcessEnv = (key: string): string | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyGlobal = globalThis as any;
    const procEnv = anyGlobal.process?.env;
    if (procEnv) {
      return normalize(procEnv[key]);
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export const readRuntimeEnv = (key: string): string | undefined => {
  // Priority: import.meta.env (Vite/Electron) > process.env (Node.js CLI)
  return readFromViteEnv(key) || readFromProcessEnv(key);
};
