import Link from "next/link";

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  className?: string;
}

export function Breadcrumb({ segments, className }: BreadcrumbProps) {
  return (
    <nav className={`font-[family-name:var(--font-space-grotesk)] text-xs flex items-center gap-1${className ? ` ${className}` : ""}`}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-muted-foreground">/</span>
            )}
            {isLast ? (
              <span className="text-foreground/70">{segment.label}</span>
            ) : (
              <Link
                href={segment.href ?? "#"}
                className="text-muted-foreground hover:text-foreground/70 transition-colors"
              >
                {segment.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
