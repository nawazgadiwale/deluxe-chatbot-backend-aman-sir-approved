import AppError from "./AppErrors.js";

export default class AIError extends AppError {
    constructor(message = "AI operation failed") {
        super(message, 500);
    }
}