import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileDown, FileJson, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Container, Field, Monogram, Notice, PageIntro, SectionLabel, StatusMark } from "@/components/site/primitives";
import { credentialState } from "@/components/vericred/CredentialSlip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DOC_TYPE_LABEL, formatDate, formatDateTime, monogram } from "@/lib/vericred/format";
import { buildProofPdf } from "@/lib/vericred/proof-pdf";
import { listMyCredentials, type RegistryRecord } from "@/lib/vericred/registry";
import { useVeriCred } from "@/lib/vericred/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/student")({
  head: () => ({
    meta: [
      { title: "Student portal — VeriCred" },
      { name: "description", content: "Sign in to see the credentials your university issued to you, their live status, and download a proof document." },
      { property: "og:title", content: "Student portal — VeriCred" },
      { property: "og:description", content: "Your issued credentials, their status, and a proof you can hand over." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentPortal,
});

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const fileSlug = (r: RegistryRecord) => r.credential.digiLockerMetadata.docId.replace(/[^A-Za-z0-9]+/g, "-");

function StudentPortal() {
  const { user } = Route.useRouteContext();
  const email = user.email ?? "";
  const query = useQuery({ queryKey: ["student", "credentials", email], queryFn: () => listMyCredentials(email), enabled: !!email });
  const records = query.data ?? [];
  const revokedCount = records.filter((r) => r.isRevoked).length;

  return (
    <>
      <PageIntro
        number="06"
        kicker="Student portal"
        title={
          <>
            What your university <span className="italic">has on record</span> for you.
          </>
        }
        dek="Every credential issued to your email address, with the status an employer would see today. Download a proof document to attach to an application."
        aside={
          <dl className="grid grid-cols-2 gap-6 border-t border-border pt-4">
            <div>
              <dt className="kicker">Issued to you</dt>
              <dd className="mt-1 font-display text-3xl">{query.isPending ? "—" : records.length}</dd>
            </div>
            <div>
              <dt className="kicker">Revoked</dt>
              <dd className="mt-1 font-display text-3xl">{query.isPending ? "—" : revokedCount}</dd>
            </div>
          </dl>
        }
      />

      <Container>
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-y border-border py-3">
          <span className="datum min-w-0 text-muted-foreground">Signed in as {email}</span>
          <SignOutButton />
        </div>

        {query.isPending && <p className="kicker py-16">Loading your credentials…</p>}

        {query.isError && (
          <div className="py-16">
            <p className="text-destructive">{(query.error as Error).message}</p>
            <Button variant="outline" className="mt-4" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {query.isSuccess && records.length === 0 && (
          <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 py-12">
            <div className="col-span-12 min-w-0 lg:col-span-7">
              <h2 className="text-4xl leading-tight">Nothing issued to this email yet.</h2>
              <p className="mt-4 max-w-md text-muted-foreground">
                Credentials appear here once your university issues them to {email}. If you used a different address
                with the registrar, sign in with that one.
              </p>
            </div>
          </div>
        )}

        {records.length > 0 && (
          <ol className="border-t border-foreground">
            {records.map((r) => (
              <CredentialRow key={r.credential.id} record={r} />
            ))}
          </ol>
        )}

        <Notice title="Simulated signatures" className="mt-16 max-w-3xl">
          Records and revocation status come from the live registry. The signatures on them are a hash-based
          simulation, and no DigiLocker or blockchain service is contacted.
        </Notice>
      </Container>
    </>
  );
}

function CredentialRow({ record }: { record: RegistryRecord }) {
  const c = record.credential;
  const s = c.credentialSubject;
  const state = credentialState(c, record.isRevoked);
  const { addToWallet } = useVeriCred();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<Blob | null>(null);

  const preparePdf = async () => {
    setBusy(true);
    try {
      const blob = await buildProofPdf(record, `${window.location.origin}/verify`);
      setPdf(blob);
      downloadBlob(blob, `vericred-proof-${fileSlug(record)}.pdf`);
    } catch {
      toast.error("Couldn't create the proof document. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cn("grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-6 border-b border-border py-10", record.isRevoked && "bg-destructive-soft/40")}>
      <div className="col-span-12 flex min-w-0 gap-4 lg:col-span-7">
        <Monogram text={monogram(c.digiLockerMetadata.orgName)} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="kicker">{DOC_TYPE_LABEL[c.digiLockerMetadata.docType] ?? "Credential"} · {c.digiLockerMetadata.orgName}</p>
            <StatusMark tone={state.tone}>{state.label}</StatusMark>
          </div>
          <h2 className="mt-3 text-3xl leading-tight">{s.degreeName}</h2>
          <p className="mt-1 text-muted-foreground">{s.major}</p>

          {record.isRevoked && (
            <div className="mt-6 border-l-2 border-destructive pl-4">
              <p className="kicker text-destructive">Revoked{record.revokedAt ? ` · ${formatDateTime(record.revokedAt)}` : ""}</p>
              <p className="mt-1 text-sm">{record.revocationReason ?? "No reason was given."}</p>
              <p className="mt-2 text-sm text-muted-foreground">Employers who check this credential will see it as revoked. Contact the registrar if this looks wrong.</p>
            </div>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Graduation">{s.graduationYear}</Field>
            <Field label="CGPA">
              {s.cgpa} / {s.cgpaScale}
            </Field>
            <Field label="Issued">{formatDate(c.issuanceDate)}</Field>
            <Field label="Document ID" className="col-span-2 sm:col-span-3">
              <span className="datum">{c.digiLockerMetadata.docId}</span>
            </Field>
          </dl>
        </div>
      </div>

      <div className="col-span-12 flex min-w-0 flex-col items-start gap-3 lg:col-span-4 lg:col-start-9">
        <SectionLabel>Proof document</SectionLabel>
        <Button onClick={() => (pdf ? downloadBlob(pdf, `vericred-proof-${fileSlug(record)}.pdf`) : void preparePdf())} disabled={busy}>
          <FileDown className="size-4" />
          {busy ? "Preparing…" : "Download proof (PDF)"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const { verificationHistory: _h, ...doc } = c;
            downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), `vericred-credential-${fileSlug(record)}.json`);
          }}
        >
          <FileJson className="size-4" />
          Signed credential (JSON)
        </Button>
        {!record.isRevoked && (
          <Button
            variant="ghost"
            onClick={() => {
              addToWallet(c);
              void navigate({ to: "/wallet" });
            }}
          >
            Make a private proof in the wallet
            <ArrowRight className="size-4" />
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          The PDF shows today's status. Employers should still look up the document ID, which always returns the live status.
        </p>
      </div>
    </li>
  );
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
        void navigate({ to: "/auth", search: { redirect: "/student" }, replace: true });
      }}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}
