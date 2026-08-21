import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { useSession } from "@tanstack/react-start/server";

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

type AdminSession = { isAdmin?: boolean };
type WorkspaceSession = { unlocked?: boolean };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "lepdo-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function workspaceSessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
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

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const PUBLIC_COLUMNS = "id, name, description, icon, category, accent, sort_order";

export async function fetchPublicApps(): Promise<PublicApp[]> {
  if (!(await isWorkspaceUnlocked())) throw new Error("Workspace locked");
  const supabase = await db();
  const { data, error } = await supabase
    .from("apps")
    .select(`${PUBLIC_COLUMNS}, password_plain`)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const { password_plain, ...rest } = row as Record<string, unknown> & { password_plain: string };
    return { ...(rest as Omit<PublicApp, "password">), password: password_plain };
  });
}

export async function unlock(appId: string, password: string) {
  if (!(await isWorkspaceUnlocked())) return { ok: false as const };
  const supabase = await db();
  const { data, error } = await supabase
    .from("apps")
    .select("id, url, password_salt, password_hash, is_active")
    .eq("id", appId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.is_active) return { ok: false as const };
  const candidate = hashPassword(data.password_salt, password);
  if (!safeEqual(candidate, data.password_hash)) return { ok: false as const };
  return { ok: true as const, url: data.url };
}


export async function isAdmin() {
  const session = await useSession<AdminSession>(sessionConfig());
  return session.data.isAdmin === true;
}

export async function adminSignIn(password: string) {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("Admin password is not configured");
  if (!safeEqual(password, expected)) return { ok: false as const };
  const session = await useSession<AdminSession>(sessionConfig());
  await session.update({ isAdmin: true });
  return { ok: true as const };
}

export async function adminSignOut() {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorized");
}

export async function adminFetchApps(): Promise<AdminApp[]> {
  await requireAdmin();
  const supabase = await db();
  const { data, error } = await supabase
    .from("apps")
    .select(`${PUBLIC_COLUMNS}, url, is_active, password_plain`)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const { password_plain, ...rest } = row as Record<string, unknown> & { password_plain: string };
    return { ...(rest as Omit<AdminApp, "password">), password: password_plain };
  });
}

export async function adminSaveApp(input: AppInput) {
  await requireAdmin();
  const supabase = await db();
  const base = {
    name: input.name,
    description: input.description,
    url: input.url,
    icon: input.icon,
    category: input.category,
    accent: input.accent,
    sort_order: input.sort_order,
    is_active: input.is_active,
  };

  if (input.id) {
    let patch = { ...base };
    if (input.password && input.password.length > 0) {
      const salt = newSalt();
      patch = {
        ...patch,
        password_salt: salt,
        password_hash: hashPassword(salt, input.password),
        password_plain: input.password,
      } as typeof patch;
    }
    const { error } = await supabase.from("apps").update(patch).eq("id", input.id);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  }

  if (!input.password) throw new Error("A password is required for a new application");
  const salt = newSalt();
  const { error } = await supabase.from("apps").insert({
    ...base,
    password_salt: salt,
    password_hash: hashPassword(salt, input.password),
    password_plain: input.password,
  });

  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function adminDeleteApp(id: string) {
  await requireAdmin();
  const supabase = await db();
  const { error } = await supabase.from("apps").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
