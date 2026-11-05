import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-6 lg:px-10", className)}>{children}</div>;
}

export function PageIntro({
  number,
  kicker,
  title,
  dek,
  aside,
}: {
  number: string;
  kicker: string;
  title: ReactNode;
  dek: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <Container className="pt-12 pb-10 md:pt-16">
      <div className="grid grid-cols-12 items-end gap-x-4 md:gap-x-8 gap-y-6">
        <div className="col-span-12 min-w-0 animate-rise lg:col-span-7">
          <p className="kicker">
            <span className="text-accent-ink">§ {number}</span>
            <span className="mx-2">—</span>
            {kicker}
          </p>
          <h1 className="mt-4 text-[2.5rem] leading-[1.05] sm:text-5xl md:text-[3.5rem]">{title}</h1>
        </div>
        <div className="col-span-12 min-w-0 animate-rise [animation-delay:120ms] lg:col-span-4 lg:col-start-9">
          <div className="text-base leading-relaxed text-muted-foreground">{dek}</div>
          {aside ? <div className="mt-6">{aside}</div> : null}
        </div>
      </div>
      <div className="rule-ink mt-10" />
    </Container>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("kicker", className)}>{children}</p>;
}

type Tone = "success" | "destructive" | "warning" | "neutral" | "ink";

const toneText: Record<Tone, string> = {
  success: "text-success",
  destructive: "text-destructive",
  warning: "text-accent-ink",
  neutral: "text-muted-foreground",
  ink: "text-foreground",
};

export function StatusMark({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase leading-4 tracking-[0.12em]",
        toneText[tone],
        className,
      )}
    >
      <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function Stamp({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <div className={cn("stamp inline-block animate-stamp px-4 py-2 text-sm font-medium", toneText[tone], className)}>
      {children}
    </div>
  );
}

/** Honest label for anything simulated or demo-only. */
export function Notice({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <aside className={cn("border-l-2 border-accent bg-accent-soft/60 px-4 py-3 text-sm leading-relaxed", className)}>
      <span className="font-medium">{title}. </span>
      <span className="text-muted-foreground">{children}</span>
    </aside>
  );
}

/** Key/value row for ledger-style detail lists. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function Monogram({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-foreground/70 font-display text-sm tracking-wide",
        className,
      )}
      aria-hidden
    >
      {text}
    </span>
  );
}
