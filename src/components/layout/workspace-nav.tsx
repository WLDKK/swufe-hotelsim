"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  matchPrefixes?: string[];
};

type WorkspaceNavProps = {
  items: WorkspaceNavItem[];
  activeClassName: string;
  inactiveClassName: string;
};

function isActivePath(pathname: string, item: WorkspaceNavItem) {
  const prefixes = item.matchPrefixes ?? [item.href];

  // Nested routes such as /teacher/classes/[classId] should keep the parent
  // navigation item active so operators always know which workspace they are in.
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function WorkspaceNav({
  items,
  activeClassName,
  inactiveClassName,
}: WorkspaceNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Workspace navigation"
      className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0"
    >
      {items.map((item) => {
        const active = isActivePath(pathname, item);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex min-h-11 min-w-max items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition-colors lg:min-w-0",
              active ? activeClassName : inactiveClassName
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className="truncate pr-3">{item.label}</span>
            <ChevronRight
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform group-hover:translate-x-0.5",
                active ? "opacity-100" : "opacity-50"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
