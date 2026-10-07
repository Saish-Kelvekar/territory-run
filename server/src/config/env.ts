import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const invalidVariables = result.error.issues
    .map((issue) => issue.path.join("."))
    .filter((variable, index, variables) => variables.indexOf(variable) === index);

  console.error(`Invalid environment variables: ${invalidVariables.join(", ")}`);
  process.exit(1);
}

export const env = result.data;
