import { Logger, ILogObj } from "tslog";

export class ContextLogger<T extends ILogObj = ILogObj> {
  private readonly baseLogger: Logger<T>;
  private readonly context: Record<string, any>;

  constructor(baseLogger: Logger<T>, context: Record<string, any> = {}) {
    this.baseLogger = baseLogger;
    this.context = context;
  }

  with(key: string, value: any): ContextLogger<T> {
    return new ContextLogger(this.baseLogger, { ...this.context, [key]: value });
  }

  info(message: string, ...args: any[]) {
    console.log("[INFO] " + message, ...args)
  }

  warn(message: string, ...args: any[]) {
    console.log("[WARN] " + message, ...args)
  }

  error(message: string, ...args: any[]) {
    console.log("[ERROR] " + message, ...args)
  }

  debug(message: string, ...args: any[]) {
    console.log("[DEBUG] " + message, ...args)
  }

  fatal(message: string, ...args: any[]) {
    console.log("[FATAL] " + message, ...args)
  }

  trace(message: string, ...args: any[]) {
    console.log("[TRACE] " + message, ...args)
  }
}
