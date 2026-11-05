import { test } from 'vitest';
import { strict as assert } from 'node:assert';
import {
  sha256Hex,
  createCommitment,
  generateRangeProof,
  verifyRangeProof,
  buildMerkleClaimTree,
  createSelectiveDisclosurePresentation,
  checkBitstringRevocation,
  setRevocationBit,
  validateDigiLockerURI,
} from './zkp';
import { W3CVerifiableCredential } from './types';

test('sha256Hex creates deterministic 64-char hex strings', () => {
  const hash1 = sha256Hex('IIT_DELHI_DEGREE');
  const hash2 = sha256Hex('IIT_DELHI_DEGREE');
  const hash3 = sha256Hex('STANFORD_CREDENTIAL');

  assert.equal(hash1.length, 64);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});

test('createCommitment binds value and salt deterministically', () => {
  const c1 = createCommitment(8.92, 'salt_alpha');
  const c2 = createCommitment(8.92, 'salt_alpha');
  const c3 = createCommitment(8.92, 'salt_beta');

  assert.equal(c1, c2);
  assert.notEqual(c1, c3);
});

test('generateRangeProof verifies valid CGPA predicate without exposing value', () => {
  // Student has CGPA = 8.92, employer wants to prove CGPA >= 7.5
  const proof = generateRangeProof('cgpa', 8.92, 7.5, 'secret_salt_123');

  assert.equal(proof.isSatisfied, true);
  assert.equal(proof.attribute, 'cgpa');
  assert.equal(proof.threshold, 7.5);
  // Verifier checks proof
  const isValid = verifyRangeProof(proof);
  assert.equal(isValid, true);
});

test('generateRangeProof rejects when actual value is below threshold', () => {
  // Student has CGPA = 6.4, employer wants CGPA >= 7.0
  const proof = generateRangeProof('cgpa', 6.4, 7.0, 'secret_salt_456');

  assert.equal(proof.isSatisfied, false);
  const isValid = verifyRangeProof(proof);
  assert.equal(isValid, false);
});

test('verifyRangeProof rejects tampered challenge or response', () => {
  const proof = generateRangeProof('cgpa', 9.1, 8.0, 'salt_789');
  assert.equal(verifyRangeProof(proof), true);

  // Tamper with threshold without updating challenge
  const tamperedProof = { ...proof, threshold: 9.5 };
  assert.equal(verifyRangeProof(tamperedProof), false);
});

test('buildMerkleClaimTree generates correct leaves and root', () => {
  const claims = {
    name: 'Aarav Sharma',
    cgpa: 8.92,
    degree: 'B.Tech CS',
  };
  const tree = buildMerkleClaimTree(claims);
  assert.ok(tree.root);
  assert.ok(tree.leaves['name']);
  assert.ok(tree.leaves['cgpa']);
  assert.ok(tree.leaves['degree']);
});

test('createSelectiveDisclosurePresentation conceals hidden fields while proving predicates', () => {
  const mockVc: W3CVerifiableCredential = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: 'urn:uuid:mock-1234',
    type: ['VerifiableCredential', 'AcademicDegreeCredential'],
    issuer: {
      id: 'did:web:iitd.ac.in',
      name: 'IIT Delhi',
    },
    issuanceDate: '2024-06-15T10:00:00Z',
    credentialSubject: {
      id: 'did:key:z6MkuS...',
      studentName: 'Aarav Sharma',
      studentRollNo: '2020CS1044',
      institutionName: 'IIT Delhi',
      degreeName: 'B.Tech in Computer Science',
      major: 'Computer Science',
      graduationYear: 2024,
      cgpa: 8.92,
      cgpaScale: 10.0,
      activeBacklogs: 0,
    },
    credentialStatus: {
      id: 'https://credentials.iitd.ac.in/status/2024',
      type: 'RevocationList2026Status',
      statusPurpose: 'revocation',
      statusListIndex: 42,
      statusListCredential: 'https://credentials.iitd.ac.in/status/list',
    },
    digiLockerMetadata: {
      docType: 'DEGREE',
      orgId: 'in.gov.digilocker.iitd',
      orgName: 'IIT Delhi',
      docId: 'IITD/2024/BTECH/8842',
      digiLockerURI: 'in.gov.digilocker/iitd/DEGREE/8842',
      issuedDate: '2024-06-15',
      schemaVersion: '2.0',
    },
    proof: {
      type: 'Ed25519Signature2020',
      created: '2024-06-15T10:00:00Z',
      verificationMethod: 'did:web:iitd.ac.in#key-1',
      proofPurpose: 'assertionMethod',
      jws: 'mock.jwt.signature',
      merkleRootHash: 'abc123merkle',
    },
  };

  // Disclose only degreeName and institutionName. Hide cgpa and studentRollNo, but prove CGPA >= 7.5
  const presentation = createSelectiveDisclosurePresentation(
    mockVc,
    ['degreeName', 'institutionName'],
    [{ attribute: 'cgpa', threshold: 7.5 }]
  );

  assert.equal(presentation.disclosedAttributes.degreeName, 'B.Tech in Computer Science');
  assert.equal(presentation.disclosedAttributes.institutionName, 'IIT Delhi');
  assert.equal((presentation.disclosedAttributes as Record<string, unknown>)['cgpa'], undefined);
  assert.equal((presentation.disclosedAttributes as Record<string, unknown>)['studentRollNo'], undefined);
  assert.ok(presentation.hiddenAttributes.includes('cgpa'));
  assert.ok(presentation.hiddenAttributes.includes('studentRollNo'));

  assert.equal(presentation.rangeProofs.length, 1);
  assert.equal(presentation.rangeProofs[0]!.isSatisfied, true);
  assert.equal(verifyRangeProof(presentation.rangeProofs[0]!), true);
});

test('checkBitstringRevocation and setRevocationBit manipulate status correctly', () => {
  let bitstring = '00000000'; // 32 bits of 0s (4 bytes)
  assert.equal(checkBitstringRevocation(bitstring, 5), false);
  assert.equal(checkBitstringRevocation(bitstring, 12), false);

  // Revoke index 5
  bitstring = setRevocationBit(bitstring, 5, true);
  assert.equal(checkBitstringRevocation(bitstring, 5), true);
  assert.equal(checkBitstringRevocation(bitstring, 4), false);
  assert.equal(checkBitstringRevocation(bitstring, 6), false);

  // Un-revoke index 5
  bitstring = setRevocationBit(bitstring, 5, false);
  assert.equal(checkBitstringRevocation(bitstring, 5), false);
});

test('validateDigiLockerURI parses Indian e-Governance format properly', () => {
  const valid = validateDigiLockerURI('in.gov.digilocker/iitd/DEGREE/IITD-2024-8842');
  assert.equal(valid.valid, true);
  assert.equal(valid.orgId, 'iitd');
  assert.equal(valid.docType, 'DEGREE');
  assert.equal(valid.docId, 'IITD-2024-8842');

  const invalid = validateDigiLockerURI('https://fake-site.com/doc/123');
  assert.equal(invalid.valid, false);
});
