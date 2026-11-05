import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Paperclip, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Container, Notice, PageIntro, SectionLabel, StatusMark } from "@/components/site/primitives";
import { CredentialSlip } from "@/components/vericred/CredentialSlip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/vericred/format";
import { supabase } from "@/integrations/supabase/client";
import { checkIsIssuer, issueToRegistry, listEvents, listRegistry, setRevokedInRegistry } from "@/lib/vericred/registry";
import { useVeriCred } from "@/lib/vericred/store";
import type { RevocationRegistryItem, W3CVerifiableCredential } from "@/lib/vericred/types";
import { buildCredential, validateIssueForm, type IssueFormState } from "@/lib/vericred/issue";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/issuer")({
  head: () => ({
    meta: [
      { title: "University portal — VeriCred" },
      { name: "description", content: "Issue signed academic credentials, search the registry and revoke a record with a stated reason." },
      { property: "og:title", content: "University portal — VeriCred" },
      { property: "og:description", content: "Issue it once. Revoke it the same day if you have to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IssuerPage,
});

type Tab = "registry" | "issue" | "log";

const EMPTY: IssueFormState = {
  studentName: "Priya N. Sundaram",
  studentEmail: "",
  studentRollNo: "2021CS1092",
  degreeName: "Bachelor of Technology (B.Tech)",
  major: "Computer Science and Engineering",
  graduationYear: "2025",
  cgpa: "9.15",
  honours: "First Class with Distinction",
  skills: "Machine Learning, Distributed Systems, Cryptography",
};

type FormState = IssueFormState;

function IssuerPage() {
  const { user } = Route.useRouteContext();
  const role = useQuery({ queryKey: ["issuer-role", user.id], queryFn: () => checkIsIssuer(user.id) });

  if (role.isPending) {
    return (
      <Container className="py-24">
        <p className="kicker">Checking your access…</p>
      </Container>
    );
  }
  if (!role.data) {
    return (
      <Container className="py-24">
        <SectionLabel>University portal</SectionLabel>
        <h1 className="mt-4 max-w-2xl text-5xl leading-tight">Your account is waiting for approval.</h1>
        <p className="mt-6 max-w-md text-muted-foreground">
          Signed in as {user.email}. The registrar has to approve staff accounts before they can issue or revoke credentials.
        </p>
        <div className="mt-8">
          <SignOutButton />
        </div>
      </Container>
    );
  }
  return <IssuerPortal userId={user.id} email={user.email ?? ""} />;
}

function SignOutButton() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        void navigate({ to: "/auth", replace: true });
      }}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}

