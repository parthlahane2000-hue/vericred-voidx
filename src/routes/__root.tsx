import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { VeriCredProvider } from "@/lib/vericred/store";

function NotFoundComponent() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[1280px] flex-col justify-center px-6 lg:px-10">
      <p className="kicker">Error 404</p>
      <h1 className="mt-4 text-6xl">No record at this address.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">The page may have moved, or the link was mistyped.</p>
      <div className="mt-8">
        <Link to="/" className="text-sm underline decoration-accent decoration-2 underline-offset-4">
          Back to the front page
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[1280px] flex-col justify-center px-6 lg:px-10">
      <p className="kicker">Something broke</p>
      <h1 className="mt-4 text-5xl">This page didn't load.</h1>
      <p className="mt-4 max-w-md text-muted-foreground">Try again, or head back to the front page.</p>
      <div className="mt-8 flex gap-6">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="text-sm underline decoration-accent decoration-2 underline-offset-4"
        >
          Try again
        </button>
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Front page
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VeriCred — verifiable academic credentials" },
      { name: "description", content: "Issue, hold and verify academic credentials. Prove a single fact without sharing the marksheet." },
      { name: "author", content: "Team VOIDX" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Hanken+Grotesk:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <VeriCredProvider>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
        <Toaster position="bottom-left" />
      </VeriCredProvider>
    </QueryClientProvider>
  );
}
