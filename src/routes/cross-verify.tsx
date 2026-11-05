import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, Paperclip, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Container, Notice, PageIntro, SectionLabel, Stamp } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVeriCred } from "@/lib/vericred/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cross-verify")({
  head: () => ({
    meta: [
      { title: "Cross-verification — VeriCred" },
      { name: "description", content: "Compare what a certificate says with the university's record, its document URI and the revocation list." },
      { property: "og:title", content: "Cross-verification — VeriCred" },
      { property: "og:description", content: "Does the paper match the record? Five checks, side by side." },
    ],
  }),
  component: CrossVerifyPage,
});

type StepState = "pass" | "fail" | "skip";
type Decision = "VERIFIED" | "DISCREPANCY" | "REJECTED";

interface Report {
  fileName: string;
  claimed: { name: string; roll: string; degree: string; institution: string; cgpa: number };
  official: { name: string; degree: string; institution: string; cgpa: number } | null;
  decision: Decision;
  summary: string;
  steps: Array<{ title: string; state: StepState; evidence: string }>;
}

const IDS = {
  iitd: "urn:uuid:7c9e6679-7425-40de-944b-e07fc1f90ae7",
  mumbai: "urn:uuid:fa3b21c4-1189-42b8-a76f-c91834720921",
};

const DECISION = {
  VERIFIED: { label: "Matches the record", tone: "success" as const },
  DISCREPANCY: { label: "Discrepancy", tone: "warning" as const },
  REJECTED: { label: "Rejected", tone: "destructive" as const },
};

