import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middleware/errorHandler.js";
import { analyzeSession } from "../services/spike.service.js";

const pointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  t: z.number(),
  accuracy: z.number().optional(),
});

const loopSchema = z.object({
  segments: z.array(z.array(pointSchema)),
});

export const analyzeLoop = async (request: Request, response: Response): Promise<void> => {
  const input = parseBody(loopSchema, request.body);
  const results = await analyzeSession(input.segments);
  response.status(200).json({ results });
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
