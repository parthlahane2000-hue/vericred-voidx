import type { W3CVerifiableCredential } from "./types";
import { sha256Hex } from "./zkp";

export interface IssueFormState {
  studentName: string;
  studentRollNo: string;
  degreeName: string;
  major: string;
  graduationYear: string;
  cgpa: string;
  honours: string;
  skills: string;
}

export type IssueErrors = Partial<Record<keyof IssueFormState, string>>;

export function validateIssueForm(f: IssueFormState): IssueErrors {
  const e: IssueErrors = {};
  if (f.studentName.trim().length < 2 || f.studentName.trim().length > 80) e.studentName = "Enter the student's full name.";
  if (!/^[A-Za-z0-9/_-]{4,30}$/.test(f.studentRollNo.trim())) e.studentRollNo = "4–30 letters, digits, / - or _.";
  if (f.degreeName.trim().length < 3) e.degreeName = "Enter the degree title.";
  if (f.major.trim().length < 2) e.major = "Enter the specialisation.";
  const y = Number(f.graduationYear);
  if (!Number.isInteger(y) || y < 1950 || y > 2035) e.graduationYear = "A year between 1950 and 2035.";
  const c = Number(f.cgpa);
  if (f.cgpa.trim() === "" || !Number.isFinite(c) || c < 0 || c > 10) e.cgpa = "CGPA between 0 and 10.";
  return e;
}

export function buildCredential(f: IssueFormState, index: number): W3CVerifiableCredential {
  const year = Number(f.graduationYear);
  const docId = `IITD/${year}/BTECH/CS${Math.floor(1000 + Math.random() * 9000)}`;
  const id = `urn:uuid:${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  return {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://schema.org", "https://digilocker.gov.in/credentials/v2"],
    id,
    type: ["VerifiableCredential", "AcademicDegreeCredential"],
    issuer: { id: "did:web:iitd.ac.in", name: "Indian Institute of Technology Delhi (IITD)" },
    issuanceDate: now,
    credentialSubject: {
      id: `did:key:z6Mk${sha256Hex(id).slice(0, 20)}`,
      studentName: f.studentName.trim(),
      studentRollNo: f.studentRollNo.trim(),
      institutionName: "Indian Institute of Technology Delhi",
      degreeName: f.degreeName.trim(),
      major: f.major.trim(),
      graduationYear: year,
      cgpa: Number(Number(f.cgpa).toFixed(2)),
      cgpaScale: 10,
      honours: f.honours.trim() || undefined,
      activeBacklogs: 0,
      skillsAcquired: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
    },
    credentialStatus: {
      id: "https://credentials.iitd.ac.in/revocation/2025",
      type: "RevocationList2026Status",
      statusPurpose: "revocation",
      statusListIndex: index,
      statusListCredential: "https://credentials.iitd.ac.in/revocation/statuslist.json",
    },
    digiLockerMetadata: {
      docType: "DEGREE",
      orgId: "in.gov.digilocker.iitd",
      orgName: "IIT Delhi",
      docId,
      digiLockerURI: `in.gov.digilocker/iitd/DEGREE/${docId.replace(/\//g, "-")}`,
      issuedDate: now.slice(0, 10),
      schemaVersion: "2.0",
    },
    proof: {
      type: "BBSPlusSignature2020",
      created: now,
      verificationMethod: "did:web:iitd.ac.in#key-2025-bbs-prime",
      proofPurpose: "assertionMethod",
      jws: sha256Hex(`JWS_PROOF:${id}:${docId}`),
      merkleRootHash: sha256Hex(`MERKLE:${id}:${f.cgpa}`),
    },
    verificationHistory: [],
  };
}
