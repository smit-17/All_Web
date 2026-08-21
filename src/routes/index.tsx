import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Search, Star, Clock, Settings2, LayoutGrid, Lock } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/lepdo-wordmark.png.asset.json";
import { listApps, unlockApp, workspaceStatus, workspaceLogin } from "@/lib/lepdo.functions";
import { AppCard, type AppSummary } from "@/components/lepdo/AppCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusQuery = queryOptions({
  queryKey: ["workspace-status"],
  queryFn: () => workspaceStatus(),
});

const appsQuery = queryOptions({
  queryKey: ["apps"],
  queryFn: () => listApps(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statusQuery),
  head: () => ({
    meta: [
      { title: "LEPDO Workspace — Secure App Gateway" },
      {
        name: "description",
        content:
          "One secure LEPDO workspace to reach every internal tool: calculator, leads, catalog, pricing, storage and accounting.",
      },
      { property: "og:title", content: "LEPDO Workspace — Secure App Gateway" },
      {
        property: "og:description",
        content: "Password-protected access to every internal LEPDO application from one dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-sm text-destructive" role="alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Nothing here.</div>,
  component: Home,
});

const FAV_KEY = "lepdo:favorites";
const RECENT_KEY = "lepdo:recent";

function useLocalList(key: string) {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setItems(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, [key]);
  const save = useCallback(
    (next: string[]) => {
      setItems(next);
      window.localStorage.setItem(key, JSON.stringify(next));
    },
    [key],
  );
  return [items, save] as const;
}

function Home() {
  const { data: status } = useSuspenseQuery(statusQuery);
  if (!status.unlocked) return <WorkspaceGate />;
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
          Loading workspace…
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

function WorkspaceGate() {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await workspaceLogin({ data: { password } });
      if (!res.ok) {
        toast.error("Incorrect workspace password");
        return;
      }
      await queryClient.invalidateQueries();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="surface-card animate-rise w-full max-w-sm rounded-3xl border border-border/70 p-7 text-center">
        <img src={logo.url} alt="LEPDO" className="mx-auto h-14 w-auto object-contain" />
        <h1 className="mt-6 font-display text-xl font-semibold text-foreground">Workspace access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the workspace password to continue.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Workspace password"
            aria-label="Workspace password"
            autoFocus
            className="h-11 rounded-2xl text-center"
          />
          <Button type="submit" variant="navy" className="w-full" disabled={busy || !password}>
            <Lock className="size-4" /> Enter workspace
          </Button>
        </form>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data: apps } = useSuspenseQuery(appsQuery);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useLocalList(FAV_KEY);
  const [recent, setRecent] = useLocalList(RECENT_KEY);

  const categories = useMemo(
    () => ["All", "Favorites", ...Array.from(new Set(apps.map((a) => a.category))).sort()],
    [apps],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((app) => {
      const matchesQuery =
        !q ||
        app.name.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q);
      const matchesCategory =
        category === "All" ||
        (category === "Favorites" ? favorites.includes(app.id) : app.category === category);
      return matchesQuery && matchesCategory;
    });
  }, [apps, query, category, favorites]);

  const recentApps = useMemo(
    () =>
      recent
        .map((id) => apps.find((a) => a.id === id))
        .filter(Boolean)
        .slice(0, 4) as AppSummary[],
    [recent, apps],
  );

  function toggleFavorite(id: string) {
    setFavorites(favorites.includes(id) ? favorites.filter((f) => f !== id) : [id, ...favorites]);
  }

  async function openApp(app: AppSummary) {
    const win = window.open("", "_blank");
    try {
      const res = await unlockApp({ data: { appId: app.id, password: app.password } });
      if (!res.ok || !res.url) {
        win?.close();
        toast.error(`Could not open ${app.name}`);
        return;
      }
      setRecent([app.id, ...recent.filter((r) => r !== app.id)].slice(0, 8));
      if (win) win.location.href = res.url;
      else window.open(res.url, "_blank", "noopener");
    } catch {
      win?.close();
      toast.error(`Could not open ${app.name}`);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="gradient-navy text-primary-foreground">
        <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logo.url}
                alt="LEPDO logo"
                className="h-9 w-auto shrink-0 rounded-lg bg-background/95 p-1 sm:h-10"
              />
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-semibold sm:text-xl">
                  Workspace
                </h1>
                <p className="truncate text-xs text-primary-foreground/70">
                  Secure gateway to internal apps
                </p>
              </div>
            </div>
            <Link
              to="/admin"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary-foreground/25 px-3 py-2 text-xs font-medium transition-colors hover:bg-primary-foreground/10 sm:text-sm"
            >
              <Settings2 className="size-4" /> <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search applications…"
              aria-label="Search applications"
              className="h-12 rounded-2xl border-0 bg-background pl-11 text-foreground shadow-[var(--shadow-soft)]"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-6 pb-16 sm:px-8">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300",
                category === cat
                  ? "gradient-navy border-transparent text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "border-border bg-card text-muted-foreground hover:border-gold/60 hover:text-foreground",
              )}
            >
              {cat === "Favorites" ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-3.5" /> Favorites
                </span>
              ) : (
                cat
              )}
            </button>
          ))}
        </div>

        {recentApps.length > 0 && category === "All" && !query && (
          <section className="mt-6">
            <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              <Clock className="size-4" /> Recently opened
            </h2>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {recentApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openApp(app)}
                  className="surface-card shrink-0 rounded-2xl border border-border/70 px-4 py-3 text-left text-sm font-medium"
                >
                  {app.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            <LayoutGrid className="size-4" /> {filtered.length} application
            {filtered.length === 1 ? "" : "s"}
          </h2>
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No applications match your search.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((app, i) => (
                <AppCard
                  key={app.id}
                  app={app}
                  index={i}
                  isFavorite={favorites.includes(app.id)}
                  onToggleFavorite={toggleFavorite}
                  onOpen={openApp}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
