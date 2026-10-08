import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pool } from "./db/pool.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.status(200).json({ ok: true, db: "up" });
  } catch (error) {
    console.error("Database health check failed:", error);
    response.status(503).json({ ok: false, db: "down" });
  }
});

app.use("/auth", authRouter);

app.use(errorHandler);
