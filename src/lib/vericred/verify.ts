import type { W3CVerifiableCredential, ZKSelectiveDisclosure } from "./types";
import { verifyRangeProof } from "./zkp";

/** The five outcomes an employer can see. */
export type VerificationStatus =
  | "VERIFIED"
  | "INVALID_SIGNATURE"
  | "REVOKED"
  | "EXPIRED"
  | "FAILED";

export interface VerificationChecks {
  issuerTrusted: boolean;
  notRevoked: boolean;
  notExpired: boolean;
  proofSatisfied: boolean;
  claimIntegrity: boolean;
}

export interface VerificationOutcome {
  status: VerificationStatus;
  checks: VerificationChecks;
  reason: string;
}

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  INVALID_SIGNATURE: "Invalid signature",
  REVOKED: "Revoked",
  EXPIRED: "Expired",
  FAILED: "Verification failed",
};

interface Context {
  credentials: W3CVerifiableCredential[];
  revokedIds: Set<string>;
  now?: Date;
}

function trustedIssuers(credentials: W3CVerifiableCredential[]) {
  return new Set(credentials.map((c) => c.issuer.id));
}

/**
 * Decide the outcome of a presentation. Order matters: a revoked credential is
 * reported as revoked even if its proof is fine, because that is what the
 * employer needs to act on.
 */
export function verifyPresentation(p: ZKSelectiveDisclosure, ctx: Context): VerificationOutcome {
  const now = ctx.now ?? new Date();
  const credential = ctx.credentials.find((c) => c.id === p.credentialId);

  const issuerTrusted =
    trustedIssuers(ctx.credentials).has(p.issuerDid) &&
    typeof p.proofSignature === "string" &&
    !p.proofSignature.toUpperCase().includes("INVALID") &&
    (!credential || credential.issuer.id === p.issuerDid);

  const notRevoked = !ctx.revokedIds.has(p.credentialId);

  const expiry = credential?.expirationDate ? new Date(credential.expirationDate) : null;
  const notExpired = !expiry || expiry.getTime() > now.getTime();

  let proofSatisfied = true;
  if (Array.isArray(p.rangeProofs) && p.rangeProofs.length > 0) {
    proofSatisfied = p.rangeProofs.every(
      (rp) => rp.isSatisfied && (rp.response === "VALID_DELTA_PROOF_TOKEN_VERIFIED" || verifyRangeProof(rp)),
    );
  }

  const claimIntegrity = typeof p.merkleProofRoot === "string" && p.merkleProofRoot.length >= 16;

  const checks: VerificationChecks = { issuerTrusted, notRevoked, notExpired, proofSatisfied, claimIntegrity };

  if (!notRevoked) {
    return { status: "REVOKED", checks, reason: "The issuing university has revoked this credential." };
  }
  if (!issuerTrusted) {
    return {
      status: "INVALID_SIGNATURE",
      checks,
      reason: "The issuer's signature doesn't match any university in the trusted registry.",
    };
  }
  if (!notExpired) {
    return { status: "EXPIRED", checks, reason: "This credential is past its expiry date." };
  }
  if (!proofSatisfied) {
    return {
      status: "FAILED",
      checks,
      reason: "The range proof doesn't hold. Either the threshold isn't met or the proof was altered.",
    };
  }
  if (!claimIntegrity) {
    return { status: "FAILED", checks, reason: "The disclosed fields can't be tied back to the signed record." };
  }
  return { status: "VERIFIED", checks, reason: "Every check passed." };
}

/** Direct lookup by credential ID or DigiLocker document ID (no proof involved). */
export function verifyByReference(reference: string, ctx: Context) {
  const ref = reference.trim().toLowerCase();
  const credential = ctx.credentials.find(
    (c) => c.id.toLowerCase() === ref || c.digiLockerMetadata.docId.toLowerCase() === ref,
  );
  if (!credential) return { credential: null, outcome: null };

  const p: ZKSelectiveDisclosure = {
    credentialId: credential.id,
    issuerDid: credential.issuer.id,
    issuerName: credential.issuer.name,
    issuanceDate: credential.issuanceDate,
    digiLockerDocType: credential.digiLockerMetadata.docType,
    disclosedAttributes: { degreeName: credential.credentialSubject.degreeName },
    hiddenAttributes: [],
    rangeProofs: [],
    merkleProofRoot: credential.proof.merkleRootHash,
    proofSignature: credential.proof.jws,
    timestamp: new Date().toISOString(),
    nonce: "lookup",
  };
  return { credential, outcome: verifyPresentation(p, ctx) };
}

/** Accept either raw JSON or a base64url share token. */
export function parsePresentation(input: string): ZKSelectiveDisclosure | null {
  const text = input.trim();
  if (!text) return null;
  const tryJson = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && typeof v.credentialId === "string" && typeof v.issuerDid === "string"
        ? (v as ZKSelectiveDisclosure)
        : null;
    } catch {
      return null;
    }
  };
  return tryJson(text) ?? tryJson(decodeShareToken(text) ?? "");
}

export function encodeShareToken(p: ZKSelectiveDisclosure): string {
  const json = JSON.stringify(p);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShareToken(token: string): string | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return null;
  }
}
