"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu, Search } from "lucide-react";
import { Button, Input, Sheet, SheetContent, SheetTrigger } from "@rag/ui";

import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { WorkspaceSelector } from "@/components/workspace/workspace-selector";

export function TopNav() {
  return (
    <header className="bg-background/90 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:px-6">
      <Sheet>
        <SheetTrigger>
          <Button aria-label="Open navigation" className="lg:hidden" size="icon" variant="ghost">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <Sidebar />
        </SheetContent>
      </Sheet>
      <div className="relative hidden w-full max-w-md sm:block">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input className="pl-9" placeholder="Search sources, chats, citations..." />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:block">
          <WorkspaceSelector />
        </div>
        <ThemeToggle />
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-9",
            },
          }}
        />
      </div>
    </header>
  );
}
