import { cn } from "@/lib/utils";

type StatVariant = "default" | "success" | "warning" | "danger";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: StatVariant;
  className?: string;
}

const variantStyles: Record<StatVariant, { accent: string; value: string }> = {
  default: { accent: "bg-blue-500", value: "text-foreground" },
  success: { accent: "bg-green-500", value: "text-green-500" },
  warning: { accent: "bg-amber-500", value: "text-amber-500" },
  danger: { accent: "bg-red-500", value: "text-red-500" },
};

export function StatCard({ label, value, subtext, variant = "default", className }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-surface p-4 transition-colors hover:border-border",
        className
      )}
    >
      {/* Accent bar */}
      <div className={cn("absolute left-0 right-0 top-0 h-0.5", styles.accent)} />

      <div className="mb-2 text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-[family-name:var(--font-jetbrains-mono)] text-[28px] font-semibold leading-none",
          styles.value
        )}
      >
        {value}
      </div>
      {subtext && (
        <div className="mt-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-muted-foreground/60">
          {subtext}
        </div>
      )}
    </div>
  );
}
