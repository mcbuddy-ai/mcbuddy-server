import { ContextLogger } from "./context";
import { ILogObj, Logger } from "tslog";

const _logger = new Logger<ILogObj>({ type: "json", name: "MCBuddy-Server" });
export const logger = new ContextLogger(_logger);

logger.info("Initialization of MCBuddy Server");