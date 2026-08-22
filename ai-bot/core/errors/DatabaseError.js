import AppError from "./AppErrors.js";

export default class DatabaseError extends AppError {
    constructor(message = "Database operation failed") {
        super(message, 500);
    }
}