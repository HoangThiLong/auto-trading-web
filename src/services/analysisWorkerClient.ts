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

class AnalysisWorkerClient {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<number, PendingRequest>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      const message = event.data;
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
    };

    worker.onerror = (event) => {
      const error = new Error(event.message || 'Analysis worker crashed');
      this.rejectAll(error);
      this.worker = null;
    };

    this.worker = worker;
    return worker;
  }

  private rejectAll(error: Error) {
    for (const [, request] of this.pending) {
      clearTimeout(request.timeoutRef);
      request.reject(error);
    }
    this.pending.clear();
  }

  private sendRequest(
    request: AnalysisWorkerRequest,
    expected: ExpectedResponseType,
    timeoutMs: number,
  ): Promise<PendingResolveValue> {
    const worker = this.ensureWorker();

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
      this.worker.terminate();
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
