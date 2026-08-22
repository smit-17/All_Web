import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, LogOut, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminApps,
  adminChangePassword,
  adminLogin,
  adminLogout,
  adminStatus,
  deleteApp,
  saveApp,
} from "@/lib/lepdo.functions";
import { AppIcon, ICON_OPTIONS } from "@/components/lepdo/AppIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — LEPDO Workspace" },
      { name: "description", content: "Add, edit and secure LEPDO workspace applications." },
      { property: "og:title", content: "Admin — LEPDO Workspace" },
      { property: "og:description", content: "Manage the applications shown on the LEPDO dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Draft = {
  id?: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
  accent: string;
  sort_order: number;
  is_active: boolean;
  password: string;
  admin_password: string;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  url: "https://",
  icon: "AppWindow",
  category: "General",
  accent: "gold",
  sort_order: 0,
  is_active: true,
  password: "",
  admin_password: "",
};

function AdminPage() {
  const status = useServerFn(adminStatus);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    status().then((r) => setAuthed(r.isAdmin));
  }, [status]);

  if (authed === null) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return authed ? <AdminConsole onSignedOut={() => setAuthed(false)} /> : <AdminGate onOk={() => setAuthed(true)} />;
}

function AdminGate({ onOk }: { onOk: () => void }) {
  const login = useServerFn(adminLogin);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    const res = await login({ data: { password } }).catch(() => ({ ok: false }));
    setPending(false);
    if (res.ok) onOk();
    else setError("Incorrect master password.");
  }

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <form
        onSubmit={submit}
        className="surface-card w-full max-w-sm space-y-4 rounded-3xl border border-border/70 p-7"
      >
        <div className="gradient-navy grid size-12 place-items-center rounded-2xl text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Admin access</h1>
          <p className="text-sm text-muted-foreground">
            Enter the workspace master password to manage applications.
          </p>
        </div>
        <Input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Master password"
          className="h-11 rounded-xl"
        />
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" variant="navy" className="h-11 w-full" disabled={pending || !password}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Sign in
        </Button>
        <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          Back to dashboard
        </Link>
      </form>
    </div>
  );
}

function AdminConsole({ onSignedOut }: { onSignedOut: () => void }) {
  const queryClient = useQueryClient();
  const fetchApps = useServerFn(adminApps);
  const save = useServerFn(saveApp);
  const remove = useServerFn(deleteApp);
  const logout = useServerFn(adminLogout);
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["admin-apps"],
    queryFn: () => fetchApps(),
  });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          ...(d.id ? { id: d.id } : {}),
          name: d.name,
          description: d.description,
          url: d.url,
          icon: d.icon,
          category: d.category,
          accent: d.accent,
          sort_order: Number(d.sort_order) || 0,
          is_active: d.is_active,
          ...(d.password ? { password: d.password } : {}),
          admin_password: d.admin_password,
        },
      }),
    onSuccess: () => {
      toast.success("Application saved");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-apps"] });
      queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save application"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Application removed");
      queryClient.invalidateQueries({ queryKey: ["admin-apps"] });
      queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });

  return (
    <div className="min-h-screen">
      <header className="gradient-navy text-primary-foreground">
        <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-6 sm:px-8">
          <div className="min-w-0">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="size-3.5" /> Dashboard
            </Link>
            <h1 className="truncate text-xl font-semibold">Application admin</h1>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              onSignedOut();
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary-foreground/25 px-3 py-2 text-xs font-medium hover:bg-primary-foreground/10"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-5 py-8 sm:px-8">
        <Button variant="gold" className="h-11 w-full sm:w-auto" onClick={() => setDraft({ ...emptyDraft })}>
          <Plus className="size-4" /> Add application
        </Button>

        <ChangePasswordCard />


        {draft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(draft);
            }}
            className="surface-card space-y-4 rounded-3xl border border-border/70 p-5"
          >
            <h2 className="text-lg font-semibold">{draft.id ? "Edit application" : "New application"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  required
                  maxLength={60}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input
                  required
                  maxLength={40}
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Application URL</Label>
                <Input
                  required
                  type="url"
                  maxLength={500}
                  value={draft.url}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  maxLength={240}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <Select value={draft.icon} onValueChange={(v) => setDraft({ ...draft, icon: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <span className="inline-flex items-center gap-2">
                          <AppIcon name={icon} className="size-4" /> {icon}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Accent</Label>
                <Select value={draft.accent} onValueChange={(v) => setDraft({ ...draft, accent: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="navy">Navy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{draft.id ? "Password (visible)" : "Access password"}</Label>
                <Input
                  type="text"
                  required={!draft.id}
                  minLength={4}
                  value={draft.password}
                  placeholder={draft.id ? "Leave blank to keep current" : "Minimum 4 characters"}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Admin password</Label>
                <Input
                  type="text"
                  maxLength={128}
                  value={draft.admin_password}
                  placeholder="Admin password for this application"
                  onChange={(e) => setDraft({ ...draft, admin_password: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />
                <Label>Visible on dashboard</Label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="navy" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-3">
            {apps.map((app) => (
              <li
                key={app.id}
                className="surface-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="gradient-gold grid size-10 shrink-0 place-items-center rounded-xl text-accent-foreground">
                    <AppIcon name={app.icon} className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {app.name}
                      {!app.is_active && (
                        <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{app.url}</p>
                    <p className="truncate text-xs font-medium text-foreground">Pass: {app.password}</p>
                    {app.admin_password ? (
                      <p className="truncate text-xs font-medium text-foreground">
                        Admin Pass: {app.admin_password}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft({ ...app, password: app.password ?? "", admin_password: app.admin_password ?? "" })}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${app.name}`}
                    onClick={() => deleteMutation.mutate(app.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ChangePasswordCard() {
  const change = useServerFn(adminChangePassword);
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await change({ data: { newPassword: next } });
      toast.success("Admin password updated");
      setNext("");
    } catch (err) {
      toast.error((err as Error).message || "Could not update password");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="surface-card flex flex-wrap items-end gap-3 rounded-3xl border border-border/70 p-5"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label>Admin master password</Label>
        <Input
          type="text"
          minLength={4}
          maxLength={200}
          value={next}
          placeholder="New master password"
          onChange={(e) => setNext(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Stored in the database, not in .env — changing it here applies everywhere instantly.
        </p>
      </div>
      <Button type="submit" variant="outline" disabled={pending || next.length < 4}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Update
      </Button>
    </form>
  );
}
