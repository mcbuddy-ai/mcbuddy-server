import { calculate } from "./calculate";

declare const self: Worker;

// One expression per message. The parent terminates this worker when one runs too long.
self.onmessage = (event: MessageEvent<{ id: number; expression: string }>) => {
  const { id, expression } = event.data;
  try {
    self.postMessage({ id, result: calculate(expression) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};

self.postMessage({ ready: true });
