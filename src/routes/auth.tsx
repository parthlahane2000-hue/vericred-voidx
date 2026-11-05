import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { Container, Notice, SectionLabel } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const safePath = (p: unknown) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "/student");

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {},
  head: () => ({
    meta: [
      { title: "Sign in — VeriCred" },
      { name: "description", content: "Students sign in to see their issued credentials. University staff sign in to issue and revoke them." },
      { property: "og:title", content: "Sign in — VeriCred" },
      { property: "og:description", content: "Sign in to the student portal or the university portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const target = safePath(redirect);
  const staff = target.startsWith("/issuer");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: target, replace: true });
    });
  }, [navigate, target]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Passwords are at least 8 characters.");
    setBusy(true);
    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (err) return setError(err.message === "Invalid login credentials" ? "That email and password don't match." : err.message);
      void navigate({ to: target, replace: true });
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}${target}`, data: { signup_as: staff ? "staff" : "student" } },
      });
      setBusy(false);
      if (err) return setError(err.message);
      if (data.session) void navigate({ to: target, replace: true });
      else setSent(true);
    }
  };

  return (
    <Container className="py-20">
      <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-12">
        <div className="col-span-12 min-w-0 lg:col-span-5">
          <SectionLabel>{staff ? "University portal" : "Student portal"}</SectionLabel>
          <h1 className="mt-4 text-5xl leading-tight">{staff ? "Registrar staff only." : "See what's on record for you."}</h1>
          <p className="mt-6 max-w-md text-muted-foreground">
            {staff
              ? "Issuing and revoking credentials changes what every employer sees. Sign in with your staff account."
              : "Use the email address your university has for you. You'll see every credential issued to it, and whether any has been revoked."}{" "}
            Employers don't need an account to check a credential.
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/auth", search: { redirect: staff ? "/student" : "/issuer" }, replace: true })}
            className="mt-6 text-sm underline decoration-accent decoration-2 underline-offset-4"
          >
            {staff ? "I'm a student" : "I'm university staff"}
          </button>
        </div>

        <div className="col-span-12 min-w-0 lg:col-span-5 lg:col-start-8">
          {sent ? (
            <div className="sheet p-8">
              <h2 className="text-3xl">Check your inbox.</h2>
              <p className="mt-4 text-muted-foreground">
                We sent a confirmation link to {email}. Open it, then come back and sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="sheet p-8">
              <div role="tablist" className="flex gap-6 border-b border-border">
                {(
                  [
                    ["signin", "Sign in"],
                    ["signup", staff ? "Create staff account" : "Create account"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    className={cn(
                      "-mb-px border-b-2 pb-3 text-sm transition-colors",
                      mode === m ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-8 space-y-6">
                <div className="space-y-2">
                  <label htmlFor="email" className="kicker block">Email</label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-sm bg-background" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="kicker block">Password</label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-sm bg-background"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" size="lg" disabled={busy} className="w-full">
                  {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </div>
            </form>
          )}
          {staff && mode === "signup" && !sent && (
            <Notice title="Approval" className="mt-6">
              New accounts can issue credentials only after the registrar approves them.
            </Notice>
          )}
        </div>
      </div>
    </Container>
  );
}
