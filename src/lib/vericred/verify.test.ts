import { describe, expect, it } from "vitest";

import { INITIAL_CREDENTIALS } from "./demo-data";
import { validateIssueForm } from "./issue";
import { encodeShareToken, parsePresentation, verifyByReference, verifyPresentation } from "./verify";
import { createSelectiveDisclosurePresentation } from "./zkp";

const iitd = INITIAL_CREDENTIALS.find((c) => c.id === "urn:uuid:7c9e6679-7425-40de-944b-e07fc1f90ae7")!;
const ctx = (revoked: string[] = []) => ({ credentials: INITIAL_CREDENTIALS, revokedIds: new Set(revoked), now: new Date("2026-11-05T00:00:00Z") });
const proof = (threshold: number) => createSelectiveDisclosurePresentation(iitd, ["degreeName"], [{ attribute: "cgpa", threshold }]);

describe("employer verification outcomes", () => {
  it("verifies a CGPA 8.92 credential proving CGPA >= 7", () => {
    expect(verifyPresentation(proof(7), ctx()).status).toBe("VERIFIED");
  });

  it("fails when the CGPA is below the threshold asked for", () => {
    expect(verifyPresentation(proof(9), ctx()).status).toBe("FAILED");
  });

  it("reports a revoked credential as revoked even with a valid proof", () => {
    expect(verifyPresentation(proof(7), ctx([iitd.id])).status).toBe("REVOKED");
  });

  it("reports an invalid signature for an issuer not in the registry", () => {
    const p = { ...proof(7), issuerDid: "did:web:unknown-unverified.com" };
    expect(verifyPresentation(p, ctx()).status).toBe("INVALID_SIGNATURE");
  });

  it("reports expired once the expiry date (20 Jul 2034) has passed", () => {
    const later = { ...ctx(), now: new Date("2034-07-21T00:00:00Z") };
    expect(verifyPresentation(proof(7), later).status).toBe("EXPIRED");
  });

  it("finds a credential by its document ID", () => {
    const r = verifyByReference("IITD/2024/BTECH/CS8842", ctx());
    expect(r.credential?.id).toBe(iitd.id);
    expect(r.outcome?.status).toBe("VERIFIED");
  });

  it("round-trips a proof through a share token", () => {
    const p = proof(7);
    expect(parsePresentation(encodeShareToken(p))?.nonce).toBe(p.nonce);
  });
});

describe("issuing a credential", () => {
  const base = {
    studentName: "Priya N. Sundaram",
    studentRollNo: "2021CS1092",
    degreeName: "B.Tech",
    major: "CSE",
    graduationYear: "2025",
    cgpa: "9.15",
    honours: "",
    skills: "",
  };
  it("accepts a CGPA of 10", () => {
    expect(validateIssueForm({ ...base, cgpa: "10" }).cgpa).toBeUndefined();
  });
  it("rejects a CGPA above 10", () => {
    expect(validateIssueForm({ ...base, cgpa: "10.5" }).cgpa).toBeDefined();
  });
});
