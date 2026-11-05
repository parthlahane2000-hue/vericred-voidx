import { describe, expect, it } from "vitest";

import { INITIAL_CREDENTIALS } from "./demo-data";
import { contextFromRecord, parseLookup } from "./registry";
import { createSelectiveDisclosurePresentation } from "./zkp";
import { verifyPresentation } from "./verify";

const iitd = INITIAL_CREDENTIALS.find((c) => c.id === "urn:uuid:7c9e6679-7425-40de-944b-e07fc1f90ae7")!;
const proof = () => createSelectiveDisclosurePresentation(iitd, ["degreeName"], [{ attribute: "cgpa", threshold: 7.5 }]);

describe("registry-backed verification", () => {
  it("passes a valid proof when the database has an active record", () => {
    const record = parseLookup({ document: iitd, is_revoked: false });
    expect(verifyPresentation(proof(), contextFromRecord(record)).status).toBe("VERIFIED");
  });

  it("reports revoked when the database marks the record revoked", () => {
    const record = parseLookup({ document: iitd, is_revoked: true, revocation_reason: "Audit" });
    expect(verifyPresentation(proof(), contextFromRecord(record)).status).toBe("REVOKED");
  });

  it("rejects a proof whose credential is not in the database", () => {
    expect(verifyPresentation(proof(), contextFromRecord(null)).status).toBe("INVALID_SIGNATURE");
  });

  it("ignores a lookup response without a credential", () => {
    expect(parseLookup(null)).toBeNull();
    expect(parseLookup({ is_revoked: true })).toBeNull();
  });
});
