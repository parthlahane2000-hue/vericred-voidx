import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Check, Copy, Download, QrCode } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Container, Field, Monogram, Notice, PageIntro, SectionLabel, StatusMark } from "@/components/site/primitives";
import { credentialState } from "@/components/vericred/CredentialSlip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DOC_TYPE_LABEL, downloadJson, formatDate, monogram, shortHash } from "@/lib/vericred/format";
import { useVeriCred } from "@/lib/vericred/store";
import type { CredentialSubject, W3CVerifiableCredential, ZKSelectiveDisclosure } from "@/lib/vericred/types";
import { encodeShareToken } from "@/lib/vericred/verify";
import { createSelectiveDisclosurePresentation } from "@/lib/vericred/zkp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Student wallet — VeriCred" },
      { name: "description", content: "Hold your degrees and marksheets, and prove a single fact like CGPA ≥ 7 without sharing the transcript." },
      { property: "og:title", content: "Student wallet — VeriCred" },
      { property: "og:description", content: "Your credentials, your call on what leaves the wallet." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { credentials, revokedIds } = useVeriCred();
  const [proofFor, setProofFor] = useState<W3CVerifiableCredential | null>(null);
  const [transcriptFor, setTranscriptFor] = useState<W3CVerifiableCredential | null>(null);
  const [historyFor, setHistoryFor] = useState<W3CVerifiableCredential | null>(null);

  const holder = credentials.find((c) => c.credentialSubject.studentName === "Aarav Sharma") ?? credentials[0];
  const recent = useMemo(
    () =>
      credentials
        .flatMap((c) => (c.verificationHistory ?? []).map((h) => ({ ...h, degree: c.credentialSubject.degreeName })))
        .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))
        .slice(0, 5),
    [credentials],
  );
  const inactive = credentials.filter((c) => credentialState(c, revokedIds.has(c.id)).tone !== "success");

  return (
    <>
      <PageIntro
        number="01"
        kicker="Student wallet"
        title={
          <>
            Your credentials. <span className="italic">Your call</span> on what leaves.
          </>
        }
        dek="Every record here was signed by the university that issued it. When an employer asks for something, you make a proof that answers only that question."
        aside={
          holder ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4">
              <Field label="Holder">{holder.credentialSubject.studentName}</Field>
              <Field label="Records">{credentials.length}</Field>
              <Field label="Wallet ID" className="col-span-2">
                <span className="datum">{shortHash(holder.credentialSubject.id, 18)}</span>
              </Field>
            </dl>
          ) : null
        }
      />

      <Container>
        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-16">
          <div className="col-span-12 min-w-0 space-y-10 lg:col-span-8">
            {credentials.map((c, i) => (
              <CredentialDocument
                key={c.id}
                credential={c}
                index={i}
                revoked={revokedIds.has(c.id)}
                onProof={() => setProofFor(c)}
                onTranscript={() => setTranscriptFor(c)}
                onHistory={() => setHistoryFor(c)}
              />
            ))}
          </div>

          <aside className="col-span-12 min-w-0 lg:col-span-4">
            <div className="space-y-12 lg:sticky lg:top-32">
              <div className="border-l-2 border-accent pl-6">
                <SectionLabel>Privacy</SectionLabel>
                <p className="mt-3 font-display text-2xl leading-snug">
                  Nothing is sent anywhere until you make a proof and choose to share it.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Exact CGPA, marks, roll number and Aadhaar reference always stay hidden.
                </p>
              </div>

              <div>
                <SectionLabel>Recent checks on your records</SectionLabel>
                <ol className="mt-4 divide-y divide-border border-y border-border">
                  {recent.length === 0 && <li className="py-4 text-sm text-muted-foreground">No checks yet.</li>}
                  {recent.map((r) => (
                    <li key={r.id} className="py-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="min-w-0 text-sm font-medium">{r.verifierEntity.split("(")[0]?.trim()}</p>
                        <p className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatDate(r.verifiedAt)}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.disclosedSummary}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {inactive.length > 0 && (
                <div>
                  <SectionLabel>Revoked or expired</SectionLabel>
                  <ul className="mt-4 space-y-3">
                    {inactive.map((c) => (
                      <li key={c.id} className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="min-w-0">{c.credentialSubject.degreeName}</span>
                        <StatusMark tone="destructive">{credentialState(c, revokedIds.has(c.id)).label}</StatusMark>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </Container>

      <TranscriptDialog credential={transcriptFor} onClose={() => setTranscriptFor(null)} onProof={(c) => { setTranscriptFor(null); setProofFor(c); }} />
      <HistoryDialog credential={historyFor} onClose={() => setHistoryFor(null)} />
      {proofFor && <ProofDialog key={proofFor.id} credential={proofFor} onClose={() => setProofFor(null)} />}
    </>
  );
}

function CredentialDocument({
  credential: c,
  index,
  revoked,
  onProof,
  onTranscript,
  onHistory,
}: {
  credential: W3CVerifiableCredential;
  index: number;
  revoked: boolean;
  onProof: () => void;
  onTranscript: () => void;
  onHistory: () => void;
}) {
  const s = c.credentialSubject;
  const state = credentialState(c, revoked);
  const checks = c.verificationHistory?.length ?? 0;

  return (
    <article
      className={cn("sheet animate-rise p-6 sm:p-10", state.tone !== "success" && "bg-destructive-soft/40")}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Monogram text={monogram(c.issuer.name)} />
          <div className="min-w-0">
            <p className="kicker">{DOC_TYPE_LABEL[c.digiLockerMetadata.docType] ?? c.digiLockerMetadata.docType}</p>
            <p className="text-sm">{c.issuer.name}</p>
          </div>
        </div>
        <StatusMark tone={state.tone}>{state.label}</StatusMark>
      </header>

      <h2 className="mt-8 text-3xl leading-tight sm:text-4xl">{s.degreeName}</h2>
      <p className="mt-2 text-muted-foreground">{s.major}</p>

      <dl className="mt-8 grid grid-cols-2 gap-x-4 md:gap-x-8 gap-y-6 border-t border-border pt-6 sm:grid-cols-4">
        <Field label="Awarded to">{s.studentName}</Field>
        <Field label="Graduated">{s.graduationYear}</Field>
        <Field label="CGPA · only you">
          {s.cgpa.toFixed(2)} <span className="text-muted-foreground">/ {s.cgpaScale}</span>
        </Field>
        <Field label="Honours">{s.honours ?? "—"}</Field>
        <Field label="Issued">{formatDate(c.issuanceDate)}</Field>
        <Field label="Document URI" className="col-span-2">
          <span className="datum">{c.digiLockerMetadata.digiLockerURI}</span>
        </Field>
        <Field label="Signature" className="col-span-2 sm:col-span-1">
          <span className="datum">{c.proof.type}</span>
        </Field>
        <Field label="Expires">{c.expirationDate ? formatDate(c.expirationDate) : "Never"}</Field>
      </dl>

      {s.skillsAcquired && s.skillsAcquired.length > 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          <span className="kicker mr-2">Skills</span>
          {s.skillsAcquired.join(" · ")}
        </p>
      )}

      <footer className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-border pt-6">
        <Button onClick={onProof} disabled={state.tone !== "success"}>
          Create a proof <ArrowRight />
        </Button>
        <Button variant="ghost" onClick={onTranscript}>
          Transcript
        </Button>
        <Button variant="ghost" onClick={onHistory}>
          {checks} {checks === 1 ? "check" : "checks"} so far
        </Button>
        {state.tone !== "success" && (
          <p className="text-sm text-destructive">Proofs are disabled for a {state.label.toLowerCase()} credential.</p>
        )}
      </footer>
    </article>
  );
}

function TranscriptDialog({
  credential,
  onClose,
  onProof,
}: {
  credential: W3CVerifiableCredential | null;
  onClose: () => void;
  onProof: (c: W3CVerifiableCredential) => void;
}) {
  const subjects = credential?.credentialSubject.subjects ?? [];
  return (
    <Dialog open={!!credential} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {credential && (
          <>
            <DialogHeader>
              <p className="kicker">Private view</p>
              <DialogTitle>Transcript</DialogTitle>
              <DialogDescription>
                {credential.issuer.name} · {credential.credentialSubject.studentRollNo}
              </DialogDescription>
            </DialogHeader>
            {subjects.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-foreground text-left">
                    <th className="kicker py-2 pr-4 font-normal">Code</th>
                    <th className="kicker py-2 pr-4 font-normal">Subject</th>
                    <th className="kicker py-2 pr-4 text-right font-normal">Cr.</th>
                    <th className="kicker py-2 pr-4 text-right font-normal">Grade</th>
                    <th className="kicker py-2 text-right font-normal">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.code} className="border-b border-border">
                      <td className="py-3 pr-4 font-mono text-xs">{s.code}</td>
                      <td className="py-3 pr-4">{s.name}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{s.credits}</td>
                      <td className="py-3 pr-4 text-right">{s.grade}</td>
                      <td className="py-3 text-right tabular-nums">{s.scorePercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">No subject-level marks were included with this credential.</p>
            )}
            <Notice title="This stays in your wallet">A proof can confirm your CGPA clears a bar without sending this table.</Notice>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm">
                Cumulative CGPA <span className="font-display text-2xl">{credential.credentialSubject.cgpa.toFixed(2)}</span>
              </p>
              <Button onClick={() => onProof(credential)}>
                Make a proof from this <ArrowRight />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ credential, onClose }: { credential: W3CVerifiableCredential | null; onClose: () => void }) {
  const items = credential?.verificationHistory ?? [];
  return (
    <Dialog open={!!credential} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {credential && (
          <>
            <DialogHeader>
              <p className="kicker">Audit log</p>
              <DialogTitle>Who has checked this</DialogTitle>
              <DialogDescription>{credential.credentialSubject.degreeName}</DialogDescription>
            </DialogHeader>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody has checked this credential yet.</p>
            ) : (
              <ol className="divide-y divide-border border-y border-border">
                {items.map((h) => (
                  <li key={h.id} className="grid grid-cols-12 gap-x-4 gap-y-1 py-4">
                    <p className="col-span-12 text-sm font-medium sm:col-span-8">{h.verifierEntity}</p>
                    <p className="col-span-12 font-mono text-[11px] text-muted-foreground sm:col-span-4 sm:text-right">
                      {formatDate(h.verifiedAt)}
                    </p>
                    <p className="col-span-12 text-sm text-muted-foreground">{h.verificationPurpose}</p>
                    <p className="col-span-12 text-sm">{h.disclosedSummary}</p>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const PRESETS = [
  { label: "Standard tech role", threshold: 7, keys: ["degreeName", "institutionName", "graduationYear"] },
  { label: "Research / quant role", threshold: 8.5, keys: ["degreeName", "institutionName", "graduationYear", "honours"] },
  { label: "Bare minimum", threshold: 6, keys: ["degreeName", "institutionName"] },
] as const;

const DISCLOSABLE: Array<{ key: keyof CredentialSubject; label: string }> = [
  { key: "degreeName", label: "Degree" },
  { key: "institutionName", label: "Institution" },
  { key: "graduationYear", label: "Graduation year" },
  { key: "honours", label: "Honours" },
];

function ProofDialog({ credential, onClose }: { credential: W3CVerifiableCredential; onClose: () => void }) {
  const navigate = useNavigate();
  const { sendToVerifier } = useVeriCred();
  const s = credential.credentialSubject;
  const [threshold, setThreshold] = useState(7);
  const [disclose, setDisclose] = useState<Set<keyof CredentialSubject>>(new Set(["degreeName", "institutionName", "graduationYear"]));
  const [proof, setProof] = useState<ZKSelectiveDisclosure | null>(null);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const meets = s.cgpa >= threshold;
  const shareLink = proof && typeof window !== "undefined" ? `${window.location.origin}/verify?p=${encodeShareToken(proof)}` : "";

  const toggle = (k: keyof CredentialSubject, on: boolean) => {
    setProof(null);
    setDisclose((prev) => {
      const next = new Set(prev);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  };

  const generate = () => {
    setBusy(true);
    setTimeout(() => {
      setProof(createSelectiveDisclosurePresentation(credential, [...disclose], [{ attribute: "cgpa", threshold }]));
      setBusy(false);
    }, 400);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <p className="kicker">Selective disclosure</p>
          <DialogTitle>Prove a fact, hide the rest</DialogTitle>
          <DialogDescription>{s.degreeName} · {credential.digiLockerMetadata.orgName}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-8">
          {/* Controls */}
          <div className="col-span-12 min-w-0 space-y-8 md:col-span-7">
            <div>
              <p className="kicker">Start from</p>
              <div className="mt-3 grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
                {PRESETS.map((p) => {
                  const active = threshold === p.threshold && p.keys.length === disclose.size && p.keys.every((k) => disclose.has(k));
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setThreshold(p.threshold);
                        setDisclose(new Set(p.keys));
                        setProof(null);
                      }}
                      className={cn("bg-card p-4 text-left transition-colors hover:bg-secondary", active && "bg-secondary")}
                      aria-pressed={active}
                    >
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className="mt-1 block font-mono text-xs text-muted-foreground">CGPA ≥ {p.threshold.toFixed(1)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-4">
                <p className="kicker">Prove CGPA is at least</p>
                <p className="font-display text-3xl tabular-nums">{threshold.toFixed(1)}</p>
              </div>
              <Slider
                className="mt-4"
                min={5}
                max={9.5}
                step={0.5}
                value={[threshold]}
                onValueChange={([v]) => {
                  setThreshold(v ?? 7);
                  setProof(null);
                }}
                aria-label="CGPA threshold"
              />
              <p className={cn("mt-3 text-sm", meets ? "text-success" : "text-destructive")}>
                {meets
                  ? "Your CGPA clears this. The proof will check out."
                  : "Your CGPA is below this. The proof will be generated, but an employer will see it fail."}
              </p>
            </div>

            <div>
              <p className="kicker">Also show the employer</p>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {DISCLOSABLE.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-4 py-3">
                    <label htmlFor={`d-${d.key}`} className="text-sm">
                      {d.label}
                    </label>
                    <Switch id={`d-${d.key}`} checked={disclose.has(d.key)} onCheckedChange={(on) => toggle(d.key, on)} />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Preview of what the employer sees */}
          <div className="col-span-12 min-w-0 md:col-span-5">
            <p className="kicker">What the employer will see</p>
            <div className="mt-3 border border-foreground/80 bg-background p-6">
              <p className="font-display text-xl">CGPA ≥ {threshold.toFixed(1)}</p>
              <p className="mt-1 text-sm text-muted-foreground">true or false, nothing more</p>
              <dl className="mt-6 space-y-4">
                {DISCLOSABLE.map((d) => (
                  <div key={d.key} className="min-w-0">
                    <dt className="kicker">{d.label}</dt>
                    <dd className="mt-1 text-sm">
                      {disclose.has(d.key) ? (
                        String(s[d.key] ?? "—")
                      ) : (
                        <span className="redacted block h-5 w-full max-w-[12rem]" aria-label="Hidden" />
                      )}
                    </dd>
                  </div>
                ))}
                {["Exact CGPA", "Marksheet", "Roll number", "Aadhaar ref."].map((l) => (
                  <div key={l}>
                    <dt className="kicker">{l}</dt>
                    <dd className="mt-1">
                      <span className="redacted block h-5 w-full max-w-[12rem]" aria-label="Hidden" />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        <Notice title="Simulated proof">
          This prototype uses hash commitments to demonstrate the flow. It isn't a production zero-knowledge circuit.
        </Notice>

        {!proof ? (
          <Button size="lg" onClick={generate} disabled={busy} className="w-full">
            {busy ? "Building proof…" : "Build the proof"}
          </Button>
        ) : (
          <section className="space-y-6 border-t-2 border-foreground pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h3 className="text-2xl">Proof ready</h3>
              <p className="font-mono text-[11px] text-muted-foreground">nonce {proof.nonce}</p>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Commitment"><span className="datum">{shortHash(proof.rangeProofs[0]?.commitment ?? "", 14)}</span></Field>
              <Field label="Challenge"><span className="datum">{proof.rangeProofs[0]?.challenge}</span></Field>
              <Field label="Claim root"><span className="datum">{shortHash(proof.merkleProofRoot, 14)}</span></Field>
            </dl>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <Button
                variant="success"
                onClick={() => {
                  sendToVerifier(proof);
                  onClose();
                  navigate({ to: "/verify" });
                }}
              >
                Send to employer <ArrowRight />
              </Button>
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check /> : <Copy />} {copied ? "Link copied" : "Copy share link"}
              </Button>
              <Button variant="ghost" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
                <QrCode /> {showQr ? "Hide QR" : "QR code"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => downloadJson(`proof-${credential.digiLockerMetadata.docId.replace(/\//g, "-")}.json`, proof)}
              >
                <Download /> JSON
              </Button>
            </div>

            {showQr && (
              <div className="flex flex-wrap items-start gap-6">
                <div className="border border-border bg-card p-4 text-foreground">
                  <QRCodeSVG value={shareLink} size={176} bgColor="transparent" fgColor="currentColor" level="L" />
                </div>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Scan to open this proof on the employer page. The link carries the proof itself, not your record.
                </p>
              </div>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
