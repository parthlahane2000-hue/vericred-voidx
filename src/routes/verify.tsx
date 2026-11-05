import { createFileRoute } from "@tanstack/react-router";
import { Check, Download, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Container, Field, Notice, PageIntro, SectionLabel, Stamp, StatusMark } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { downloadJson, formatDateTime, shortHash } from "@/lib/vericred/format";
import { useVeriCred } from "@/lib/vericred/store";
import type { W3CVerifiableCredential, ZKSelectiveDisclosure } from "@/lib/vericred/types";
import {
  STATUS_LABEL,
  parsePresentation,
  verifyByReference,
  verifyPresentation,
  type VerificationChecks,
  type VerificationOutcome,
  type VerificationStatus,
} from "@/lib/vericred/verify";
import { createSelectiveDisclosurePresentation } from "@/lib/vericred/zkp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/verify")({
  validateSearch: (search: Record<string, unknown>): { p?: string } =>
    typeof search["p"] === "string" && search["p"].length > 0 ? { p: search["p"] } : {},
  head: () => ({
    meta: [
      { title: "Employer verification — VeriCred" },
      { name: "description", content: "Check a candidate's proof or credential ID: signature, revocation, expiry and the CGPA claim, in about a second." },
      { property: "og:title", content: "Employer verification — VeriCred" },
      { property: "og:description", content: "Ask one question about a degree and get a straight answer." },
    ],
  }),
  component: VerifyPage,
});

const IDS = {
  iitd: "urn:uuid:7c9e6679-7425-40de-944b-e07fc1f90ae7",
  iisc: "urn:uuid:3e4a9012-5813-40f4-a8c9-943b1234abcd",
  mumbai: "urn:uuid:fa3b21c4-1189-42b8-a76f-c91834720921",
};

const STEPS: Array<{ key: keyof VerificationChecks; title: string; body: string }> = [
  { key: "issuerTrusted", title: "Issuer signature", body: "Is the signer a university in the trusted registry?" },
  { key: "notRevoked", title: "Revocation status", body: "Has the university withdrawn this record?" },
  { key: "notExpired", title: "Expiry", body: "Is the credential still within its validity period?" },
  { key: "proofSatisfied", title: "Range proof", body: "Does the CGPA claim hold, without seeing the number?" },
  { key: "claimIntegrity", title: "Claim integrity", body: "Do the shown fields tie back to the signed record?" },
];

const TONE: Record<VerificationStatus, "success" | "destructive" | "warning"> = {
  VERIFIED: "success",
  REVOKED: "destructive",
  INVALID_SIGNATURE: "destructive",
  EXPIRED: "warning",
  FAILED: "destructive",
};

type Mode = "paste" | "file" | "lookup";

interface Result {
  outcome: VerificationOutcome;
  presentation?: ZKSelectiveDisclosure;
  credential?: W3CVerifiableCredential;
  kind: "proof" | "lookup";
}

