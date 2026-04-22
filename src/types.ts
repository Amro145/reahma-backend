export type Bindings = {
  rahma_db: D1Database;
  RATE_LIMITER: KVNamespace;
  JWT_SECRET: string;
  ALLOWED_ORIGINS: string;
};

export type UserRole = 'admin' | 'student';

export type Variables = {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
};