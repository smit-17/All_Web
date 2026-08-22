import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { useSession } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";


export type PublicApp = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  accent: string;
  sort_order: number;
  password: string;
};

export type AdminApp = Omit<PublicApp, "password"> & {
  url: string;
  is_active: boolean;
  password: string;
};

export type AppInput = {
  id?: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
  accent: string;
  sort_order: number;
  is_active: boolean;
  password?: string;
};

type AdminSession = { isAdmin?: boolean; key?: string };
type WorkspaceSession = { unlocked?: boolean };

function isProduction() {
  return process.env["NODE_ENV"] === "production";
}

function getSessionSecret() {
  const secret = process.env["SESSION_SECRET"];
  if (secret) return secret;
  if (isProduction()) throw new Error("SESSION_SECRET is required in production");
  console.warn(
    "[lepdo] SESSION_SECRET is not set; using a dev-only fallback. Set SESSION_SECRET for production.",
  );
  return "lepdo-local-dev-session-secret-32-characters";
}

function sessionConfig() {
  return {
    password: getSessionSecret(),
    name: "lepdo-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function workspaceSessionConfig() {
  return {
    password: getSessionSecret(),
    name: "lepdo-workspace",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}


export async function isWorkspaceUnlocked() {
  const session = await useSession<WorkspaceSession>(workspaceSessionConfig());
  return session.data.unlocked === true;
}

export async function workspaceSignIn(password: string) {
  const expected = process.env["WORKSPACE_PASSWORD"] ?? "2424";
  if (!safeEqual(password, expected)) return { ok: false as const };
  const session = await useSession<WorkspaceSession>(workspaceSessionConfig());
  await session.update({ unlocked: true });
  return { ok: true as const };
}

export async function workspaceSignOut() {
  const session = await useSession<WorkspaceSession>(workspaceSessionConfig());
  await session.clear();
  return { ok: true as const };
}


export function hashPassword(salt: string, password: string) {
  return createHash("sha256")
    .update(salt + password, "utf8")
    .digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = createHash("sha256").update(a, "utf8").digest();
  const bb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ab, bb);
}

export function newSalt() {
  return randomUUID();
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function publicDb() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required");
  }
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (isNewSupabaseApiKey(key) && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const PUBLIC_COLUMNS = "id, name, description, icon, category, accent, sort_order, password_plain";


export async function fetchPublicApps(): Promise<PublicApp[]> {
  if (!(await isWorkspaceUnlocked())) throw new Error("Workspace locked");
  const supabase = publicDb();
  const { data, error } = await (supabase
    .from("apps" as any)
    .select(PUBLIC_COLUMNS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true }) as any);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown> & { password_plain: string }) => {
    const { password_plain, ...rest } = row;
    return { ...(rest as Omit<PublicApp, "password">), password: password_plain };
  });
}


export async function unlock(appId: string, password: string) {
  if (!(await isWorkspaceUnlocked())) return { ok: false as const };
  const supabase = publicDb();
  const { data, error } = await supabase.rpc("verify_app_password" as any, {
    _app_id: appId,
    _password: password,
  });
  if (error) throw new Error(error.message);
  const row = (data as { url: string; ok: boolean }[] | null)?.[0];
  if (!row || !row.ok) return { ok: false as const };
  return { ok: true as const, url: row.url };
}



export async function isAdmin() {
  const session = await useSession<AdminSession>(sessionConfig());
  return session.data.isAdmin === true && typeof session.data.key === "string" && session.data.key.length > 0;
}

export async function adminSignIn(password: string) {
  const supabase = publicDb();
  const { data, error } = await supabase.rpc("admin_login" as any, { _password: password });
  if (error) throw new Error(error.message);
  if (data !== true) return { ok: false as const };
  const session = await useSession<AdminSession>(sessionConfig());
  await session.update({ isAdmin: true, key: password });
  return { ok: true as const };
}


export async function adminSignOut() {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
}

async function requireAdmin() {
  const session = await useSession<AdminSession>(sessionConfig());
  if (session.data.isAdmin !== true || !session.data.key) throw new Error("Not authorized");
  return session.data.key;
}


export async function adminFetchApps(): Promise<AdminApp[]> {
  const adminKey = await requireAdmin();
  const supabase = publicDb();
  const { data, error } = await supabase.rpc("admin_list_apps" as any, {
    _admin_password: adminKey,
  });
  if (error) throw new Error(error.message);
  return ((data as any[]) ?? []).map((row) => {
    const { password_plain, ...rest } = row as Record<string, unknown> & { password_plain: string };
    return { ...(rest as Omit<AdminApp, "password">), password: password_plain };
  });
}

export async function adminSaveApp(input: AppInput) {
  const adminKey = await requireAdmin();
  if (!input.id && !input.password) {
    throw new Error("A password is required for a new application");
  }
  const supabase = publicDb();
  const { error } = await supabase.rpc("admin_upsert_app" as any, {
    _admin_password: adminKey,
    _id: input.id ?? null,
    _name: input.name,
    _description: input.description,
    _url: input.url,
    _icon: input.icon,
    _category: input.category,
    _accent: input.accent,
    _sort_order: input.sort_order,
    _is_active: input.is_active,
    _password: input.password ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function adminDeleteApp(id: string) {
  const adminKey = await requireAdmin();
  const supabase = publicDb();
  const { error } = await supabase.rpc("admin_delete_app" as any, {
    _admin_password: adminKey,
    _id: id,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

