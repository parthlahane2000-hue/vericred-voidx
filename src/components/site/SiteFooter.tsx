import { Link } from "@tanstack/react-router";

import { NAV_ITEMS } from "./nav";
import { Container } from "./primitives";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-primary text-primary-foreground">
      <Container className="py-16">
        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-12">
          <div className="col-span-12 lg:col-span-6">
            <p className="font-display text-4xl leading-tight md:text-5xl">
              Check the fact.
              <br />
              <span className="italic">Keep the marksheet.</span>
            </p>
          </div>
          <div className="col-span-6 lg:col-span-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary-foreground/60">Sections</p>
            <ul className="mt-4 space-y-2 text-sm">
              {NAV_ITEMS.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="text-primary-foreground/85 hover:text-primary-foreground hover:underline">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-6 lg:col-span-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary-foreground/60">Built on</p>
            <ul className="mt-4 space-y-2 text-sm text-primary-foreground/85">
              <li>W3C Verifiable Credentials 2.0</li>
              <li>DigiLocker-style document URIs</li>
              <li>Status-list revocation</li>
              <li>Gemini document review</li>
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-primary-foreground/20 pt-6 text-xs text-primary-foreground/60 md:flex-row md:justify-between">
          <p>VeriCred, by Team VOIDX for the Seva Innovation Challenge 2026.</p>
          <p className="max-w-xl md:text-right">
            Demo records only. There's no live DigiLocker connection and no blockchain transaction; proofs are a
            hash-based simulation.
          </p>
        </div>
      </Container>
    </footer>
  );
}
