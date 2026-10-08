import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { AppError } from "../middleware/errorHandler.js";

type PublicUser = {
  id: string;
  email: string;
  username: string;
};

type UserWithPassword = PublicUser & {
  password_hash: string;
};

type UserWithColor = PublicUser & {
  color: string;
};
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const createToken = (userId: string): string => {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
};

export const register = async (
  email: string,
  username: string,
  password: string,
): Promise<{ token: string; user: PublicUser }> => {
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query<PublicUser>(
      "INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username",
      [email, username, passwordHash],
    );
    const user = result.rows[0];

    return { token: createToken(user.id), user };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "EMAIL_OR_USERNAME_TAKEN", "Email or username is already taken");
    }

    throw error;
  }
};

export const login = async (
  email: string,
  password: string,
): Promise<{ token: string; user: PublicUser }> => {
  const result = await pool.query<UserWithPassword>(
    "SELECT id, email, username, password_hash FROM users WHERE email = $1",
    [email],
  );
  
  const user = result.rows[0];
  const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);


  if (!user || !passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const { password_hash: _passwordHash, ...publicUser } = user;
  return { token: createToken(user.id), user: publicUser };
};

export const getCurrentUser = async (userId: string): Promise<{ user: UserWithColor }> => {
  const result = await pool.query<UserWithColor>(
    "SELECT id, email, username, color FROM users WHERE id = $1",
    [userId],
  );
  const user = result.rows[0];

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }

  return { user };
};

const isUniqueViolation = (error: unknown): boolean => {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
};
