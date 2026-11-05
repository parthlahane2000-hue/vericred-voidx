import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Container, Monogram, PageIntro } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import deck from "@/assets/vericred-pitch-deck.pdf.asset.json";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pitch")({
  head: () => ({
    meta: [
      { title: "Pitch deck — VeriCred by Team VOIDX" },
      { name: "description", content: "The VeriCred pitch for the Seva Innovation Challenge 2026: problem, solution, roadmap, impact and team." },
      { property: "og:title", content: "Pitch deck — VeriCred by Team VOIDX" },
      { property: "og:description", content: "Seva Innovation Challenge 2026: the problem, our solution and what we need." },
    ],
  }),
  component: PitchPage,
});

const TEAM = [
  { initials: "PL", name: "Parth Lahane", role: "Developer" },
  { initials: "KS", name: "Krishna Shukla", role: "Presenter" },
  { initials: "SS", name: "Sanika Sakarkar", role: "Research and documentation" },
  { initials: "HB", name: "Hansika Bolli", role: "Presenter" },
];

const SLIDES: Array<{ title: string; body: ReactNode }> = [
  {
    title: "VeriCred",
    body: (
      <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-10">
        <div className="col-span-12 md:col-span-7">
          <p className="font-display text-3xl italic leading-snug md:text-4xl">
            “Verifiable academic and skill credentials, DigiLocker-compatible: employers verify instantly, students share only what is needed.”
          </p>
          <dl className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <dt className="kicker">Domain</dt>
              <dd className="mt-1 text-sm">Emerging technologies — AI, blockchain and others</dd>
            </div>
            <div>
              <dt className="kicker">Sub-theme</dt>
              <dd className="mt-1 text-sm">Trusted digital records and interoperable public data</dd>
            </div>
          </dl>
        </div>
        <div className="col-span-12 md:col-span-4 md:col-start-9">
          <p className="kicker">Presented by Team VOIDX</p>
          <TeamList />
        </div>
      </div>
    ),
  },
  {
    title: "The problem",
    body: (
      <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-10">
        <div className="col-span-12 md:col-span-4">
          <p className="font-display text-[7rem] leading-none text-accent-ink">5%</p>
          <p className="mt-4 text-sm text-muted-foreground">of job applicants presented fake degrees or certificates (AuthBridge, Oct 2024 – Mar 2025).</p>
          <p className="mt-4 text-sm">A bad hire can cost up to a third of first-year salary.</p>
        </div>
        <div className="col-span-12 space-y-8 md:col-span-7 md:col-start-6">
          <Para title="What's wrong">
            Degrees travel as PDFs and paper that can be forged, so employers fall back on slow manual checks with each university.
            There's no instant way to prove a credential is genuine and still valid.
          </Para>
          <Para title="Who it hurts">
            Graduates, HR teams, background-check firms, and the university staff who answer verification emails by hand. Students hand over
            full marksheets to prove a single fact.
          </Para>
          <Para title="The gap in DigiLocker">
            It shares whole documents, not single facts like “CGPA above 7”. Many records still aren't digital, and a shared PDF carries no live
            revocation check.
          </Para>
        </div>
      </div>
    ),
  },
  {
    title: "Our solution",
    body: (
      <div className="space-y-12">
        <p className="max-w-3xl text-lg leading-relaxed">
          Universities issue W3C verifiable credentials to a student's wallet. Employers verify them in seconds, and students prove single facts
          with zero-knowledge proofs, without revealing the marksheet.
        </p>
        <ol className="grid grid-cols-1 gap-x-4 md:gap-x-8 gap-y-8 md:grid-cols-3">
          {[
            ["Input", "The university signs and issues a credential to the student's wallet."],
            ["Process", "AI flags forged uploads; the range proof and revocation check run."],
            ["Output", "The employer sees “verified” in seconds, with no marksheet attached."],
          ].map(([t, d], i) => (
            <li key={t} className="border-t-2 border-foreground pt-4">
              <p className="font-mono text-xs text-accent-ink">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 font-display text-2xl">{t}</p>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-foreground text-left">
                <th className="kicker py-3 pr-6 font-normal">Measure</th>
                <th className="kicker py-3 pr-6 font-normal">Today</th>
                <th className="kicker py-3 font-normal">VeriCred</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Cost", "Agency fee per check", "Near zero per check"],
                ["Time", "2–4 weeks of follow-ups", "About a second"],
                ["Reach", "University by university", "One open W3C standard"],
                ["Privacy", "Full marksheet shared", "Only the fact needed"],
              ].map(([a, b, c]) => (
                <tr key={a} className="border-b border-border">
                  <td className="py-3 pr-6">{a}</td>
                  <td className="py-3 pr-6 text-muted-foreground">{b}</td>
                  <td className="py-3">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    title: "Feasibility and roadmap",
    body: (
      <div className="space-y-12">
        <ol className="grid grid-cols-5 gap-2" aria-label="Project stage">
          {["Idea", "Proof of concept", "Working prototype", "Field pilot", "Ready to deploy"].map((s, i) => (
            <li key={s} className={cn("border-t-4 pt-3 text-xs sm:text-sm", i < 3 ? "border-foreground" : "border-border text-muted-foreground")}>
              {s}
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-1 gap-x-4 md:gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          <Para title="Technology">W3C VC 2.0, selective disclosure, blockchain-ready revocation, DigiLocker-style metadata, AI scan review.</Para>
          <Para title="Cost">The prototype runs on an open-source stack. Pilot budget to be set with the first partners; per-check cost well below agency fees.</Para>
          <Para title="Timeline">3 months: issue, wallet and verify. 6 months: proofs and AI review. 12 months: pilot with a university and employers.</Para>
          <Para title="Partners">A partner university as first issuer, DigiLocker (NeGD), and employers and verification firms as verifiers.</Para>
        </div>
      </div>
    ),
  },
  {
    title: "Impact and scale",
    body: (
      <div className="space-y-12">
        <dl className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
          {[
            ["5,000+", "graduates in a one-university pilot (estimate)"],
            ["~1s", "per verification, against weeks today"],
            ["72 cr+", "DigiLocker users already (Aug 2026)"],
          ].map(([n, d]) => (
            <div key={n} className="bg-card p-6">
              <dt className="font-display text-5xl">{n}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-1 gap-x-4 md:gap-x-8 gap-y-8 md:grid-cols-3">
          <Para title="Social">Honest graduates get verified faster, including first-generation and rural students without city networks.</Para>
          <Para title="Sustainability">A small per-check fee for employers, a licence for universities, free for students. Open standards avoid lock-in.</Para>
          <Para title="Scale-up">One university, then other campuses and state universities, then skill bodies. Fits Digital India, SDG 4 and SDG 8.</Para>
        </div>
      </div>
    ),
  },
  {
    title: "Team and support",
    body: (
      <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-10">
        <div className="col-span-12 md:col-span-5">
          <p className="kicker">Team VOIDX</p>
          <TeamList />
        </div>
        <div className="col-span-12 md:col-span-6 md:col-start-7">
          <p className="kicker">What we're asking for</p>
          <ol className="mt-4 border-t border-foreground">
            {["Mentorship and technical guidance", "A pilot with a university or government department", "Funding or grant support", "Incubation and workspace", "Testing, certification or IP support"].map((s, i) => (
              <li key={s} className="flex items-baseline gap-4 border-b border-border py-3 text-sm">
                <span className="font-mono text-xs text-accent-ink">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-6 font-display text-xl italic">With support, VeriCred goes from prototype to a first university pilot within 12 months.</p>
        </div>
      </div>
    ),
  },
];

function Para({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="kicker">{title}</p>
      <p className="mt-2 text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function TeamList() {
  return (
    <ul className="mt-4 divide-y divide-border border-y border-border">
      {TEAM.map((m) => (
        <li key={m.name} className="flex items-center gap-4 py-3">
          <Monogram text={m.initials} className="size-10 text-xs" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{m.name}</p>
            <p className="text-xs text-muted-foreground">{m.role}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PitchPage() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i]!;

  return (
    <>
      <PageIntro
        number="07"
        kicker="Pitch deck · Seva Innovation Challenge 2026"
        title={
          <>
            Six slides, <span className="italic">one idea.</span>
          </>
        }
        dek="The case for VeriCred as presented by Team VOIDX. The original PDF is available to download."
        aside={
          <Button asChild variant="outline">
            <a href={deck.url} target="_blank" rel="noreferrer" download="VeriCred-pitch-deck.pdf">
              <Download /> Download the PDF
            </a>
          </Button>
        }
      />

      <Container>
        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-8">
          <nav aria-label="Slides" className="col-span-12 lg:col-span-3">
            <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-foreground lg:pb-0">
              {SLIDES.map((s, n) => (
                <li key={s.title} className="shrink-0 lg:border-b lg:border-border">
                  <button
                    type="button"
                    onClick={() => setI(n)}
                    aria-current={n === i ? "step" : undefined}
                    className={cn(
                      "flex w-full items-baseline gap-3 whitespace-nowrap border border-border px-3 py-2 text-left text-sm transition-colors lg:border-0 lg:px-2 lg:py-3",
                      n === i ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="font-mono text-xs text-accent-ink">{String(n + 1).padStart(2, "0")}</span>
                    {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <article className="sheet col-span-12 min-w-0 p-6 sm:p-10 lg:col-span-9 lg:p-12">
            <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-foreground pb-6">
              <h2 className="text-4xl md:text-5xl">{slide.title}</h2>
              <p className="kicker">
                Slide {i + 1} of {SLIDES.length}
              </p>
            </header>
            <div key={i} className="animate-rise pt-10">
              {slide.body}
            </div>
            <footer className="mt-12 flex items-center justify-between border-t border-border pt-6">
              <Button variant="ghost" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>
                <ArrowLeft /> Previous
              </Button>
              <Button variant="ghost" onClick={() => setI((n) => Math.min(SLIDES.length - 1, n + 1))} disabled={i === SLIDES.length - 1}>
                Next <ArrowRight />
              </Button>
            </footer>
          </article>
        </div>
      </Container>
    </>
  );
}
