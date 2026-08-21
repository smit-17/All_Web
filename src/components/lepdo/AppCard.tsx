import { Star, ArrowUpRight } from "lucide-react";
import { AppIcon } from "./AppIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppSummary = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  accent: string;
  password: string;
};


export function AppCard({
  app,
  index,
  isFavorite,
  onToggleFavorite,
  onOpen,
}: {
  app: AppSummary;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (app: AppSummary) => void;
}) {
  return (
    <article
      className="surface-card animate-rise group relative flex flex-col gap-4 rounded-3xl border border-border/70 p-5"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-2xl text-primary-foreground transition-transform duration-300 group-hover:scale-105",
              app.accent === "navy" ? "gradient-navy" : "gradient-gold text-accent-foreground",
            )}
          >
            <AppIcon name={app.icon} className="size-6" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-foreground">{app.name}</h3>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {app.category}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={isFavorite ? `Remove ${app.name} from favorites` : `Add ${app.name} to favorites`}
          onClick={() => onToggleFavorite(app.id)}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-gold"
        >
          <Star className={cn("size-4", isFavorite && "fill-gold text-gold")} />
        </button>
      </div>

      <p className="line-clamp-2 text-sm text-muted-foreground">{app.description}</p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          Pass: <span className="font-semibold text-foreground">{app.password}</span>
        </span>
        <Button size="sm" variant="gold" onClick={() => onOpen(app)}>
          Open <ArrowUpRight className="size-4" />
        </Button>
      </div>

    </article>
  );
}