function CrossVerifyPage() {
  const { credentials, registry } = useVeriCred();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [form, setForm] = useState({ name: "Aarav Sharma", roll: "2020CS1044", degree: "Bachelor of Technology (B.Tech)", cgpa: "8.92" });
  const [formError, setFormError] = useState<string | null>(null);

  const isRevoked = (id: string) => registry.find((r) => r.credentialId === id)?.isRevoked ?? false;

  const run = (build: () => Report) => {
    setBusy(true);
    setReport(null);
    setTimeout(() => {
      setReport(build());
      setBusy(false);
    }, 500);
  };

  const scenarios = [
    {
      id: "authentic",
      title: "Genuine IIT Delhi degree",
      note: "CGPA 8.92 on paper and in the ledger",
      build: (): Report => {
        const c = credentials.find((x) => x.id === IDS.iitd)!;
        const revoked = isRevoked(c.id);
        const s = c.credentialSubject;
        return {
          fileName: "IITD_BTech_AaravSharma.pdf",
          claimed: { name: s.studentName, roll: s.studentRollNo, degree: s.degreeName, institution: c.issuer.name, cgpa: s.cgpa },
          official: { name: s.studentName, degree: s.degreeName, institution: c.issuer.name, cgpa: s.cgpa },
          decision: revoked ? "REJECTED" : "VERIFIED",
          summary: revoked
            ? "The paper matches the ledger, but the university has since revoked this degree."
            : "Every field on the document matches IIT Delhi's signed record, and the degree is still active.",
          steps: [
            { title: "University record", state: "pass", evidence: `Roll ${s.studentRollNo} found in the registrar's ledger` },
            { title: "Document URI", state: "pass", evidence: c.digiLockerMetadata.digiLockerURI },
            { title: "CGPA", state: "pass", evidence: `Document 8.92 · ledger ${s.cgpa.toFixed(2)}` },
            { title: "Revocation list", state: revoked ? "fail" : "pass", evidence: revoked ? `Bit #${c.credentialStatus.statusListIndex} is set` : `Bit #${c.credentialStatus.statusListIndex} is clear` },
            { title: "Document review", state: "pass", evidence: "Specimen pre-reviewed: no edits to fonts, seal or signature" },
          ],
        };
      },
    },
    {
      id: "forged",
      title: "CGPA edited from 5.40 to 9.20",
      note: "University of Mumbai, B.Sc.",
      build: (): Report => ({
        fileName: "MU_BSc_Verma_scan.pdf",
        claimed: { name: "Rajesh K. Verma", roll: "MU-2021-BSc-7741", degree: "Bachelor of Science (Computer Applications)", institution: "University of Mumbai", cgpa: 9.2 },
        official: { name: "Rajesh K. Verma", degree: "Bachelor of Science (Computer Applications)", institution: "University of Mumbai", cgpa: 5.4 },
        decision: "REJECTED",
        summary: "The ledger records a CGPA of 5.40. The document shows 9.20, and its QR code points to a domain that isn't DigiLocker.",
        steps: [
          { title: "University record", state: "fail", evidence: "Roll exists; awarded CGPA is 5.40, not 9.20" },
          { title: "Document URI", state: "fail", evidence: "QR resolves to an external, unregistered domain" },
          { title: "CGPA", state: "fail", evidence: "Document 9.20 · ledger 5.40 (+3.80)" },
          { title: "Revocation list", state: "fail", evidence: "Record is on an academic-integrity hold" },
          { title: "Document review", state: "fail", evidence: "Specimen pre-reviewed: '9.20' rendered at a different resolution" },
        ],
      }),
    },
    {
      id: "revoked",
      title: "Genuine print, revoked degree",
      note: "University of Mumbai, B.Com.",
      build: (): Report => {
        const c = credentials.find((x) => x.id === IDS.mumbai)!;
        const s = c.credentialSubject;
        const revoked = isRevoked(c.id);
        return {
          fileName: "MU_BCom_scan.pdf",
          claimed: { name: s.studentName, roll: s.studentRollNo, degree: s.degreeName, institution: c.issuer.name, cgpa: s.cgpa },
          official: { name: s.studentName, degree: s.degreeName, institution: c.issuer.name, cgpa: s.cgpa },
          decision: revoked ? "REJECTED" : "VERIFIED",
          summary: revoked
            ? "The certificate is real and matches the record, but the university revoked it after an audit."
            : "The certificate matches the record and the university has restored it.",
          steps: [
            { title: "University record", state: "pass", evidence: `Match for ${s.studentName} (${s.studentRollNo})` },
            { title: "Document URI", state: "pass", evidence: c.digiLockerMetadata.digiLockerURI },
            { title: "CGPA", state: "pass", evidence: `Document ${s.cgpa.toFixed(2)} · ledger ${s.cgpa.toFixed(2)}` },
            { title: "Revocation list", state: revoked ? "fail" : "pass", evidence: revoked ? "Revoked: duplicate examination roll number" : "Clear" },
            { title: "Document review", state: "pass", evidence: "Specimen pre-reviewed: the print itself is genuine" },
          ],
        };
      },
    },
  ];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cgpa = Number(form.cgpa);
    if (!form.name.trim() || !form.roll.trim() || !form.degree.trim()) return setFormError("Fill in name, roll number and degree.");
    if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) return setFormError("CGPA must be a number between 0 and 10.");
    setFormError(null);
    setActive(null);

    run(() => {
      const roll = form.roll.trim().toLowerCase();
      const name = form.name.trim().toLowerCase();
      const match =
        credentials.find((c) => c.credentialSubject.studentRollNo.toLowerCase() === roll) ??
        credentials.find((c) => c.credentialSubject.studentName.toLowerCase() === name);
      const revoked = match ? isRevoked(match.id) : false;
      const ledger = match?.credentialSubject.cgpa ?? null;
      const variance = ledger !== null ? Math.abs(cgpa - ledger) : null;
      const degreeOk = match ? match.credentialSubject.degreeName.toLowerCase() === form.degree.trim().toLowerCase() : false;
      const ok = !!match && variance !== null && variance < 0.01 && degreeOk && !revoked;

      return {
        fileName: fileName || "Entered by hand",
        claimed: { name: form.name.trim(), roll: form.roll.trim(), degree: form.degree.trim(), institution: match?.issuer.name ?? "—", cgpa },
        official: match
          ? { name: match.credentialSubject.studentName, degree: match.credentialSubject.degreeName, institution: match.issuer.name, cgpa: match.credentialSubject.cgpa }
          : null,
        decision: ok ? "VERIFIED" : revoked ? "REJECTED" : "DISCREPANCY",
        summary: ok
          ? "The details match the university's signed record."
          : revoked
            ? "A matching record exists, but it has been revoked."
            : !match
              ? "No record with that roll number or name is in the registry."
              : "A record exists, but some details on the document don't match it.",
        steps: [
          { title: "University record", state: match ? "pass" : "fail", evidence: match ? `Found ${match.credentialSubject.studentRollNo}` : "No matching enrolment" },
          { title: "Document URI", state: match ? "pass" : "fail", evidence: match ? match.digiLockerMetadata.digiLockerURI : "Nothing to resolve" },
          {
            title: "CGPA",
            state: variance !== null && variance < 0.01 ? "pass" : "fail",
            evidence: ledger !== null ? `Document ${cgpa.toFixed(2)} · ledger ${ledger.toFixed(2)}` : "No ledger value to compare",
          },
          { title: "Revocation list", state: match ? (revoked ? "fail" : "pass") : "skip", evidence: match ? (revoked ? "Revoked" : "Clear") : "Not applicable" },
          { title: "Document review", state: "skip", evidence: "Run the scan through the Forgery lab for an AI review" },
        ],
      };
    });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageIntro
        number="03"
        kicker="Cross-verification"
        title={
          <>
            Does the paper <span className="italic">match the record?</span>
          </>
        }
        dek="Put what a certificate claims next to what the university actually recorded. Five checks, with the evidence for each."
      />

      <Container>
        <SectionLabel>Sample documents</SectionLabel>
        <ul className="mt-4 divide-y divide-border border-y border-foreground">
          {scenarios.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setActive(s.id);
                  run(s.build);
                }}
                className={cn("grid w-full grid-cols-12 items-baseline gap-4 py-5 text-left transition-colors hover:bg-secondary", active === s.id && "bg-secondary")}
                aria-pressed={active === s.id}
              >
                <span className="col-span-2 pl-2 font-mono text-xs text-accent-ink sm:col-span-1">{String(i + 1).padStart(2, "0")}</span>
                <span className="col-span-10 font-display text-2xl sm:col-span-6">{s.title}</span>
                <span className="col-span-10 col-start-3 text-sm text-muted-foreground sm:col-span-5 sm:col-start-auto">{s.note}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-16 grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-12">
          <form onSubmit={onSubmit} className="col-span-12 min-w-0 space-y-6 lg:col-span-4" noValidate>
            <div>
              <h2 className="text-3xl">Or check your own</h2>
              <p className="mt-2 text-sm text-muted-foreground">Type what the document says. Try changing the CGPA by a decimal.</p>
            </div>
            {(
              [
                ["name", "Name on document"],
                ["roll", "Roll / registration no."],
                ["degree", "Degree as printed"],
                ["cgpa", "CGPA as printed"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="space-y-2">
                <label htmlFor={`cv-${k}`} className="kicker block">{label}</label>
                <Input
                  id={`cv-${k}`}
                  value={form[k]}
                  onChange={set(k)}
                  inputMode={k === "cgpa" ? "decimal" : undefined}
                  className="h-11 rounded-sm bg-card"
                />
              </div>
            ))}
            <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
              <Paperclip className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{fileName || "Attach the scan (optional)"}</span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 10 * 1024 * 1024) return setFormError("Files up to 10 MB, please.");
                  setFileName(f?.name ?? "");
                }}
              />
            </label>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Comparing…" : "Compare with the record"}
            </Button>
          </form>

          <section className="col-span-12 min-w-0 lg:col-span-7 lg:col-start-6" aria-live="polite">
            {!report && !busy && (
              <div className="flex h-full min-h-64 items-center border border-dashed border-border p-10">
                <p className="max-w-sm font-display text-2xl text-muted-foreground">Pick a sample document or enter details to see the comparison here.</p>
              </div>
            )}
            {busy && <p className="kicker animate-pulse">Comparing against the ledger…</p>}
            {report && (
              <div className="space-y-10">
                <div className="flex flex-wrap items-center gap-6">
                  <Stamp tone={DECISION[report.decision].tone}>{DECISION[report.decision].label}</Stamp>
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">{report.summary}</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-foreground text-left">
                        <th className="kicker w-1/4 py-3 pr-4 font-normal">Field</th>
                        <th className="kicker py-3 pr-4 font-normal">Document says</th>
                        <th className="kicker py-3 font-normal">Registry says</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Name", report.claimed.name, report.official?.name],
                          ["Degree", report.claimed.degree, report.official?.degree],
                          ["CGPA", report.claimed.cgpa.toFixed(2), report.official?.cgpa.toFixed(2)],
                        ] as const
                      ).map(([label, a, b]) => {
                        const mismatch = !b || a.toLowerCase() !== b.toLowerCase();
                        return (
                          <tr key={label} className="border-b border-border align-top">
                            <td className="py-3 pr-4 text-muted-foreground">{label}</td>
                            <td className={cn("py-3 pr-4", mismatch && "text-destructive")}>{a}</td>
                            <td className="py-3">{b ?? <span className="text-muted-foreground">No record</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-3 datum text-muted-foreground">File: {report.fileName}</p>
                </div>

                <ol className="border-t border-foreground">
                  {report.steps.map((s, i) => (
                    <li key={s.title} className="grid grid-cols-12 gap-4 border-b border-border py-4">
                      <span className="col-span-1 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <div className="col-span-9 min-w-0">
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="datum mt-1 text-muted-foreground">{s.evidence}</p>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        {s.state === "pass" && <Check className="size-4 text-success" aria-label="Pass" />}
                        {s.state === "fail" && <X className="size-4 text-destructive" aria-label="Fail" />}
                        {s.state === "skip" && <Minus className="size-4 text-muted-foreground" aria-label="Not run" />}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        </div>

        <Notice title="Demo ledger" className="mt-16 max-w-3xl">
          The sample documents carry pre-written findings. Your own entries are compared against the demo registry in
          this browser; fields are typed in, not read from the scan.
        </Notice>
      </Container>
    </>
  );
}
