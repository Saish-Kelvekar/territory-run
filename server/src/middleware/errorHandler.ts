import type { ErrorRequestHandler, RequestHandler } from "express";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({
      message: error.message,
      code: error.code,
      ...(error.fields ? { fields: error.fields } : {}),
    });
    return;
  }

  console.error("Unhandled request error:", error instanceof Error ? error.message : "Unknown error");
  response.status(500).json({ message: "Something went wrong", code: "INTERNAL_ERROR" });
};
