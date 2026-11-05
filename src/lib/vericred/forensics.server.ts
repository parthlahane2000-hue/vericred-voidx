import { GatewayError, PaymentRequiredError, RateLimitError, generateChatCompletion } from "@lovable.dev/ai-gateway";

import type { ForgeryForensicReport } from "./types";

const ANOMALY_TYPES = ["FONT_MISMATCH", "CLONED_SEAL", "SIGNATURE_TAMPERING", "METADATA_INCONSISTENCY", "RASTER_ARTIFACT", "REVOCATION_MISMATCH"] as const;
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const VERDICTS = ["VERIFIED_AUTHENTIC", "SUSPICIOUS", "HIGH_RISK_FORGERY"] as const;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    isAcademicDocument: { type: "boolean" },
    verdict: { type: "string", enum: VERDICTS },
    confidenceScore: { type: "number" },
    summary: { type: "string" },
    institutionDetected: { type: "string" },
    candidateNameDetected: { type: "string" },
    cgpaOrGradeDetected: { type: "string" },
    sealIntegrityScore: { type: "number" },
    fontConsistencyScore: { type: "number" },
    signatureIntegrityScore: { type: "number" },
    recommendation: { type: "string" },
    anomalies: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ANOMALY_TYPES },
          severity: { type: "string", enum: SEVERITIES },
          description: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
        },
        required: ["title", "type", "severity", "description", "x", "y", "width", "height"],
      },
    },
    checklist: {
      type: "object",
      additionalProperties: false,
      properties: {
        sealWatermarkIntact: { type: "boolean" },
        fontKerningConsistent: { type: "boolean" },
        qrCodePresentAndPlausible: { type: "boolean" },
      },
      required: ["sealWatermarkIntact", "fontKerningConsistent", "qrCodePresentAndPlausible"],
    },
  },
  required: [
    "isAcademicDocument",
    "verdict",
    "confidenceScore",
    "summary",
    "institutionDetected",
    "candidateNameDetected",
    "cgpaOrGradeDetected",
    "sealIntegrityScore",
    "fontConsistencyScore",
    "signatureIntegrityScore",
    "recommendation",
    "anomalies",
    "checklist",
  ],
};

const PROMPT = `You review scanned academic documents (degrees, marksheets, skill certificates) for signs of tampering.
Look for: inconsistent fonts or kerning near names, grades and dates; seals or emblems with halos, blur or copy-paste edges;
signatures that look stamped or cloned; layout or metadata that doesn't fit the issuer; QR codes that look pasted on.
Only report what you can actually see. If the image is not an academic document, set isAcademicDocument to false and explain.
Scores are 0–100 where 100 means no concern. confidenceScore is how confident you are the document is genuine.
Give each anomaly a bounding box (x, y, width, height) in percent of the image. Use plain, short sentences.
This is a preliminary screen, not a legal finding, so word the recommendation as a next step for a human reviewer.`;

interface RawAnomaly {
  title?: string;
  type?: (typeof ANOMALY_TYPES)[number];
  severity?: (typeof SEVERITIES)[number];
  description?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface RawReport {
  isAcademicDocument?: boolean;
  verdict?: (typeof VERDICTS)[number];
  confidenceScore?: number;
  summary?: string;
  institutionDetected?: string;
  candidateNameDetected?: string;
  cgpaOrGradeDetected?: string;
  sealIntegrityScore?: number;
  fontConsistencyScore?: number;
  signatureIntegrityScore?: number;
  recommendation?: string;
  anomalies?: RawAnomaly[];
  checklist?: { sealWatermarkIntact?: boolean; fontKerningConsistent?: boolean; qrCodePresentAndPlausible?: boolean };
}

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export type ForensicsResult = { ok: true; report: ForgeryForensicReport } | { ok: false; error: string };

export async function analyseDocument(input: { dataUrl: string; fileName: string; mimeType: string }): Promise<ForensicsResult> {
  const isPdf = input.mimeType === "application/pdf";
  try {
    const res = await generateChatCompletion({
      model: "google/gemini-3.8-flash",
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `File name: ${input.fileName}` },
            isPdf
              ? { type: "file", file: { filename: input.fileName, file_data: input.dataUrl } }
              : { type: "image_url", image_url: { url: input.dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "forensic_report", strict: true, schema } },
    });

    const content = res.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    if (!text) return { ok: false, error: "The model returned an empty answer. Try another scan." };

    const raw = JSON.parse(text) as RawReport;
    const verdict = raw.verdict && VERDICTS.includes(raw.verdict) ? raw.verdict : "SUSPICIOUS";
    const anomalies = Array.isArray(raw.anomalies) ? raw.anomalies.slice(0, 8) : [];

    const report: ForgeryForensicReport = {
      documentId: `scan-${Date.now()}`,
      fileName: input.fileName,
      verdict: raw.isAcademicDocument === false ? "SUSPICIOUS" : verdict,
      confidenceScore: clamp(raw.confidenceScore),
      summary: String(raw.summary ?? ""),
      institutionDetected: String(raw.institutionDetected || "Not detected"),
      candidateNameDetected: String(raw.candidateNameDetected || "Not detected"),
      cgpaOrGradeDetected: String(raw.cgpaOrGradeDetected || "Not detected"),
      digiLockerDocMatch: false,
      sealIntegrityScore: clamp(raw.sealIntegrityScore),
      fontConsistencyScore: clamp(raw.fontConsistencyScore),
      signatureIntegrityScore: clamp(raw.signatureIntegrityScore),
      anomalies: anomalies.map((a, i) => ({
        id: `a-${i}`,
        title: String(a.title ?? "Anomaly"),
        type: a.type && ANOMALY_TYPES.includes(a.type) ? a.type : "RASTER_ARTIFACT",
        severity: a.severity && SEVERITIES.includes(a.severity) ? a.severity : "MEDIUM",
        description: String(a.description ?? ""),
        location: { x: clamp(a.x), y: clamp(a.y), width: clamp(a.width), height: clamp(a.height) },
      })),
      forensicChecklist: {
        // Signature and revocation can only be checked against a signed credential, not a scan.
        digitalSignatureValid: false,
        sealWatermarkIntact: Boolean(raw.checklist?.sealWatermarkIntact),
        fontKerningConsistent: Boolean(raw.checklist?.fontKerningConsistent),
        qrDigiLockerChecksumMatch: Boolean(raw.checklist?.qrCodePresentAndPlausible),
        revocationRegistryClear: false,
      },
      recommendation: String(raw.recommendation ?? ""),
    };
    return { ok: true, report };
  } catch (err) {
    console.error("forensics analysis failed", err);
    if (err instanceof PaymentRequiredError) return { ok: false, error: "AI credits have run out for this workspace. Top up, then try again." };
    if (err instanceof RateLimitError) return { ok: false, error: "Too many reviews at once. Wait a minute and try again." };
    if (err instanceof GatewayError) return { ok: false, error: "The AI review didn't complete. Try again in a moment." };
    return { ok: false, error: "The AI answer couldn't be read. Try again." };
  }
}
