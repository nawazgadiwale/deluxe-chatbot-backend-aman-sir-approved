import  AppError  from "../../core/errors/AppErrors.js";

import  ValidationError  from "../../core/errors/ValidationError.js";

import  UnauthorizedError  from "../../core/errors/UnauthorizedError.js";

import  NotFoundError  from "../../core/errors/NotFoundError.js";

import  DatabaseError  from "../../core/errors/DatabaseError.js";

import  AIError  from "../../core/errors/AIError.js";

export default function ErrorMiddleware(error, req, res, next) {
  console.error(error);

  // Application Errors

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      code: error.code,
      message: error.message,
      details: error.details ?? null,
    });
  }

  if (error instanceof UnauthorizedError) {
    return res.status(401).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof DatabaseError) {
    return res.status(500).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof AIError) {
    return res.status(500).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }

  // Unknown Error

  return res.status(500).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  });
}
