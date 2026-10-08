import { Router } from "express";
import { login, me, register } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(register));
authRouter.post("/login", asyncHandler(login));
authRouter.get("/me", requireAuth, asyncHandler(me));
