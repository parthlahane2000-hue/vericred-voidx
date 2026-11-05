/**
 * W3C Verifiable Credentials 2.0 & DigiLocker Compliance Data Models
 */

export type CredentialCategory = 'DEGREE' | 'MARK_SHEET' | 'SKILL_BADGE' | 'DIPLOMA';

export interface DigiLockerDocMetadata {
  docType: CredentialCategory;
  orgId: string; // e.g. "in.gov.digilocker.iitd"
  orgName: string;
  docId: string; // e.g. "IITD/2024/BTECH/8842"
  aadhaarHashRef?: string | undefined; // SHA-256 masked ref (e.g. "XXXX-XXXX-9481")
  digiLockerURI: string; // "in.gov.digilocker/iitd/DEGREE/8842"
  issuedDate: string;
  schemaVersion: string;
}

export interface AcademicSubject {
  code: string;
  name: string;
  credits: number;
  grade: string;
  scorePercent: number;
}

export interface CredentialSubject {
  id: string; // DID of student e.g. "did:key:z6MkuS..."
  studentName: string;
  studentRollNo: string;
  institutionName: string;
  degreeName: string;
  major: string;
  graduationYear: number;
  cgpa: number; // e.g. 8.92
  cgpaScale: number; // e.g. 10.0
  honours?: string | undefined; // e.g. "First Class with Distinction"
  activeBacklogs: number;
  skillsAcquired?: string[] | undefined;
  subjects?: AcademicSubject[] | undefined;
}

export interface CredentialProof {
  type: 'Ed25519Signature2020' | 'BBSPlusSignature2020' | 'JsonWebSignature2020';
  created: string;
  verificationMethod: string; // DID URL of issuer public key
  proofPurpose: 'assertionMethod';
  jws: string;
  merkleRootHash: string;
}

export interface CredentialStatus {
  id: string; // URL of the revocation registry
  type: 'RevocationList2026Status' | 'BitstringStatusListEntry';
  statusPurpose: 'revocation' | 'suspension';
  statusListIndex: number;
  statusListCredential: string;
}

export interface VerificationAuditEntry {
  id: string;
  verifiedAt: string;
  verifierEntity: string;
  verifierType: 'EMPLOYER' | 'BACKGROUND_CHECK_AGENCY' | 'GOVERNMENT_PORTAL' | 'INSTITUTION';
  verificationPurpose: string;
  status: 'PASSED' | 'FAILED';
  proofType: 'ZK_SELECTIVE_DISCLOSURE' | 'DIGILOCKER_DIRECT' | 'FULL_MERKLE';
  disclosedSummary: string; // e.g. "Proved: CGPA >= 7.5 (No transcript revealed)"
}

export interface W3CVerifiableCredential {
  '@context': string[];
  id: string; // URI e.g. "urn:uuid:9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  type: string[]; // ["VerifiableCredential", "AcademicDegreeCredential"]
  issuer: {
    id: string; // "did:web:iitd.ac.in"
    name: string;
    icon?: string | undefined;
  };
  issuanceDate: string;
  expirationDate?: string | undefined;
  credentialSubject: CredentialSubject;
  credentialStatus: CredentialStatus;
  digiLockerMetadata: DigiLockerDocMetadata;
  proof: CredentialProof;
  verificationHistory?: VerificationAuditEntry[] | undefined;
}

export interface ZKRangeProof {
  attribute: string; // e.g. "cgpa"
  operator: '>=' | '<=' | '==' | 'in';
  threshold: number | string;
  commitment: string; // Pedersen commitment hex
  blindingFactorHash: string;
  challenge: string; // Schnorr challenge e
  response: string; // s = r + e * value
  isSatisfied: boolean;
}

export interface ZKSelectiveDisclosure {
  credentialId: string;
  issuerDid: string;
  issuerName: string;
  issuanceDate: string;
  digiLockerDocType: CredentialCategory;
  disclosedAttributes: Partial<CredentialSubject>;
  hiddenAttributes: string[];
  rangeProofs: ZKRangeProof[];
  merkleProofRoot: string;
  proofSignature: string;
  timestamp: string;
  nonce: string;
}

export interface RevocationRegistryItem {
  id: string;
  credentialId: string;
  studentName: string;
  degreeName: string;
  docId: string;
  statusListIndex: number;
  isRevoked: boolean;
  revocationReason?: string | undefined;
  revokedAt?: string | undefined;
  revokedBy?: string | undefined;
}

export interface DocumentForgeryAnomaly {
  id: string;
  title: string;
  type: 'FONT_MISMATCH' | 'CLONED_SEAL' | 'SIGNATURE_TAMPERING' | 'METADATA_INCONSISTENCY' | 'RASTER_ARTIFACT' | 'REVOCATION_MISMATCH';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  location: {
    x: number; // percentage 0-100
    y: number;
    width: number;
    height: number;
  };
}

export interface ForgeryForensicReport {
  documentId: string;
  fileName: string;
  verdict: 'VERIFIED_AUTHENTIC' | 'SUSPICIOUS' | 'HIGH_RISK_FORGERY';
  confidenceScore: number; // 0 to 100
  summary: string;
  institutionDetected: string;
  candidateNameDetected: string;
  cgpaOrGradeDetected: string;
  digiLockerDocMatch: boolean;
  sealIntegrityScore: number;
  fontConsistencyScore: number;
  signatureIntegrityScore: number;
  anomalies: DocumentForgeryAnomaly[];
  forensicChecklist: {
    digitalSignatureValid: boolean;
    sealWatermarkIntact: boolean;
    fontKerningConsistent: boolean;
    qrDigiLockerChecksumMatch: boolean;
    revocationRegistryClear: boolean;
  };
  recommendation: string;
}