function IssuerPortal({ userId, email }: { userId: string; email: string }) {
  const { addToWallet, refreshStatuses } = useVeriCred();
  const queryClient = useQueryClient();
  const registryQuery = useQuery({ queryKey: ["registry", "list"], queryFn: listRegistry });
  const eventsQuery = useQuery({ queryKey: ["registry", "events"], queryFn: listEvents });
  const registry = registryQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["registry"] });
    refreshStatuses();
  };
  const issue = useMutation({
    mutationFn: (v: { credential: W3CVerifiableCredential; email: string }) => issueToRegistry(v.credential, userId, v.email),
    onSuccess: (_d, { credential: c }) => {
      addToWallet(c);
      refresh();
      toast.success(`Issued to ${c.credentialSubject.studentName}. They can see it in the student portal now.`);
      setTab("registry");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const revoke = useMutation({
    mutationFn: (v: { id: string; revoked: boolean; reason?: string }) => setRevokedInRegistry(v.id, v.revoked, v.reason),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });
  const [tab, setTab] = useState<Tab>("registry");
  const [query, setQuery] = useState("");
  const [revoking, setRevoking] = useState<RevocationRegistryItem | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registry;
    return registry.filter((r) => [r.studentName, r.degreeName, r.docId].some((v) => v.toLowerCase().includes(q)));
  }, [registry, query]);

  const revokedCount = registry.filter((r) => r.isRevoked).length;

  return (
    <>
      <PageIntro
        number="05"
        kicker="University portal · IIT Delhi registrar"
        title={
          <>
            Issue it once. <span className="italic">Revoke it the same day</span> if you have to.
          </>
        }
        dek="Every credential gets a signature and a slot on the revocation list. Flip that slot and every future employer check sees it."

        aside={
          <dl className="grid grid-cols-3 gap-6 border-t border-border pt-4">
            <div>
              <dt className="kicker">Records</dt>
              <dd className="mt-1 font-display text-3xl">{registry.length}</dd>
            </div>
            <div>
              <dt className="kicker">Revoked</dt>
              <dd className="mt-1 font-display text-3xl">{revokedCount}</dd>
            </div>
            <div>
              <dt className="kicker">Events</dt>
              <dd className="mt-1 font-display text-3xl">{events.length}</dd>
            </div>
          </dl>
        }
      />

      <Container>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-y border-border py-3">
          <span className="datum min-w-0 text-muted-foreground">Signed in as {email}</span>
          <SignOutButton />
        </div>
        <div role="tablist" aria-label="Portal sections" className="flex flex-wrap gap-x-4 md:gap-x-8 gap-y-2 border-b border-border">
          {(
            [
              ["registry", "Registry"],
              ["issue", "Issue a credential"],
              ["log", "Audit log"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 pb-3 font-display text-xl transition-colors",
                tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "registry" && (
          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <p className="max-w-md text-sm text-muted-foreground">
                Each row is one slot on the status list. Revoking needs a reason, which the student and employers will see.
              </p>
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, degree or document ID"
                  className="h-11 rounded-sm bg-card pl-10"
                  aria-label="Search the registry"
                />
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-foreground text-left">
                    <th className="kicker w-20 py-3 pr-4 font-normal">Slot</th>
                    <th className="kicker py-3 pr-4 font-normal">Student</th>
                    <th className="kicker py-3 pr-4 font-normal">Credential</th>
                    <th className="kicker w-32 py-3 pr-4 font-normal">Status</th>
                    <th className="kicker py-3 pr-4 font-normal">Reason</th>
                    <th className="kicker w-28 py-3 text-right font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={cn("border-b border-border align-top", r.isRevoked && "bg-destructive-soft/40")}>
                      <td className="py-4 pr-4 font-mono text-xs">#{r.statusListIndex}</td>
                      <td className="py-4 pr-4">
                        <p>{r.studentName}</p>
                        <p className="whitespace-nowrap font-mono text-xs text-muted-foreground">{r.docId}</p>
                      </td>
                      <td className="py-4 pr-4">{r.degreeName}</td>
                      <td className="py-4 pr-4">
                        <StatusMark tone={r.isRevoked ? "destructive" : "success"}>{r.isRevoked ? "Revoked" : "Active"}</StatusMark>
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground">{r.revocationReason ?? "—"}</td>
                      <td className="py-4 text-right">
                        {r.isRevoked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              revoke.mutate(
                                { id: r.credentialId, revoked: false },
                                { onSuccess: () => toast.success(`Restored ${r.studentName}'s credential.`) },
                              );
                            }}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRevoking(r)}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {registryQuery.isPending && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        Loading the registry…
                      </td>
                    </tr>
                  )}
                  {!registryQuery.isPending && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        {query ? <>Nothing matches “{query}”.</> : "No credentials issued yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "issue" && (
          <IssueForm
            nextIndex={200 + registry.length}
            busy={issue.isPending}
            onIssue={(credential, email) => issue.mutate({ credential, email })}
          />
        )}

        {tab === "log" && (
          <section className="mt-10">
            <p className="max-w-md text-sm text-muted-foreground">Append-only: entries are added, never edited.</p>
            <ol className="mt-6 border-t border-foreground">
              {events.map((e) => (
                <li key={e.id} className="grid grid-cols-12 gap-x-4 gap-y-1 border-b border-border py-4">
                  <span className="col-span-12 font-mono text-xs text-muted-foreground sm:col-span-3">{formatDateTime(e.at)}</span>
                  <span className="col-span-12 sm:col-span-2">
                    <StatusMark tone={e.action === "REVOKED" ? "destructive" : e.action === "RESTORED" ? "warning" : "success"}>
                      {e.action.toLowerCase()}
                    </StatusMark>
                  </span>
                  <span className="col-span-12 min-w-0 sm:col-span-7">
                    <span className="block text-sm">{e.studentName}</span>
                    {e.note && <span className="block text-sm text-muted-foreground">{e.note}</span>}
                    <span className="datum block text-muted-foreground">{e.credentialId}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <Notice title="Simulated signatures" className="mt-16 max-w-3xl">
          Records and revocations are saved to the live registry database. The signatures themselves are a hash-based
          simulation, and no blockchain transaction is written.
        </Notice>
      </Container>

      <RevokeDialog
        item={revoking}
        onClose={() => setRevoking(null)}
        onConfirm={(reason) => {
          if (!revoking) return;
          const item = revoking;
          revoke.mutate(
            { id: item.credentialId, revoked: true, reason },
            { onSuccess: () => toast(`Revoked ${item.studentName}'s credential.`) },
          );
          setRevoking(null);
        }}
      />
    </>
  );
}

function IssueForm({ nextIndex, busy, onIssue }: { nextIndex: number; busy: boolean; onIssue: (c: W3CVerifiableCredential, email: string) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [attachment, setAttachment] = useState<string>("");

  const preview = useMemo(() => {
    const ok = Object.keys(validateIssueForm(form)).length === 0;
    return ok ? buildCredential(form, nextIndex) : null;
    // preview only needs to change with the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateIssueForm(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onIssue(buildCredential(form, nextIndex), form.studentEmail.trim());
  };

  const field = (k: keyof FormState, label: string, opts: { span?: string; inputMode?: "decimal" | "numeric" } = {}) => (
    <div className={cn("space-y-2", opts.span)}>
      <label htmlFor={`f-${k}`} className="kicker block">
        {label}
      </label>
      <Input
        id={`f-${k}`}
        value={form[k]}
        inputMode={opts.inputMode}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        aria-invalid={!!errors[k]}
        className={cn("h-11 rounded-sm bg-card", errors[k] && "border-destructive")}
      />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <section className="mt-10 grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-12">
      <form onSubmit={submit} noValidate className="col-span-12 min-w-0 lg:col-span-7">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {field("studentName", "Student's full name")}
          {field("studentEmail", "Student's email (they sign in with it)")}
          {field("studentRollNo", "Roll / registration no.")}
          {field("degreeName", "Degree")}
          {field("major", "Specialisation")}
          {field("graduationYear", "Graduation year", { inputMode: "numeric" })}
          {field("cgpa", "Final CGPA (out of 10)", { inputMode: "decimal" })}
          {field("honours", "Honours (optional)", { span: "sm:col-span-2" })}
          {field("skills", "Skills, comma separated (optional)", { span: "sm:col-span-2" })}
        </div>
        <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
          <Paperclip className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{attachment || "Attach the signed marksheet (PDF or image, optional)"}</span>
          <input
            type="file"
            accept=".pdf,image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) {
                toast.error("Attachments up to 10 MB.");
                return;
              }
              setAttachment(f.name);
            }}
          />
        </label>
        <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border pt-6">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Signing…" : "Sign and issue"}
          </Button>
          <p className="datum text-muted-foreground">Signed as did:web:iitd.ac.in · slot #{nextIndex}</p>
        </div>
      </form>

      <aside className="col-span-12 min-w-0 lg:col-span-4 lg:col-start-9">
        <SectionLabel>Preview</SectionLabel>
        <div className="mt-4">
          {preview ? (
            <CredentialSlip credential={preview} revoked={false} />
          ) : (
            <div className="border border-dashed border-border p-6 text-sm text-muted-foreground">Fix the highlighted fields to see the credential.</div>
          )}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">The student sees this in their wallet as soon as you issue it.</p>
      </aside>
    </section>
  );
}

function RevokeDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: RevocationRegistryItem | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogContent>
        {item && (
          <>
            <DialogHeader>
              <p className="kicker">Revoke · slot #{item.statusListIndex}</p>
              <DialogTitle>Revoke {item.studentName}'s credential?</DialogTitle>
              <DialogDescription>{item.degreeName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="reason" className="kicker block">
                Reason (shown to the student and employers)
              </label>
              <Textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Duplicate examination record found in audit"
                className="rounded-sm bg-background"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter className="gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (reason.trim().length < 8) return setError("Give a reason of at least 8 characters.");
                  onConfirm(reason.trim());
                  setReason("");
                  setError(null);
                }}
              >
                Revoke credential
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
