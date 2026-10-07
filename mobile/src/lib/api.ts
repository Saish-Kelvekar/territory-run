import type { AuthResponse, User } from "../types/auth";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not configured");
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
  onUnauthorized?: () => Promise<void>;
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Unable to connect to the server");
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    if (response.status === 401 && options.onUnauthorized) {
      await options.onUnauthorized();
    }

    const errorData = isErrorResponse(data) ? data : undefined;
    throw new ApiError(
      response.status,
      errorData?.code ?? "REQUEST_FAILED",
      getErrorMessage(response.status, errorData?.message),
      errorData?.fields,
    );
  }

  return data as T;
};

export const register = (body: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthResponse> => {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body,
  });
};

export const login = (body: {
  email: string;
  password: string;
}): Promise<AuthResponse> => {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body,
  });
};

export const getMe = (token: string, onUnauthorized: () => Promise<void>): Promise<{ user: User }> => {
  return request<{ user: User }>("/auth/me", {
    token,
    onUnauthorized,
  });
};

const isErrorResponse = (
  data: unknown,
): data is { message?: string; code?: string; fields?: Record<string, string> } => {
  return typeof data === "object" && data !== null;
};

const getErrorMessage = (status: number, message?: string): string => {
  if (status === 409) {
    return "Email or username already taken";
  }
  if (status === 401) {
    return "Invalid email or password";
  }
  return message ?? "Something went wrong";
};
