import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Container, Notice, PageIntro, SectionLabel, Stamp } from "@/components/site/primitives";
import { Slider } from "@/components/ui/slider";
import { generateRangeProof, verifyRangeProof } from "@/lib/vericred/zkp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/explainer")({
  head: () => ({
    meta: [
      { title: "How it works — VeriCred" },
      { name: "description", content: "Verifiable credentials, zero-knowledge proofs, selective disclosure, revocation, DigiLocker and AI document review, explained plainly." },
      { property: "og:title", content: "How it works — VeriCred" },
      { property: "og:description", content: "The technology behind VeriCred, without the jargon." },
    ],
  }),
  component: ExplainerPage,
});

const TOPICS = [
  {
    id: "vc",
    title: "Verifiable credentials",
    plain: "A degree written as data and signed by the university. Anyone can check the signature; nobody can quietly change a field without breaking it.",
    example: "Like a sealed envelope with the registrar's wax seal, except the seal can be checked by a computer in a millisecond.",
    visual: "json",
  },
  {
    id: "zkp",
    title: "Zero-knowledge proofs",
    plain: "A way to show a statement is true without showing why. The student proves “my CGPA is at least 7” and the employer learns exactly that, nothing more.",
    example: "Proving you're over 18 without showing your date of birth.",
    visual: null,
  },
  {
    id: "sd",
    title: "Selective disclosure",
    plain: "The student picks which fields leave the wallet. Degree and university, yes. Roll number and subject marks, no.",
    example: "Handing over a photocopy with everything but two lines blacked out — except the blacked-out copy is still provably genuine.",
    visual: "redact",
  },
  {
    id: "rev",
    title: "Revocation lists",
    plain: "Each credential owns one bit on a public list kept by its university. Bit off: valid. Bit on: revoked. Employers check the bit every time.",
    example: "A bank's list of cancelled cheques, checked before paying out.",
    visual: "bits",
  },
  {
    id: "dl",
    title: "DigiLocker compatibility",
    plain: "Records use DigiLocker-style document URIs and metadata so they could sit next to the documents students already keep there. This prototype doesn't connect to DigiLocker.",
    example: "in.gov.digilocker/iitd/DEGREE/IITD-2024-BTECH-CS8842",
    visual: null,
  },
  {
    id: "ai",
    title: "AI document review",
    plain: "Plenty of degrees still exist only on paper. For scans, a vision model looks for edited numbers, pasted seals and copied signatures, then hands its notes to a person.",
    example: "A careful clerk with a magnifying glass who says “look here” rather than “guilty”.",
    visual: null,
  },
] as const;

