import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileText, Upload, X } from "lucide-react";
import { useState } from "react";

import { Container, Notice, PageIntro, SectionLabel, Stamp } from "@/components/site/primitives";
import { buttonVariants } from "@/components/ui/button";
import { SAMPLE_SPECIMENS, type SpecimenDocument } from "@/lib/vericred/demo-data";
import { analyseScan } from "@/lib/vericred/forensics.functions";
import { useVeriCred } from "@/lib/vericred/store";
import type { DocumentForgeryAnomaly, ForgeryForensicReport } from "@/lib/vericred/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forensics")({
  head: () => ({
    meta: [
      { title: "Forgery lab — VeriCred" },
      { name: "description", content: "Upload a scanned degree or marksheet for a preliminary AI review of fonts, seals and signatures." },
      { property: "og:title", content: "Forgery lab — VeriCred" },
      { property: "og:description", content: "A second pair of eyes on every scanned certificate." },
    ],
  }),
  component: ForensicsPage,
});

const VERDICT = {
  VERIFIED_AUTHENTIC: { label: "No concerns found", tone: "success" as const },
  SUSPICIOUS: { label: "Needs a closer look", tone: "warning" as const },
  HIGH_RISK_FORGERY: { label: "Likely altered", tone: "destructive" as const },
};

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

interface Upload {
  name: string;
  type: string;
  dataUrl: string;
}

