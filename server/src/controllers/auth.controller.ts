import type { Request, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import * as authService from "../services/auth.service.js";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  username: z.string().trim().min(3).max(20).regex(/^[A-Za-z0-9_]+$/),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const register = async (request: Request, response: Response): Promise<void> => {
  const input = parseBody(registerSchema, request.body);
  const result = await authService.register(input.email, input.username, input.password);
  response.status(201).json(result);
};

export const login = async (request: Request, response: Response): Promise<void> => {
  const input = parseBody(loginSchema, request.body);
  const result = await authService.login(input.email, input.password);
  response.status(200).json(result);
};

export const me = async (request: AuthRequest, response: Response): Promise<void> => {
  if (!request.userId) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const result = await authService.getCurrentUser(request.userId);
  response.status(200).json(result);
};

const parseBody = <T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> => {
  const result = schema.safeParse(body);

  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fields[field]) {
        fields[field] = issue.message;
      }
    }
    throw new AppError(400, "VALIDATION_ERROR", "Invalid request body", fields);
  }

  return result.data;
};
