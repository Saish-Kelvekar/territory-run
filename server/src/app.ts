import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { pool } from "./db/pool.js";

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

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error("Unhandled request error:", error);
  response.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
};

app.use(errorHandler);
