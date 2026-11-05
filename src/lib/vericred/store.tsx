import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { INITIAL_CREDENTIALS, INITIAL_REVOCATION_REGISTRY } from "./demo-data";
import type {
  RevocationRegistryItem,
  VerificationAuditEntry,
  W3CVerifiableCredential,
  ZKSelectiveDisclosure,
} from "./types";
import type { VerificationStatus } from "./verify";

export interface RegistryEvent {
  id: string;
  at: string;
  credentialId: string;
  studentName: string;
  action: "ISSUED" | "REVOKED" | "RESTORED";
  note?: string | undefined;
}

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
  credentials: W3CVerifiableCredential[];
  registry: RevocationRegistryItem[];
  events: RegistryEvent[];
  checks: EmployerCheck[];
  scans: ForensicScan[];
}

interface Store extends State {
  revokedIds: Set<string>;
  incoming: ZKSelectiveDisclosure | null;
  sendToVerifier: (p: ZKSelectiveDisclosure) => void;
  clearIncoming: () => void;
  issueCredential: (c: W3CVerifiableCredential) => void;
  setRevoked: (credentialId: string, revoked: boolean, reason?: string) => void;
  recordCheck: (c: Omit<EmployerCheck, "id" | "at">, audit?: VerificationAuditEntry) => void;
  recordScan: (s: Omit<ForensicScan, "id" | "at">) => void;
  resetDemo: () => void;
}

const STORAGE_KEY = "vericred:state:v1";

const initialState = (): State => ({
  credentials: INITIAL_CREDENTIALS,
  registry: INITIAL_REVOCATION_REGISTRY,
  events: [
    {
      id: "ev-seed-1",
      at: "2024-02-14T08:30:00Z",
      credentialId: "urn:uuid:fa3b21c4-1189-42b8-a76f-c91834720921",
      studentName: "Aarav Sharma",
      action: "REVOKED",
      note: "Academic audit: duplicate examination roll number",
    },
  ],
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
        if (Array.isArray(parsed.credentials) && Array.isArray(parsed.registry)) setState(parsed);
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

  const issueCredential = useCallback((c: W3CVerifiableCredential) => {
    setState((s) => ({
      ...s,
      credentials: [c, ...s.credentials],
      registry: [
        {
          id: uid("rev"),
          credentialId: c.id,
          studentName: c.credentialSubject.studentName,
          degreeName: `${c.credentialSubject.degreeName} (${c.digiLockerMetadata.orgName})`,
          docId: c.digiLockerMetadata.docId,
          statusListIndex: c.credentialStatus.statusListIndex,
          isRevoked: false,
        },
        ...s.registry,
      ],
      events: [
        { id: uid("ev"), at: new Date().toISOString(), credentialId: c.id, studentName: c.credentialSubject.studentName, action: "ISSUED" },
        ...s.events,
      ],
    }));
  }, []);

  const setRevoked = useCallback((credentialId: string, revoked: boolean, reason?: string) => {
    setState((s) => {
      const item = s.registry.find((r) => r.credentialId === credentialId);
      if (!item) return s;
      const at = new Date().toISOString();
      return {
        ...s,
        registry: s.registry.map((r) =>
          r.credentialId === credentialId
            ? {
                ...r,
                isRevoked: revoked,
                revocationReason: revoked ? reason || "Administrative revocation" : undefined,
                revokedAt: revoked ? at : undefined,
                revokedBy: revoked ? "Registrar's office" : undefined,
              }
            : r,
        ),
        events: [
          { id: uid("ev"), at, credentialId, studentName: item.studentName, action: revoked ? "REVOKED" : "RESTORED", note: revoked ? reason : undefined },
          ...s.events,
        ],
      };
    });
  }, []);

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
    const revokedIds = new Set(state.registry.filter((r) => r.isRevoked).map((r) => r.credentialId));
    return {
      ...state,
      revokedIds,
      incoming,
      sendToVerifier: setIncoming,
      clearIncoming: () => setIncoming(null),
      issueCredential,
      setRevoked,
      recordCheck,
      recordScan,
      resetDemo,
    };
  }, [state, incoming, issueCredential, setRevoked, recordCheck, recordScan, resetDemo]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useVeriCred() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useVeriCred must be used inside VeriCredProvider");
  return ctx;
}
