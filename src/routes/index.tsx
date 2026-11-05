import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { NAV_ITEMS } from "@/components/site/nav";
import { Container, SectionLabel, StatusMark } from "@/components/site/primitives";
import { CredentialSlip } from "@/components/vericred/CredentialSlip";
import { Button } from "@/components/ui/button";
import { useVeriCred } from "@/lib/vericred/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VeriCred — check a degree in seconds, keep the marksheet private" },
      {
        name: "description",
        content:
          "Universities issue signed credentials, students prove single facts like CGPA ≥ 7, employers verify in seconds. A prototype by Team VOIDX.",
      },
      { property: "og:title", content: "VeriCred — check a degree in seconds" },
      {
        property: "og:description",
        content: "Signed academic credentials with selective disclosure, live revocation and AI forgery review.",
      },
    ],
  }),
  component: Home,
});

const PROMISES = [
  {
    n: "01",
    title: "Trust",
    body: "Each credential carries the university's signature and a live revocation status. A photoshopped PDF has neither.",
    stat: "5%",
    statNote: "of applicants showed a fake degree (AuthBridge, 2025)",
  },
  {
    n: "02",
    title: "Privacy",
    body: "Need to know if CGPA is above 7? That's all the employer learns. Not the number, not the marksheet, not the roll number.",
    stat: "1 fact",
    statNote: "shared instead of a full transcript",
  },
  {
    n: "03",
    title: "Speed",
    body: "No more emailing registrars and waiting weeks. The checks run in the browser, in about a second.",
    stat: "~1s",
    statNote: "versus 2–4 weeks of manual follow-up",
  },
];

// Illustrative monthly volume for the chart. Live checks from this browser are added to the latest month.
const DEMO_MONTHS = [
  { m: "Jun", v: 38 },
  { m: "Jul", v: 52 },
  { m: "Aug", v: 61 },
  { m: "Sep", v: 74 },
  { m: "Oct", v: 96 },
  { m: "Nov", v: 118 },
];