function ExplainerPage() {
  const [secret, setSecret] = useState(8.4);
  const [threshold, setThreshold] = useState(7);
  const proof = generateRangeProof("cgpa", secret, threshold, "explainer_salt");
  const ok = verifyRangeProof(proof);

  return (
    <>
      <PageIntro
        number="06"
        kicker="How it works"
        title={
          <>
            The technology, <span className="italic">without the jargon.</span>
          </>
        }
        dek="Six ideas make VeriCred work. Each one in a sentence or two, with an everyday comparison."
      />

      {/* Simulator */}
      <Container>
        <section>
          <SectionLabel>Try it: prove a CGPA without showing it</SectionLabel>
          <div className="mt-6 grid grid-cols-12 border border-foreground">
            <div className="col-span-12 border-b border-foreground p-6 sm:p-10 md:col-span-5 md:border-b-0 md:border-r">
              <p className="kicker">The student · private</p>
              <div className="mt-6 flex items-baseline justify-between gap-4">
                <p className="text-sm">Actual CGPA</p>
                <p className="font-display text-5xl tabular-nums">{secret.toFixed(1)}</p>
              </div>
              <Slider className="mt-6" min={4} max={10} step={0.1} value={[secret]} onValueChange={([v]) => setSecret(v ?? secret)} aria-label="Student CGPA" />
              <p className="mt-8 kicker">What gets sent instead</p>
              <p className="datum mt-2 text-muted-foreground">{proof.commitment}</p>
            </div>

            <div className="col-span-12 p-6 sm:p-10 md:col-span-7">
              <p className="kicker">The employer · public</p>
              <div className="mt-6 flex items-baseline justify-between gap-4">
                <p className="text-sm">Minimum CGPA asked for</p>
                <p className="font-display text-5xl tabular-nums">{threshold.toFixed(1)}</p>
              </div>
              <Slider className="mt-6" min={5} max={9.5} step={0.5} value={[threshold]} onValueChange={([v]) => setThreshold(v ?? threshold)} aria-label="Required CGPA" />
              <div className="mt-10 flex flex-wrap items-center gap-6">
                <Stamp key={String(ok)} tone={ok ? "success" : "destructive"}>
                  {ok ? "Requirement met" : "Not met"}
                </Stamp>
                <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                  The employer learns one word: <span className="text-foreground">{ok ? "yes" : "no"}</span>. The number{" "}
                  {secret.toFixed(1)} never leaves the student's side.
                </p>
              </div>
            </div>
          </div>
          <Notice title="Simulated" className="mt-6 max-w-3xl">
            The commitment here is a hash, chosen to make the idea visible. A production system would use a proper range-proof
            scheme such as BBS+ or Bulletproofs.
          </Notice>
        </section>
      </Container>

      {/* Topics */}
      <Container className="mt-24">
        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-10">
          <nav aria-label="Topics" className="col-span-12 lg:col-span-3">
            <div className="lg:sticky lg:top-32">
              <SectionLabel>Contents</SectionLabel>
              <ol className="mt-4 space-y-2">
                {TOPICS.map((t, i) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="flex items-baseline gap-3 text-sm text-muted-foreground hover:text-foreground">
                      <span className="font-mono text-xs text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                      {t.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <div className="col-span-12 min-w-0 lg:col-span-9">
            {TOPICS.map((t, i) => (
              <article key={t.id} id={t.id} className="scroll-mt-32 border-t border-foreground py-12 first:pt-8">
                <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-6">
                  <div className={cn("col-span-12 min-w-0", t.visual ? "md:col-span-7" : "md:col-span-8")}>
                    <p className="font-mono text-xs text-accent-ink">{String(i + 1).padStart(2, "0")}</p>
                    <h2 className="mt-2 text-4xl">{t.title}</h2>
                    <p className="mt-4 text-lg leading-relaxed">{t.plain}</p>
                    <p className="mt-4 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted-foreground">
                      <span className="kicker mb-1 block">Think of it as</span>
                      {t.id === "dl" ? <span className="datum">{t.example}</span> : t.example}
                    </p>
                  </div>
                  {t.visual && (
                    <div className="col-span-12 min-w-0 md:col-span-5">
                      <Visual kind={t.visual} />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </Container>

      {/* Then and now */}
      <Container className="mt-12">
        <SectionLabel>Then and now</SectionLabel>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-foreground text-left">
                <th className="kicker w-1/5 py-3 pr-6 font-normal" />
                <th className="py-3 pr-6 font-display text-2xl font-normal text-muted-foreground">Today</th>
                <th className="py-3 font-display text-2xl font-normal">With VeriCred</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Time", "2–4 weeks of emails and calls to the registrar", "About a second"],
                ["Privacy", "Full marksheet, every semester, roll number", "Only the fact that was asked for"],
                ["Fraud", "Edited PDFs pass a quick look", "Any edit breaks the signature"],
                ["Revocation", "Employers never hear about it", "Checked on every verification"],
              ].map(([k, a, b]) => (
                <tr key={k} className="border-b border-border align-top">
                  <td className="kicker py-4 pr-6">{k}</td>
                  <td className="py-4 pr-6 text-muted-foreground">{a}</td>
                  <td className="py-4">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </>
  );
}

function Visual({ kind }: { kind: "json" | "redact" | "bits" }) {
  if (kind === "json") {
    return (
      <pre className="overflow-x-auto border border-border bg-card p-6 font-mono text-xs leading-6">
{`{
  "type": "AcademicDegreeCredential",
  "issuer": "did:web:iitd.ac.in",
  "subject": {
    "degree": "B.Tech",
    "cgpa": 8.92
  },
  "proof": { "type": "BBS+", … }
}`}
      </pre>
    );
  }
  if (kind === "redact") {
    return (
      <dl className="space-y-3 border border-border bg-card p-6 text-sm">
        {[
          ["Degree", "B.Tech, Computer Science", true],
          ["University", "IIT Delhi", true],
          ["Roll number", "", false],
          ["CGPA", "", false],
          ["Subject marks", "", false],
        ].map(([k, v, shown]) => (
          <div key={k as string} className="grid grid-cols-5 items-center gap-4">
            <dt className="kicker col-span-2">{k}</dt>
            <dd className="col-span-3">{shown ? v : <span className="redacted block h-5 w-full" aria-label="Hidden" />}</dd>
          </div>
        ))}
      </dl>
    );
  }
  const revoked = new Set([5, 14, 27]);
  return (
    <div className="border border-border bg-card p-6">
      <div className="grid grid-cols-8 gap-1" role="img" aria-label="A row of 32 status bits, three of them set">
        {Array.from({ length: 32 }, (_, i) => (
          <span
            key={i}
            className={cn("flex aspect-square items-center justify-center font-mono text-[10px]", revoked.has(i) ? "bg-destructive text-destructive-foreground" : "bg-secondary text-muted-foreground")}
          >
            {revoked.has(i) ? 1 : 0}
          </span>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Slots 5, 14 and 27 are revoked. Everything else is valid.</p>
    </div>
  );
}
