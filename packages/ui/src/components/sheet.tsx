"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";

type SheetContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet() {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used inside <Sheet>");
  }
  return context;
}

function Sheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
}

function SheetTrigger({ children }: { children: React.ReactNode }) {
  const { setOpen } = useSheet();
  return <div onClick={() => setOpen(true)}>{children}</div>;
}

function SheetContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, setOpen } = useSheet();

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Close navigation"
        className="bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <aside
        className={cn(
          "bg-background shadow-enterprise absolute inset-y-0 left-0 w-80 max-w-[85vw] border-r p-4",
          className,
        )}
      >
        <div className="mb-4 flex justify-end">
          <Button
            aria-label="Close navigation"
            size="icon"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export { Sheet, SheetTrigger, SheetContent };