function ForensicsPage() {
  const analyse = useServerFn(analyseScan);
  const { recordScan } = useVeriCred();
  const [specimen, setSpecimen] = useState<SpecimenDocument | null>(SAMPLE_SPECIMENS[1] ?? null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [report, setReport] = useState<ForgeryForensicReport | null>(SAMPLE_SPECIMENS[1]?.precomputedForensics ?? null);
  const [active, setActive] = useState<string | null>(SAMPLE_SPECIMENS[1]?.precomputedForensics.anomalies[0]?.id ?? null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickSpecimen = (s: SpecimenDocument) => {
    setSpecimen(s);
    setUpload(null);
    setError(null);
    setReport(s.precomputedForensics);
    setActive(s.precomputedForensics.anomalies[0]?.id ?? null);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!ACCEPT.includes(file.type)) return setError("Use a PNG, JPG, WebP or PDF file.");
    if (file.size > 5 * 1024 * 1024) return setError("That file is over 5 MB. Try a smaller scan.");
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result ?? "");
      setUpload({ name: file.name, type: file.type, dataUrl });
      setSpecimen(null);
      setReport(null);
      setActive(null);
      setScanning(true);
      try {
        const res = await analyse({ data: { fileName: file.name, mimeType: file.type as (typeof ACCEPT)[number], dataUrl } });
        if (res.ok) {
          setReport(res.report);
          setActive(res.report.anomalies[0]?.id ?? null);
          recordScan({ fileName: file.name, verdict: res.report.verdict, source: "ai" });
        } else setError(res.error);
      } catch {
        setError("The review didn't complete. Check your connection and try again.");
      } finally {
        setScanning(false);
      }
    };
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  const verdict = report ? VERDICT[report.verdict] : null;

  return (
    <>
      <PageIntro
        number="04"
        kicker="Forgery lab"
        title={
          <>
            A second pair of eyes <span className="italic">on every scan.</span>
          </>
        }
        dek="Upload a degree or marksheet and Gemini looks for edited grades, pasted seals and stamped signatures. It flags things for a person to check; it doesn't decide."
        aside={
          <label className={cn(buttonVariants({ size: "lg" }), "cursor-pointer")}>
            <Upload /> Upload a scan
            <input type="file" accept={ACCEPT.join(",")} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        }
      />

      <Container>
        <SectionLabel>Or open a sample</SectionLabel>
        <div className="mt-4 grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
          {SAMPLE_SPECIMENS.map((s) => {
            const on = specimen?.id === s.id && !upload;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSpecimen(s)}
                aria-pressed={on}
                className={cn("bg-background p-6 text-left transition-colors hover:bg-secondary", on && "bg-secondary")}
              >
                <span className="kicker">{s.category}</span>
                <span className="mt-2 block font-display text-xl leading-snug">{s.name}</span>
                <span className="mt-2 block text-sm text-muted-foreground">{s.subtitle}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-16 grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-12">
          {/* Document */}
          <section className="col-span-12 min-w-0 lg:col-span-7">
            <div className="flex items-baseline justify-between gap-4">
              <SectionLabel>The document</SectionLabel>
              <p className="kicker truncate">{upload?.name ?? report?.fileName ?? ""}</p>
            </div>
            <div className="relative mt-4 border border-border bg-secondary p-4 sm:p-8">
              <div className="relative mx-auto w-full max-w-[560px]">
                {upload && upload.type.startsWith("image/") ? (
                  <img src={upload.dataUrl} alt={`Uploaded scan: ${upload.name}`} className="block w-full bg-card" />
                ) : upload ? (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 bg-card p-8 text-center">
                    <FileText className="size-8 text-muted-foreground" />
                    <p className="font-display text-xl">{upload.name}</p>
                    <p className="text-sm text-muted-foreground">PDF preview isn't shown here, but the file was sent for review.</p>
                  </div>
                ) : (
                  <SpecimenCertificate report={report} specimen={specimen} />
                )}

                {report &&
                  (upload ? upload.type.startsWith("image/") : true) &&
                  report.anomalies.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      aria-label={a.title}
                      onClick={() => setActive(a.id)}
                      style={{ left: `${a.location.x}%`, top: `${a.location.y}%`, width: `${a.location.width}%`, height: `${a.location.height}%` }}
                      className={cn(
                        "absolute border-2 transition-colors",
                        active === a.id ? "border-destructive bg-destructive/15" : "border-dashed border-destructive/70 hover:bg-destructive/10",
                      )}
                    />
                  ))}
              </div>

              {scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90">
                  <span className="size-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
                  <p className="kicker">Reviewing the scan…</p>
                </div>
              )}
            </div>

            {report && report.anomalies.length > 0 && (
              <ol className="mt-8 border-t border-foreground">
                {report.anomalies.map((a, i) => (
                  <Finding key={a.id} a={a} n={i + 1} active={active === a.id} onSelect={() => setActive(a.id)} />
                ))}
              </ol>
            )}
          </section>

          {/* Assessment */}
          <section className="col-span-12 min-w-0 lg:col-span-5" aria-live="polite">
            <SectionLabel>Preliminary assessment</SectionLabel>
            {error && (
              <p role="alert" className="mt-4 border-l-2 border-destructive pl-4 text-sm text-destructive">
                {error}
              </p>
            )}
            {!report && !scanning && !error && <p className="mt-4 text-muted-foreground">Upload a scan or open a sample.</p>}
            {report && verdict && (
              <div className="mt-6 space-y-10">
                <div className="flex flex-wrap items-center gap-6">
                  <Stamp tone={verdict.tone}>{verdict.label}</Stamp>
                  <p className="text-sm text-muted-foreground">
                    Confidence genuine <span className="font-display text-2xl text-foreground">{report.confidenceScore}%</span>
                  </p>
                </div>
                <p className="leading-relaxed">{report.summary}</p>

                <dl className="space-y-5">
                  {(
                    [
                      ["Seal and watermark", report.sealIntegrityScore],
                      ["Fonts and spacing", report.fontConsistencyScore],
                      ["Signatures", report.signatureIntegrityScore],
                    ] as const
                  ).map(([label, v]) => (
                    <div key={label}>
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-sm">{label}</dt>
                        <dd className="font-mono text-xs tabular-nums">{v}/100</dd>
                      </div>
                      <div className="mt-2 h-1 bg-border">
                        <div className={cn("h-full", v >= 70 ? "bg-foreground" : "bg-destructive")} style={{ width: `${v}%` }} />
                      </div>
                    </div>
                  ))}
                </dl>

                <dl className="grid grid-cols-1 gap-4 border-t border-border pt-6 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="kicker">Name read</dt>
                    <dd className="mt-1 text-sm">{report.candidateNameDetected}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="kicker">Grade read</dt>
                    <dd className="mt-1 text-sm">{report.cgpaOrGradeDetected}</dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="kicker">Institution read</dt>
                    <dd className="mt-1 text-sm">{report.institutionDetected}</dd>
                  </div>
                </dl>

                <ul className="space-y-3 border-t border-border pt-6 text-sm">
                  {(
                    [
                      ["Seal intact", report.forensicChecklist.sealWatermarkIntact],
                      ["Consistent type", report.forensicChecklist.fontKerningConsistent],
                      ["QR code plausible", report.forensicChecklist.qrDigiLockerChecksumMatch],
                    ] as const
                  ).map(([label, ok]) => (
                    <li key={label} className="flex items-center justify-between gap-4">
                      <span>{label}</span>
                      {ok ? <Check className="size-4 text-success" aria-label="Yes" /> : <X className="size-4 text-destructive" aria-label="No" />}
                    </li>
                  ))}
                </ul>

                <div className="border-l-2 border-foreground pl-4">
                  <p className="kicker">Next step</p>
                  <p className="mt-2 text-sm leading-relaxed">{report.recommendation}</p>
                </div>
              </div>
            )}
            <Notice title="Preliminary only" className="mt-10">
              An AI review can miss edits and can flag genuine documents. Confirm with the issuer or a signed
              credential before acting on it.
            </Notice>
          </section>
        </div>
      </Container>
    </>
  );
}