function VerifyPage() {
  const { p: shared } = Route.useSearch();
  const { credentials, revokedIds, incoming, clearIncoming, recordCheck, checks } = useVeriCred();
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const timers = useRef<number[]>([]);

  const ctx = { credentials, revokedIds };

  const animate = useCallback((done: () => void) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setRunning(true);
    setResult(null);
    setStep(0);
    STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStep(i + 1), 180 * (i + 1)));
    });
    timers.current.push(
      window.setTimeout(() => {
        done();
        setRunning(false);
      }, 180 * (STEPS.length + 1)),
    );
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const runProof = useCallback(
    (p: ZKSelectiveDisclosure) => {
      setError(null);
      const outcome = verifyPresentation(p, ctx);
      animate(() => {
        setResult({ outcome, presentation: p, kind: "proof" });
        const threshold = p.rangeProofs[0]?.threshold;
        const summary = threshold !== undefined ? `CGPA ≥ ${threshold}` : "Selective disclosure";
        recordCheck(
          {
            credentialId: p.credentialId,
            issuerName: p.issuerName,
            degreeName: p.disclosedAttributes.degreeName,
            status: outcome.status,
            summary,
          },
          outcome.status === "VERIFIED"
            ? {
                id: `vh-${Date.now()}`,
                verifiedAt: new Date().toISOString(),
                verifierEntity: "Employer check (this browser)",
                verifierType: "EMPLOYER",
                verificationPurpose: "Hiring check",
                status: "PASSED",
                proofType: "ZK_SELECTIVE_DISCLOSURE",
                disclosedSummary: `Proven: ${summary} (no transcript revealed)`,
              }
            : undefined,
        );
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [credentials, revokedIds, animate, recordCheck],
  );

  // Proof handed over from the wallet
  useEffect(() => {
    if (!incoming) return;
    setMode("paste");
    setText(JSON.stringify(incoming, null, 2));
    runProof(incoming);
    clearIncoming();
  }, [incoming, runProof, clearIncoming]);

  // Proof arriving through a share link or QR code
  const sharedHandled = useRef(false);
  useEffect(() => {
    if (!shared || sharedHandled.current) return;
    sharedHandled.current = true;
    const p = parsePresentation(shared);
    if (p) {
      setText(JSON.stringify(p, null, 2));
      runProof(p);
    } else setError("That share link is damaged. Ask the candidate to send it again.");
  }, [shared, runProof]);

  const onVerifyText = () => {
    const p = parsePresentation(text);
    if (!p) {
      setResult(null);
      setError("That isn't a readable proof. Paste the JSON or share token exactly as the candidate sent it.");
      return;
    }
    runProof(p);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 200_000) {
      setError("That file is too large to be a proof (limit 200 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      const p = parsePresentation(content);
      if (p) runProof(p);
      else setError(`${file.name} doesn't contain a proof.`);
    };
    reader.readAsText(file);
  };

  const onLookup = () => {
    setError(null);
    if (!reference.trim()) {
      setError("Enter a credential ID or document ID.");
      return;
    }
    const { credential, outcome } = verifyByReference(reference, ctx);
    if (!credential || !outcome) {
      setResult(null);
      setError("No credential with that ID is in the registry.");
      return;
    }
    animate(() => {
      setResult({ outcome, credential, kind: "lookup" });
      recordCheck(
        {
          credentialId: credential.id,
          issuerName: credential.issuer.name,
          degreeName: credential.credentialSubject.degreeName,
          status: outcome.status,
          summary: "Status lookup",
        },
        outcome.status === "VERIFIED"
          ? {
              id: `vh-${Date.now()}`,
              verifiedAt: new Date().toISOString(),
              verifierEntity: "Employer lookup (this browser)",
              verifierType: "EMPLOYER",
              verificationPurpose: "Status lookup by ID",
              status: "PASSED",
              proofType: "DIGILOCKER_DIRECT",
              disclosedSummary: "Confirmed issuer and status only",
            }
          : undefined,
      );
    });
  };

  const scenarios = [
    {
      letter: "A",
      title: "B.Tech, IIT Delhi",
      claim: "Proves CGPA ≥ 7.5",
      expect: "Should pass",
      make: () => {
        const c = credentials.find((x) => x.id === IDS.iitd);
        return c ? createSelectiveDisclosurePresentation(c, ["degreeName", "institutionName", "graduationYear"], [{ attribute: "cgpa", threshold: 7.5 }]) : null;
      },
    },
    {
      letter: "B",
      title: "M.Tech, IISc Bangalore",
      claim: "Proves CGPA ≥ 9.0",
      expect: "Should pass",
      make: () => {
        const c = credentials.find((x) => x.id === IDS.iisc);
        return c ? createSelectiveDisclosurePresentation(c, ["degreeName", "institutionName", "graduationYear", "honours"], [{ attribute: "cgpa", threshold: 9 }]) : null;
      },
    },
    {
      letter: "C",
      title: "B.Com, University of Mumbai",
      claim: "Valid proof, revoked record",
      expect: "Should be revoked",
      make: () => {
        const c = credentials.find((x) => x.id === IDS.mumbai);
        return c ? createSelectiveDisclosurePresentation(c, ["degreeName", "institutionName"], [{ attribute: "cgpa", threshold: 6 }]) : null;
      },
    },
    {
      letter: "D",
      title: "Ph.D., 'Fabricated University'",
      claim: "Unknown issuer, broken proof",
      expect: "Should fail",
      make: (): ZKSelectiveDisclosure => ({
        credentialId: "urn:uuid:fake-degree-999",
        issuerDid: "did:web:unknown-unverified.com",
        issuerName: "Fabricated University",
        issuanceDate: "2024-01-01",
        digiLockerDocType: "DEGREE",
        disclosedAttributes: { degreeName: "Ph.D. in Computer Science", institutionName: "Fabricated University" },
        hiddenAttributes: ["cgpa"],
        rangeProofs: [
          {
            attribute: "cgpa",
            operator: ">=",
            threshold: 9.8,
            commitment: "0".repeat(64),
            blindingFactorHash: "bad_blinding_hash",
            challenge: "tampered_challenge",
            response: "INVALID_DELTA",
            isSatisfied: false,
          },
        ],
        merkleProofRoot: "invalid_merkle_root",
        proofSignature: "INVALID_FORGED_SIGNATURE",
        timestamp: new Date().toISOString(),
        nonce: "0xfake",
      }),
    },
  ];

  const downloadReport = () => {
    if (!result) return;
    const p = result.presentation;
    downloadJson(`verification-report-${Date.now()}.json`, {
      title: "VeriCred verification report",
      generatedAt: new Date().toISOString(),
      outcome: STATUS_LABEL[result.outcome.status],
      reason: result.outcome.reason,
      checks: result.outcome.checks,
      issuer: p?.issuerName ?? result.credential?.issuer.name,
      credentialId: p?.credentialId ?? result.credential?.id,
      disclosed: p?.disclosedAttributes ?? { degreeName: result.credential?.credentialSubject.degreeName },
      predicate: p?.rangeProofs[0] ? `CGPA >= ${p.rangeProofs[0].threshold}` : null,
      note: "Prototype: proofs are a hash-based simulation, not production cryptography.",
    });
  };

  return (
    <>
      <PageIntro
        number="02"
        kicker="Employer verification"
        title={
          <>
            Ask one question. <span className="italic">Get a straight answer.</span>
          </>
        }
        dek="Paste the proof a candidate sent, open their share link, or look up a credential ID. You'll see whether it holds, and only what they chose to show."
      />

      <Container>
        {/* Scenarios */}
        <section>
          <SectionLabel>Try a candidate</SectionLabel>
          <ol className="mt-4 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {scenarios.map((s) => (
              <li key={s.letter} className="bg-background">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => {
                    const p = s.make();
                    if (!p) return;
                    setMode("paste");
                    setText(JSON.stringify(p, null, 2));
                    runProof(p);
                  }}
                  className="flex h-full w-full flex-col items-start gap-2 p-6 text-left transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  <span className="font-display text-4xl italic text-accent-ink">{s.letter}</span>
                  <span className="text-sm font-medium">{s.title}</span>
                  <span className="text-sm text-muted-foreground">{s.claim}</span>
                  <span className="kicker mt-auto pt-2">{s.expect}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-16 grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-12">
          {/* Intake */}
          <section className="col-span-12 min-w-0 lg:col-span-6">
            <div role="tablist" aria-label="How to check" className="flex gap-6 border-b border-border">
              {(
                [
                  ["paste", "Paste a proof"],
                  ["file", "Upload a file"],
                  ["lookup", "Look up an ID"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
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

            <div className="mt-6 space-y-4">
              {mode === "paste" && (
                <>
                  <label htmlFor="proof" className="kicker block">
                    Proof JSON or share token
                  </label>
                  <Textarea
                    id="proof"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={14}
                    placeholder="Paste what the candidate sent you"
                    className="rounded-sm bg-card font-mono text-xs leading-5"
                  />
                  <div className="flex flex-wrap items-center gap-4">
                    <Button onClick={onVerifyText} disabled={running || !text.trim()}>
                      {running ? "Checking…" : "Check this proof"}
                    </Button>
                    <Button variant="ghost" onClick={() => setText("")} disabled={!text}>
                      Clear
                    </Button>
                  </div>
                </>
              )}

              {mode === "file" && (
                <label className="flex cursor-pointer flex-col items-start gap-4 border border-dashed border-foreground/40 bg-card p-10 transition-colors hover:bg-secondary">
                  <Upload className="size-5" />
                  <span className="font-display text-2xl">Choose a proof file</span>
                  <span className="text-sm text-muted-foreground">A .json file downloaded from a VeriCred wallet. Up to 200 KB.</span>
                  <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
              )}

              {mode === "lookup" && (
                <>
                  <label htmlFor="ref" className="kicker block">
                    Credential ID or document ID
                  </label>
                  <Input
                    id="ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. IITD/2024/BTECH/CS8842"
                    className="h-12 rounded-sm bg-card font-mono"
                    onKeyDown={(e) => e.key === "Enter" && onLookup()}
                  />
                  <p className="text-sm text-muted-foreground">
                    A lookup confirms the issuer and status only. Grades need a proof from the candidate.
                  </p>
                  <Button onClick={onLookup} disabled={running}>
                    {running ? "Checking…" : "Look it up"}
                  </Button>
                </>
              )}

              {error && (
                <p role="alert" className="border-l-2 border-destructive pl-4 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </section>

          {/* Pipeline + verdict */}
          <section className="col-span-12 min-w-0 lg:col-span-6" aria-live="polite">
            <SectionLabel>The checks</SectionLabel>
            <ol className="mt-4 border-t border-foreground">
              {STEPS.map((s, i) => {
                const reached = step > i;
                const passed = result?.outcome.checks[s.key];
                const skipped = result?.kind === "lookup" && s.key === "proofSatisfied";
                return (
                  <li key={s.key} className={cn("grid grid-cols-12 gap-4 border-b border-border py-4 transition-opacity", !reached && !result && "opacity-40")}>
                    <span className="col-span-1 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <div className="col-span-8 min-w-0">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">{s.body}</p>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      {result ? (
                        skipped ? (
                          <StatusMark tone="neutral">n/a</StatusMark>
                        ) : passed ? (
                          <span className="inline-flex items-center gap-1 text-sm text-success"><Check className="size-4" /> Pass</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-destructive"><X className="size-4" /> Fail</span>
                        )
                      ) : reached ? (
                        <span className="text-sm text-muted-foreground">…</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            {result && (
              <div className="mt-10 space-y-8">
                <div className="flex flex-wrap items-center gap-6">
                  <Stamp tone={TONE[result.outcome.status]}>{STATUS_LABEL[result.outcome.status]}</Stamp>
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">{result.outcome.reason}</p>
                </div>

                {result.outcome.status === "VERIFIED" && (
                  <div>
                    <p className="kicker">What the candidate chose to show</p>
                    <dl className="mt-4 grid grid-cols-1 gap-x-4 md:gap-x-8 gap-y-5 sm:grid-cols-2">
                      {result.presentation ? (
                        <>
                          <Field label="Claim">
                            <span className="font-display text-xl">CGPA ≥ {result.presentation.rangeProofs[0]?.threshold ?? "—"}</span>
                          </Field>
                          <Field label="Issuer">{result.presentation.issuerName}</Field>
                          {result.presentation.disclosedAttributes.degreeName && (
                            <Field label="Degree">{result.presentation.disclosedAttributes.degreeName}</Field>
                          )}
                          {result.presentation.disclosedAttributes.institutionName && (
                            <Field label="Institution">{result.presentation.disclosedAttributes.institutionName}</Field>
                          )}
                          {result.presentation.disclosedAttributes.graduationYear && (
                            <Field label="Graduated">{result.presentation.disclosedAttributes.graduationYear}</Field>
                          )}
                          {result.presentation.disclosedAttributes.honours && (
                            <Field label="Honours">{result.presentation.disclosedAttributes.honours}</Field>
                          )}
                        </>
                      ) : result.credential ? (
                        <>
                          <Field label="Issuer">{result.credential.issuer.name}</Field>
                          <Field label="Degree">{result.credential.credentialSubject.degreeName}</Field>
                          <Field label="Document ID"><span className="datum">{result.credential.digiLockerMetadata.docId}</span></Field>
                        </>
                      ) : null}
                    </dl>
                    <p className="mt-6 text-sm text-muted-foreground">
                      Hidden from you:{" "}
                      {result.presentation
                        ? `${result.presentation.hiddenAttributes.length} fields, including the exact CGPA and marksheet.`
                        : "grades and personal details."}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
                  <Button variant="outline" onClick={downloadReport}>
                    <Download /> Download report
                  </Button>
                  {result.presentation && (
                    <p className="datum text-muted-foreground">sig {shortHash(result.presentation.proofSignature, 10)}</p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        <Notice title="About these checks" className="mt-16 max-w-3xl">
          Signature and proof checks here are a transparent simulation against demo records. No DigiLocker or
          blockchain service is contacted.
        </Notice>

        {/* History */}
        <section className="mt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-3xl">Checks you've run</h2>
            <p className="kicker">{checks.length} in this browser</p>
          </div>
          {checks.length === 0 ? (
            <p className="mt-6 text-muted-foreground">Nothing yet. Try candidate A above.</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-foreground text-left">
                    <th className="kicker py-3 pr-4 font-normal">When</th>
                    <th className="kicker py-3 pr-4 font-normal">Issuer</th>
                    <th className="kicker py-3 pr-4 font-normal">Asked</th>
                    <th className="kicker py-3 font-normal">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.slice(0, 12).map((c) => (
                    <tr key={c.id} className="border-b border-border">
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{formatDateTime(c.at)}</td>
                      <td className="py-3 pr-4">{c.issuerName}</td>
                      <td className="py-3 pr-4">{c.summary}</td>
                      <td className="py-3">
                        <StatusMark tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusMark>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Container>
    </>
  );
}
