import { supabase } from "@/integrations/supabase/client";

import type { RevocationRegistryItem, W3CVerifiableCredential } from "./types";

/** One record as returned by the public lookup: the signed document plus its live revocation state. */
export interface RegistryRecord {
  credential: W3CVerifiableCredential;
  isRevoked: boolean;
  revocationReason: string | null;
  revokedAt: string | null;
}

export interface RegistryEventRow {
  id: string;
  at: string;
  credentialId: string;
  studentName: string;
  action: "ISSUED" | "REVOKED" | "RESTORED";
  note: string | null;
}

/** Turn the lookup response into a record, rejecting anything that isn't a credential. */
export function parseLookup(raw: unknown): RegistryRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const doc = r["document"] as W3CVerifiableCredential | undefined;
  if (!doc || typeof doc !== "object" || typeof doc.id !== "string" || !doc.issuer || !doc.credentialSubject) return null;
  return {
    credential: doc,
    isRevoked: r["is_revoked"] === true,
    revocationReason: typeof r["revocation_reason"] === "string" ? (r["revocation_reason"] as string) : null,
    revokedAt: typeof r["revoked_at"] === "string" ? (r["revoked_at"] as string) : null,
  };
}

/**
 * Build the verification context from what the registry returned. Only the
 * looked-up record counts as trusted: a credential that isn't in the database
 * can't be trusted, whatever the proof claims.
 */
export function contextFromRecord(record: RegistryRecord | null) {
  return {
    credentials: record ? [record.credential] : [],
    revokedIds: new Set(record?.isRevoked ? [record.credential.id] : []),
  };
}

/** Public: look up exactly one record by credential ID or document ID. */
export async function lookupCredential(reference: string): Promise<RegistryRecord | null> {
  const ref = reference.trim();
  if (ref.length < 4) return null;
  const { data, error } = await supabase.rpc("lookup_credential", { _ref: ref });
  if (error) throw new Error("The registry didn't answer. Try again in a moment.");
  return parseLookup(data);
}

/** Public: live revocation state for credentials the caller already holds. */
export async function fetchRevokedIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc("credential_statuses", { _ids: ids.slice(0, 100) });
  if (error) throw error;
  return (data ?? []).filter((r) => r.is_revoked).map((r) => r.credential_id);
}

/** Public: headline numbers for the front page. */
export async function fetchRegistryCounts() {
  const { data, error } = await supabase.rpc("registry_counts");
  if (error) throw error;
  const row = data?.[0];
  return { total: Number(row?.total ?? 0), revoked: Number(row?.revoked ?? 0) };
}

/* ---------- Registrar staff only (enforced by database access rules) ---------- */

export async function checkIsIssuer(userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "issuer").maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function listRegistry(): Promise<RevocationRegistryItem[]> {
  const { data, error } = await supabase
    .from("issued_credentials")
    .select("credential_id, doc_id, student_name, degree_name, status_list_index, is_revoked, revocation_reason, revoked_at, revoked_by")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.credential_id,
    credentialId: r.credential_id,
    studentName: r.student_name,
    degreeName: r.degree_name,
    docId: r.doc_id,
    statusListIndex: r.status_list_index,
    isRevoked: r.is_revoked,
    revocationReason: r.revocation_reason ?? undefined,
    revokedAt: r.revoked_at ?? undefined,
    revokedBy: r.revoked_by ?? undefined,
  }));
}

export async function listEvents(): Promise<RegistryEventRow[]> {
  const { data, error } = await supabase
    .from("registry_events")
    .select("id, created_at, credential_id, student_name, action, note")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    at: e.created_at,
    credentialId: e.credential_id,
    studentName: e.student_name,
    action: e.action as RegistryEventRow["action"],
    note: e.note,
  }));
}

export async function issueToRegistry(c: W3CVerifiableCredential, userId: string, studentEmail: string) {
  const { verificationHistory: _omit, ...document } = c;
  const { error } = await supabase.from("issued_credentials").insert({
    credential_id: c.id,
    doc_id: c.digiLockerMetadata.docId,
    issuer_did: c.issuer.id,
    issuer_name: c.issuer.name,
    student_name: c.credentialSubject.studentName,
    degree_name: `${c.credentialSubject.degreeName} (${c.digiLockerMetadata.orgName})`,
    status_list_index: c.credentialStatus.statusListIndex,
    document: JSON.parse(JSON.stringify(document)),
    issued_by: userId,
    student_email: studentEmail.trim().toLowerCase(),
  });
  if (error) throw new Error(error.code === "23505" ? "A credential with that document ID already exists." : "Couldn't save the credential.");
}

export async function setRevokedInRegistry(credentialId: string, revoked: boolean, reason?: string) {
  const { error } = await supabase
    .from("issued_credentials")
    .update(revoked ? { is_revoked: true, revocation_reason: reason ?? null } : { is_revoked: false })
    .eq("credential_id", credentialId);
  if (error) throw new Error("Couldn't update the registry.");
}

/* ---------- Students: their own credentials (matched to their sign-in email by access rules) ---------- */

export async function listMyCredentials(email: string): Promise<RegistryRecord[]> {
  const { data, error } = await supabase
    .from("issued_credentials")
    .select("document, is_revoked, revocation_reason, revoked_at")
    .eq("student_email", email.trim().toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw new Error("Couldn't load your credentials.");
  return (data ?? []).map((r) => parseLookup(r)).filter((r): r is RegistryRecord => r !== null);
}
