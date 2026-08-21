import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

const fallback = Icons.AppWindow;

export function AppIcon({ name, ...props }: { name: string } & LucideProps) {
  const Registry = Icons as unknown as Record<string, React.ComponentType<LucideProps>>;
  const Cmp = Registry[name] ?? fallback;
  return <Cmp {...props} />;
}

export const ICON_OPTIONS = [
  "Calculator",
  "Users",
  "Globe",
  "Tags",
  "BookOpen",
  "Images",
  "Receipt",
  "Gem",
  "Boxes",
  "ChartLine",
  "Truck",
  "Wrench",
  "Mail",
  "FileText",
  "AppWindow",
];