function Finding({ a, n, active, onSelect }: { a: DocumentForgeryAnomaly; n: number; active: boolean; onSelect: () => void }) {
  return (
    <li className="border-b border-border">
      <button type="button" onClick={onSelect} className={cn("grid w-full grid-cols-12 gap-4 py-4 text-left", active && "bg-destructive-soft/60")}>
        <span className="col-span-1 pl-2 font-mono text-xs text-destructive">{String(n).padStart(2, "0")}</span>
        <span className="col-span-11 min-w-0 sm:col-span-8">
          <span className="block text-sm font-medium">{a.title}</span>
          {active && <span className="mt-1 block text-sm text-muted-foreground">{a.description}</span>}
        </span>
        <span className="kicker col-span-11 col-start-2 sm:col-span-3 sm:col-start-auto sm:text-right">{a.severity.toLowerCase()}</span>
      </button>
    </li>
  );
}

function SpecimenCertificate({ report, specimen }: { report: ForgeryForensicReport | null; specimen: SpecimenDocument | null }) {
  return (
    <div className="aspect-[4/3] bg-card p-3 font-display text-foreground select-none">
      <div className="flex h-full flex-col justify-between border-4 border-double border-accent-ink/50 px-6 py-5">
        <div className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-accent-ink text-[10px] tracking-widest text-accent-ink">
            ★
          </div>
          <p className="mt-2 text-sm uppercase tracking-[0.18em] sm:text-base">{report?.institutionDetected ?? specimen?.institution}</p>
          <p className="text-[10px] italic text-muted-foreground">Established by Act of Parliament</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] italic text-muted-foreground">This is to certify that</p>
          <p className="mt-1 text-xl sm:text-2xl">{report?.candidateNameDetected ?? "—"}</p>
          <p className="mt-1 text-[11px] italic text-muted-foreground">has been admitted to the degree of</p>
          <p className="mt-1 text-sm uppercase tracking-[0.14em]">Bachelor of Technology</p>
          <p className="mt-2 font-mono text-[10px]">CGPA {report?.cgpaOrGradeDetected ?? "—"}</p>
        </div>
        <div className="flex items-end justify-between text-[10px]">
          <div className="text-center">
            <p className="italic">R. Sengupta</p>
            <p className="border-t border-foreground/40 pt-1 font-sans">Registrar</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-accent-ink font-sans text-[8px] tracking-widest text-accent-ink">
            SEAL
          </div>
          <div className="text-center">
            <p className="italic">V. K. Murthy</p>
            <p className="border-t border-foreground/40 pt-1 font-sans">Vice-Chancellor</p>
          </div>
        </div>
      </div>
    </div>
  );
}
