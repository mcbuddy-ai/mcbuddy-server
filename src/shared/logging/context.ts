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
    this.baseLogger.info(message, { ...this.context, ...args });
  }

  warn(message: string, ...args: any[]) {
    this.baseLogger.warn(message, { ...this.context, ...args });
  }

  error(message: string, ...args: any[]) {
    this.baseLogger.error(message, { ...this.context, ...args });
  }

  debug(message: string, ...args: any[]) {
    this.baseLogger.debug(message, { ...this.context, ...args });
  }

  fatal(message: string, ...args: any[]) {
    this.baseLogger.fatal(message, { ...this.context, ...args });
  }

  trace(message: string, ...args: any[]) {
    this.baseLogger.trace(message, { ...this.context, ...args });
  }
}
