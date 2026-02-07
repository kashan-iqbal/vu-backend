// ============================================
// Error Handling Middleware
// ============================================

import { Request, Response, NextFunction } from "express";
import { AIError } from "./ai.types";

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handler
 */
export function errorHandlerAiRoute(
  err: Error | AIError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error for monitoring
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle AIError (custom errors)
  if (err instanceof AIError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Handle multer errors
  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: "File upload error: " + err.message,
    });
  }

  // Handle MongoDB errors
  if (err.name === "MongoError" || err.name === "MongoServerError") {
    return res.status(500).json({
      success: false,
      message: "Database error occurred",
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Default error
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && {
      error: err.message,
      stack: err.stack,
    }),
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
}

/**
 * Stream error handler
 */
export function handleStreamError(res: Response, error: any) {
  console.error("Stream error:", error);

  // If headers not sent, send error response
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      message: "Stream processing failed",
    });
  } else {
    // Headers already sent, just end the stream
    res.end();
  }
}