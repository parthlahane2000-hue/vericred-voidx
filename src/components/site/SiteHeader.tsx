import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { NAV_ITEMS } from "./nav";
import { Container } from "./primitives";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-foreground/15 bg-background/95 backdrop-blur-sm">
      <div className="border-b border-foreground/10">
        <Container className="flex h-8 items-center justify-between gap-4">
          <p className="kicker truncate">Prototype · sample records included</p>
          <p className="kicker hidden shrink-0 sm:block">Team VOIDX</p>
        </Container>
      </div>
      <Container className="flex h-16 items-center justify-between gap-8">
        <Link to="/" className="flex min-w-0 items-baseline gap-3" aria-label="VeriCred home">
          <span className="font-display text-[1.625rem] leading-none tracking-tight">
            Veri<span className="italic">Cred</span>
          </span>
          <span className="kicker hidden xl:inline">Academic credential registry</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground ink-underline", "aria-current": "page" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="inline-flex h-10 items-center gap-2 rounded-sm px-2 text-sm lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
            <span>Menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm bg-background">
            <SheetHeader>
              <SheetTitle className="font-display text-2xl font-normal">Sections</SheetTitle>
            </SheetHeader>
            <ol className="mt-6 divide-y divide-border border-y border-border">
              {NAV_ITEMS.map((item, i) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-baseline gap-4 px-4 py-4"
                    activeProps={{ className: "bg-secondary" }}
                  >
                    <span className="font-mono text-xs text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0">
                      <span className="block font-display text-xl">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </SheetContent>
        </Sheet>
      </Container>
    </header>
  );
}
