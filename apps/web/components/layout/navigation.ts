import type { NavItem } from "@rag/types";

export const navigation: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: "LayoutDashboard" },
  { title: "Chat", href: "/dashboard/chat", icon: "MessageSquareText" },
  { title: "Knowledge Base", href: "/dashboard/knowledge-base", icon: "Database" },
  { title: "Connectors", href: "/dashboard/connectors", icon: "Cable" },
  { title: "Observability", href: "/dashboard/observability", icon: "Activity" },
  { title: "Security", href: "/dashboard/security", icon: "ShieldCheck" },
  { title: "Members", href: "/dashboard/members", icon: "Users" },
  { title: "Settings", href: "/dashboard/settings", icon: "Settings" },
];
