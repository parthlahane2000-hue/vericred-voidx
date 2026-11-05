import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { INITIAL_CREDENTIALS } from "./demo-data";
import { fetchRevokedIds } from "./registry";
import type {
  VerificationAuditEntry,
  W3CVerifiableCredential,
  ZKSelectiveDisclosure,
} from "./types";
import type { VerificationStatus } from "./verify";

export interface EmployerCheck {
  id: string;
  at: string;
  credentialId: string;
  issuerName: string;
  degreeName?: string | undefined;
  status: VerificationStatus;
  summary: string;
}

export interface ForensicScan {
  id: string;
  at: string;
  fileName: string;
  verdict: "VERIFIED_AUTHENTIC" | "SUSPICIOUS" | "HIGH_RISK_FORGERY";
  source: "ai" | "specimen";
}

interface State {
  /** The student's wallet copies. Revocation state always comes from the database. */
  credentials: W3CVerifiableCredential[];
  checks: EmployerCheck[];
  scans: ForensicScan[];
}

interface Store extends State {
  revokedIds: Set<string>;
  incoming: ZKSelectiveDisclosure | null;
  sendToVerifier: (p: ZKSelectiveDisclosure) => void;
  clearIncoming: () => void;
  addToWallet: (c: W3CVerifiableCredential) => void;
  refreshStatuses: () => void;
  recordCheck: (c: Omit<EmployerCheck, "id" | "at">, audit?: VerificationAuditEntry) => void;
  recordScan: (s: Omit<ForensicScan, "id" | "at">) => void;
  resetDemo: () => void;
}

const STORAGE_KEY = "vericred:state:v2";

const initialState = (): State => ({
  credentials: INITIAL_CREDENTIALS,
  checks: [],
  scans: [],
});

const StoreContext = createContext<Store | null>(null);

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function VeriCredProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [incoming, setIncoming] = useState<ZKSelectiveDisclosure | null>(null);
  const hydrated = useRef(false);

  // Load the browser copy after mount so server and client render the same first frame.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (Array.isArray(parsed.credentials)) setState({ credentials: parsed.credentials, checks: parsed.checks ?? [], scans: parsed.scans ?? [] });
      }
    } catch {
      /* ignore a corrupt copy and keep demo data */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the session still works */
    }
  }, [state]);

  const addToWallet = useCallback((c: W3CVerifiableCredential) => {
    setState((s) => (s.credentials.some((x) => x.id === c.id) ? s : { ...s, credentials: [c, ...s.credentials] }));
  }, []);

  const walletIds = state.credentials.map((c) => c.id);
  const statusQuery = useQuery({
    queryKey: ["registry", "statuses", walletIds],
    queryFn: () => fetchRevokedIds(walletIds),
    staleTime: 15_000,
  });
  const revokedList = statusQuery.data;
  const refetchStatuses = statusQuery.refetch;

  const recordCheck = useCallback((c: Omit<EmployerCheck, "id" | "at">, audit?: VerificationAuditEntry) => {
    setState((s) => ({
      ...s,
      checks: [{ ...c, id: uid("chk"), at: new Date().toISOString() }, ...s.checks].slice(0, 50),
      credentials: audit
        ? s.credentials.map((cr) =>
            cr.id === c.credentialId ? { ...cr, verificationHistory: [audit, ...(cr.verificationHistory ?? [])] } : cr,
          )
        : s.credentials,
    }));
  }, []);

  const recordScan = useCallback((scan: Omit<ForensicScan, "id" | "at">) => {
    setState((s) => ({ ...s, scans: [{ ...scan, id: uid("scan"), at: new Date().toISOString() }, ...s.scans].slice(0, 50) }));
  }, []);

  const resetDemo = useCallback(() => {
    setState(initialState());
    setIncoming(null);
  }, []);

  const value = useMemo<Store>(() => {
    const revokedIds = new Set(revokedList ?? []);
    return {
      ...state,
      revokedIds,
      incoming,
      sendToVerifier: setIncoming,
      clearIncoming: () => setIncoming(null),
      addToWallet,
      refreshStatuses: () => void refetchStatuses(),
      recordCheck,
      recordScan,
      resetDemo,
    };
  }, [state, incoming, revokedList, refetchStatuses, addToWallet, recordCheck, recordScan, resetDemo]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useVeriCred() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useVeriCred must be used inside VeriCredProvider");
  return ctx;
}
