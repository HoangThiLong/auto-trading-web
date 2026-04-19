import type { CandlePoint, TradeSignal } from '../types';
import {
  buildOrderIntent,
  generateSignal,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
  type OrderIntent,
  type OrderIntentBuildPayload,
} from './analysis';

type PendingResolveValue = TradeSignal | OrderIntent;
type ExpectedResponseType = 'GENERATE_SIGNAL_RESULT' | 'ORDER_INTENT_RESULT';

type PendingRequest = {
  expected: ExpectedResponseType;
  resolve: (value: PendingResolveValue) => void;
  reject: (error: Error) => void;
  timeoutRef: ReturnType<typeof setTimeout>;
};

type NodeWorkerLike = {
  postMessage: (message: AnalysisWorkerRequest) => void;
  on: (event: 'message' | 'error', listener: (...args: any[]) => void) => void;
  terminate: () => Promise<number> | number;
};

type RuntimeWorker = Worker | NodeWorkerLike;

const dynamicImport = (specifier: string): Promise<any> => {
  const importer = new Function('value', 'return import(value)') as (value: string) => Promise<any>;
  return importer(specifier);
};

const isNodeRuntime = () => {
  return (
    typeof window === 'undefined'
    && typeof process !== 'undefined'
    && Boolean(process.versions?.node)
  );
};

class AnalysisWorkerClient {
  private worker: RuntimeWorker | null = null;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();

  private handleWorkerMessage(message: AnalysisWorkerResponse) {
    const pendingRequest = this.pending.get(message.id);
    if (!pendingRequest) return;

    clearTimeout(pendingRequest.timeoutRef);
    this.pending.delete(message.id);

    if (message.type === 'ANALYSIS_ERROR') {
      pendingRequest.reject(new Error(message.error));
      return;
    }

    if (message.type !== pendingRequest.expected) {
      pendingRequest.reject(
        new Error(`Unexpected worker response. Expected ${pendingRequest.expected}, received ${message.type}`),
      );
      return;
    }

    if (message.type === 'GENERATE_SIGNAL_RESULT') {
      pendingRequest.resolve(message.signal);
      return;
    }

    pendingRequest.resolve(message.orderIntent);
  }

  private rejectAll(error: Error) {
    for (const [, request] of this.pending) {
      clearTimeout(request.timeoutRef);
      request.reject(error);
    }
    this.pending.clear();
  }

  private createBrowserWorker(): Worker {
    const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      this.handleWorkerMessage(event.data);
    };

    worker.onerror = (event) => {
      const error = new Error(event.message || 'Analysis worker crashed');
      this.rejectAll(error);
      this.worker = null;
    };

    return worker;
  }

  private async resolveNodeWorkerPath(): Promise<string> {
    const [pathModule, urlModule, fsModule] = await Promise.all([
      dynamicImport('node:path'),
      dynamicImport('node:url'),
      dynamicImport('node:fs'),
    ]);

    const currentFilePath = urlModule.fileURLToPath(import.meta.url);
    const currentDir = pathModule.dirname(currentFilePath);

    const candidates = [
      pathModule.resolve(currentDir, '../workers/analysis.node.worker.js'),
      pathModule.resolve(currentDir, './analysis.node.worker.js'),
      pathModule.resolve(process.cwd(), 'dist-bot/analysis.node.worker.js'),
    ];

    const detected = candidates.find((candidate: string) => fsModule.existsSync(candidate));
    if (!detected) {
      throw new Error(`Node analysis worker not found. Checked: ${candidates.join(', ')}`);
    }

    return detected;
  }

  private async createNodeWorker(): Promise<NodeWorkerLike> {
    const [{ Worker }, urlModule] = await Promise.all([
      dynamicImport('node:worker_threads'),
      dynamicImport('node:url'),
    ]);

    const workerFilePath = await this.resolveNodeWorkerPath();

    const worker = new Worker(urlModule.pathToFileURL(workerFilePath), {
      type: 'module',
    });

    worker.on('message', (message: AnalysisWorkerResponse) => {
      this.handleWorkerMessage(message);
    });

    worker.on('error', (error: Error) => {
      this.rejectAll(error);
      this.worker = null;
    });

    return worker;
  }

  private async ensureWorker(): Promise<RuntimeWorker> {
    if (this.worker) return this.worker;

    if (isNodeRuntime()) {
      this.worker = await this.createNodeWorker();
      return this.worker;
    }

    this.worker = this.createBrowserWorker();
    return this.worker;
  }

  private async sendRequest(
    request: AnalysisWorkerRequest,
    expected: ExpectedResponseType,
    timeoutMs: number,
  ): Promise<PendingResolveValue> {
    const worker = await this.ensureWorker();

    return new Promise<PendingResolveValue>((resolve, reject) => {
      const timeoutRef = setTimeout(() => {
        this.pending.delete(request.id);
        reject(new Error(`Analysis worker timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(request.id, {
        expected,
        resolve,
        reject,
        timeoutRef,
      });

      worker.postMessage(request);
    });
  }

  async generateSignal(candles: CandlePoint[], timeoutMs = 20000): Promise<TradeSignal> {
    const id = ++this.requestId;
    const request: AnalysisWorkerRequest = {
      id,
      type: 'GENERATE_SIGNAL',
      payload: { candles },
    };
    return this.sendRequest(request, 'GENERATE_SIGNAL_RESULT', timeoutMs) as Promise<TradeSignal>;
  }

  async buildOrderIntent(order: OrderIntentBuildPayload, timeoutMs = 10000): Promise<OrderIntent> {
    const id = ++this.requestId;
    const request: AnalysisWorkerRequest = {
      id,
      type: 'BUILD_ORDER_INTENT',
      payload: { order },
    };
    return this.sendRequest(request, 'ORDER_INTENT_RESULT', timeoutMs) as Promise<OrderIntent>;
  }

  dispose() {
    if (this.worker) {
      void Promise.resolve(this.worker.terminate());
      this.worker = null;
    }
    this.rejectAll(new Error('Analysis worker client disposed'));
  }
}

export const analysisWorkerClient = new AnalysisWorkerClient();

export async function generateSignalInWorker(
  candles: CandlePoint[],
  options?: { timeoutMs?: number; fallbackToMainThread?: boolean },
): Promise<TradeSignal> {
  const timeoutMs = options?.timeoutMs ?? 20000;
  const fallbackToMainThread = options?.fallbackToMainThread ?? true;

  try {
    return await analysisWorkerClient.generateSignal(candles, timeoutMs);
  } catch (error) {
    if (!fallbackToMainThread) {
      throw error;
    }
    return generateSignal(candles);
  }
}

export async function buildOrderIntentInWorker(
  order: OrderIntentBuildPayload,
  options?: { timeoutMs?: number; fallbackToMainThread?: boolean },
): Promise<OrderIntent> {
  const timeoutMs = options?.timeoutMs ?? 10000;
  const fallbackToMainThread = options?.fallbackToMainThread ?? true;

  try {
    return await analysisWorkerClient.buildOrderIntent(order, timeoutMs);
  } catch (error) {
    if (!fallbackToMainThread) {
      throw error;
    }
    return buildOrderIntent(order);
  }
}
