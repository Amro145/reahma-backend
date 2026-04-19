export type Bindings = {
  rahma_db: D1Database;
  RATE_LIMITER: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ALLOWED_ORIGINS: string; // Comma-separated list
};

export type Variables = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  session: {
    id: string;
    activeOrganizationId?: string | null;
  };
  orgId: string;
  role: 'owner' | 'admin' | 'member';
};
