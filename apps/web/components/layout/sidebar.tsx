"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BrainCircuit,
  Database,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@rag/ui";

import { navigation } from "@/components/layout/navigation";
import { WorkspaceSelector } from "@/components/workspace/workspace-selector";

const icons = {
  LayoutDashboard,
  MessageSquareText,
  Database,
  Activity,
  ShieldCheck,
  Users,
  Settings,
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-6">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
          <BrainCircuit className="size-5" />
        </span>
        <span>RAG Assistant</span>
      </Link>
      <nav className="grid gap-1">
        {navigation.map((item) => {
          const Icon = icons[item.icon as keyof typeof icons];
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-muted-foreground hover:bg-accent/10 hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="size-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
      <div className="sm:hidden">
        <WorkspaceSelector />
      </div>
      <div className="bg-card text-card-foreground mt-auto rounded-lg border p-4">
        <p className="text-sm font-medium">Index status</p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          3 sources ready for retrieval. 1 connector pending configuration.
        </p>
      </div>
    </div>
  );
}
