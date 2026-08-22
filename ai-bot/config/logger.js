import env from "./env.js";

const loggerConfig = Object.freeze({
  level: env.nodeEnv === "production" ? "info" : "debug",

  transport:
    env.nodeEnv === "production"
      ? undefined
      : {
          target: "pino-pretty",
        },
});

export default loggerConfig;
