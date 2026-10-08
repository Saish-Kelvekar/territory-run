export type User = {
  id: string;
  email: string;
  username: string;
  color?: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};
