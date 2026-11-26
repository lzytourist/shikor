import Link from "next/link";
import { GitFork } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShikorLogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ShikorLogo({
  href = "/",
  size = "md",
  className,
}: ShikorLogoProps) {
  const iconBoxSize =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const iconSize =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const textSize =
    size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 group focus-visible:outline-none",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105",
          iconBoxSize,
        )}
      >
        <GitFork className={cn("rotate-180", iconSize)} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-semibold tracking-tight text-foreground", textSize)}>
          Shikor
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          শিকড়
        </span>
      </div>
    </Link>
  );
}
