import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    statusCode
  });

  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
};

export class ValidationError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string) {
    super(message);
    this.statusCode = 400;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message = 'Unauthorized') {
    super(message);
    this.statusCode = 401;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ForbiddenError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message = 'Forbidden') {
    super(message);
    this.statusCode = 403;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message = 'Resource not found') {
    super(message);
    this.statusCode = 404;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
