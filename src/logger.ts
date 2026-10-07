import { config } from "dotenv";
import pino from "pino";

config({ path: ".env", override: true, quiet: true });

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

export default logger;