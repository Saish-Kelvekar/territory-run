import { Router } from "express";
import { analyzeLoop } from "../controllers/spike.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const spikeRouter = Router();

spikeRouter.post("/loop", requireAuth, asyncHandler(analyzeLoop));
