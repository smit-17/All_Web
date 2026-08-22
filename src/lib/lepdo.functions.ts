import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AppInput } from "./lepdo.server";

const appInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(240).default(""),
  url: z.string().trim().url().max(500),
  icon: z.string().trim().min(1).max(40),
  category: z.string().trim().min(1).max(40),
  accent: z.string().trim().min(1).max(20),
  sort_order: z.number().int().min(0).max(999),
  is_active: z.boolean(),
  password: z.string().min(4).max(128).optional(),
});

export const workspaceStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isWorkspaceUnlocked } = await import("./lepdo.server");
  return { unlocked: await isWorkspaceUnlocked() };
});

export const workspaceLogin = createServerFn({ method: "POST" })
  .validator((data: { password: string }) =>
    z.object({ password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { workspaceSignIn } = await import("./lepdo.server");
    return workspaceSignIn(data.password);
  });

export const workspaceLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { workspaceSignOut } = await import("./lepdo.server");
  return workspaceSignOut();
});

export const listApps = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchPublicApps } = await import("./lepdo.server");
  return fetchPublicApps();
});


export const unlockApp = createServerFn({ method: "POST" })
  .validator((data: { appId: string; password: string }) =>
    z.object({ appId: z.string().uuid(), password: z.string().min(1).max(128) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { unlock } = await import("./lepdo.server");
    return unlock(data.appId, data.password);
  });

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdmin } = await import("./lepdo.server");
  return { isAdmin: await isAdmin() };
});

export const adminLogin = createServerFn({ method: "POST" })
  .validator((data: { password: string }) =>
    z.object({ password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { adminSignIn } = await import("./lepdo.server");
    return adminSignIn(data.password);
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { adminSignOut } = await import("./lepdo.server");
  return adminSignOut();
});

export const adminChangePassword = createServerFn({ method: "POST" })
  .validator((data: { newPassword: string }) =>
    z.object({ newPassword: z.string().min(4).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { adminChangePassword: change } = await import("./lepdo.server");
    return change(data.newPassword);
  });


export const adminApps = createServerFn({ method: "GET" }).handler(async () => {
  const { adminFetchApps } = await import("./lepdo.server");
  return adminFetchApps();
});

export const saveApp = createServerFn({ method: "POST" })
  .validator((data: AppInput) => appInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { adminSaveApp } = await import("./lepdo.server");
    return adminSaveApp(data as AppInput);
  });

export const deleteApp = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { adminDeleteApp } = await import("./lepdo.server");
    return adminDeleteApp(data.id);
  });
