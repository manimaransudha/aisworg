import "express-session";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
      avatar_url: string | null;
      is_active: boolean;
      platformBadges?: string[];
      type?: string | null;
      tenant_id?: string | null;
    };
    flash?: { type?: string; message?: string; error?: string; info?: string };
    formInput?: Record<string, unknown>;
    _t?: number;
  }
}
