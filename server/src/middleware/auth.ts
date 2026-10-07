import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (request: Request, _response: Response, next: NextFunction): void => {
  const header = request.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    next(new AppError(401, "UNAUTHORIZED", "Unauthorized"));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const userId =
      typeof payload === "object" && payload !== null
        ? (payload as JwtPayload).sub
        : undefined;

    if (!userId) {
      next(new AppError(401, "UNAUTHORIZED", "Unauthorized"));
      return;
    }

    (request as AuthRequest).userId = userId;
    next();
  } catch {
    next(new AppError(401, "UNAUTHORIZED", "Unauthorized"));
  }
};
