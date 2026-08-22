import { Logger } from "../../logger";

const requestLogger = (req, res, next) => {

    Logger.info({
        method: req.method,
        path: req.originalUrl,
        ip: req.ip
    });

    next();
};

export default requestLogger;