function Home() {
  const { credentials, registry, revokedIds, checks, scans } = useVeriCred();

  const stats = useMemo(() => {
    // Passed checks are written into each credential's history; failed ones only live in the check log.
    const passed = credentials.reduce((n, c) => n + (c.verificationHistory?.length ?? 0), 0);
    const failed = checks.filter((c) => c.status !== "VERIFIED").length;
    const totalChecks = passed + failed;
    const passRate = totalChecks ? Math.round((passed / totalChecks) * 100) : 0;
    return {
      issued: credentials.length,
      active: registry.filter((r) => !r.isRevoked).length,
      revoked: registry.filter((r) => r.isRevoked).length,
      totalChecks,
      passRate,
      flagged: scans.filter((s) => s.verdict !== "VERIFIED_AUTHENTIC").length,
    };
  }, [credentials, registry, checks, scans]);

  const chartData = DEMO_MONTHS.map((d, i) => (i === DEMO_MONTHS.length - 1 ? { ...d, v: d.v + checks.length } : d));
  const featured = credentials.slice(0, 3);
  const offsets = ["lg:ml-0", "lg:ml-16", "lg:ml-6"];

  return (
    <>
      {/* Hero: text left, staggered document column right */}
      <Container className="pt-12 pb-20 md:pt-20">
        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-16">
          <div className="col-span-12 min-w-0 animate-rise lg:col-span-7">
            <p className="kicker">
              <span className="text-accent-ink">Seva Innovation Challenge 2026</span>
              <span className="mx-2">—</span>Team VOIDX
            </p>
            <h1 className="mt-6 text-5xl leading-[1.02] sm:text-6xl xl:text-[5.25rem]">
              A degree anyone can check in seconds. <span className="italic text-muted-foreground">A marksheet</span>{" "}
              nobody else needs to see.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
              VeriCred lets universities sign credentials, students keep them in a wallet, and employers check
              just the fact they asked about.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-4 md:gap-x-8 gap-y-4">
              <Button asChild size="lg">
                <Link to="/wallet">
                  Open the student wallet <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="link">
                <Link to="/verify">I'm an employer</Link>
              </Button>
            </div>
          </div>

          <div className="col-span-12 flex min-w-0 flex-col gap-6 lg:col-span-5 lg:pt-4">
            <p className="kicker">From the wallet of Aarav Sharma</p>
            {featured.map((c, i) => (
              <div
                key={c.id}
                className={`animate-rise ${offsets[i] ?? ""}`}
                style={{ animationDelay: `${200 + i * 120}ms` }}
              >
                <CredentialSlip credential={c} revoked={revokedIds.has(c.id)} />
              </div>
            ))}
          </div>
        </div>
      </Container>

      {/* Three promises: staircase rows */}
      <section className="border-y border-foreground/15 bg-card">
        <Container className="py-20">
          <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-10">
            <div className="col-span-12 lg:col-span-3">
              <SectionLabel>What changes</SectionLabel>
              <h2 className="mt-4 text-4xl leading-tight">Three things a paper certificate can't do.</h2>
            </div>
            <ol className="col-span-12 lg:col-span-9">
              {PROMISES.map((p, i) => (
                <li
                  key={p.n}
                  className="grid grid-cols-12 gap-x-6 gap-y-4 border-t border-border py-10 first:border-t-0 first:pt-0"
                >
                  <div className={`col-span-12 md:col-span-7 ${["", "md:pl-12", "md:pl-24"][i]}`}>
                    <div className="flex items-baseline gap-6">
                      <span className="font-mono text-xs text-accent-ink">{p.n}</span>
                      <h3 className="text-3xl">{p.title}</h3>
                    </div>
                    <p className="mt-4 max-w-md leading-relaxed text-muted-foreground md:ml-12">{p.body}</p>
                  </div>
                  <div className="col-span-12 md:col-span-4 md:col-start-9">
                    <p className="font-display text-5xl leading-none">{p.stat}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{p.statNote}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* Registry numbers */}
      <Container className="py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel>The registry, right now</SectionLabel>
            <h2 className="mt-4 text-4xl">Numbers that move when you use the app.</h2>
          </div>
          <StatusMark tone="warning">Demo data</StatusMark>
        </div>

        <div className="mt-12 grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-12">
          <dl className="col-span-12 grid grid-cols-2 gap-px self-start bg-border sm:grid-cols-3 lg:col-span-6">
            {[
              ["Issued", stats.issued],
              ["Active", stats.active],
              ["Revoked", stats.revoked],
              ["Employer checks", stats.totalChecks],
              ["Pass rate", `${stats.passRate}%`],
              ["Flagged uploads", stats.flagged],
            ].map(([label, value]) => (
              <div key={label as string} className="min-w-0 bg-background p-6">
                <dt className="kicker">{label}</dt>
                <dd className="mt-4 font-display text-5xl leading-none">{value}</dd>
              </div>
            ))}
          </dl>

          <figure className="col-span-12 min-w-0 lg:col-span-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                  <Tooltip
                    cursor={{ fill: "var(--color-secondary)" }}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 2,
                      fontSize: 12,
                    }}
                    formatter={(v) => [v, "Checks"]}
                  />
                  <Bar dataKey="v" radius={[1, 1, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={d.m} fill={i === chartData.length - 1 ? "var(--color-accent)" : "var(--color-primary)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <figcaption className="mt-4 text-sm text-muted-foreground">
              Employer checks per month, 2026. Illustrative figures; the ochre bar also counts checks you run here.
            </figcaption>
          </figure>
        </div>
      </Container>

      {/* Flow */}
      <section className="bg-secondary">
        <Container className="py-20">
          <SectionLabel>How a credential moves</SectionLabel>
          <div className="mt-10 grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-10">
            {[
              { who: "University", what: "Signs the record and adds it to a revocation list it controls.", to: "/issuer" as const, span: "lg:col-span-5" },
              { who: "Student", what: "Holds it in a wallet and picks which facts to share.", to: "/wallet" as const, span: "lg:col-span-4" },
              { who: "Employer", what: "Checks the signature, status and proof. Nothing else.", to: "/verify" as const, span: "lg:col-span-3" },
            ].map((s, i) => (
              <Link key={s.who} to={s.to} className={`group col-span-12 md:col-span-4 ${s.span} border-t-2 border-foreground pt-6`}>
                <p className="font-mono text-xs text-accent-ink">Step {i + 1}</p>
                <h3 className="mt-2 flex items-center gap-2 text-3xl">
                  {s.who}
                  <ArrowUpRight className="size-5 opacity-0 transition-opacity group-hover:opacity-100" />
                </h3>
                <p className="mt-3 max-w-xs text-muted-foreground">{s.what}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Index */}
      <Container className="pt-20">
        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-8">
          <div className="col-span-12 lg:col-span-4">
            <SectionLabel>Index</SectionLabel>
            <h2 className="mt-4 text-4xl">Every room in the building.</h2>
          </div>
          <ol className="col-span-12 border-t border-foreground lg:col-span-8">
            {NAV_ITEMS.map((n, i) => (
              <li key={n.to} className="border-b border-border">
                <Link to={n.to} className="group grid grid-cols-12 items-baseline gap-4 py-5">
                  <span className="col-span-2 font-mono text-xs text-muted-foreground sm:col-span-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="col-span-10 font-display text-2xl sm:col-span-4">{n.label}</span>
                  <span className="col-span-10 col-start-3 text-sm text-muted-foreground sm:col-span-6 sm:col-start-auto">
                    {n.hint}
                  </span>
                  <ArrowRight className="col-span-1 hidden size-4 justify-self-end transition-transform group-hover:translate-x-1 sm:block" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </>
  );
}
