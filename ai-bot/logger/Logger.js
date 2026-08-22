import pino from "pino";
import { loggerConfig } from "../config/index.js";

const logger = pino(loggerConfig);

export default logger;