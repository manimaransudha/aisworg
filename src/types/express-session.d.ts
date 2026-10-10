import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
      avatar_url: string | null;
      role: string;
      is_active: boolean;
      platformBadges?: string[];
      type?: "Platform" | "Tenant" | null;
      tenant_id?: string | null;
    };
    flash?: unknown;
    _t?: number;
  }
}
