import type { RegistryRecord } from "./registry";
import { DOC_TYPE_LABEL } from "./format";

/** Keep only characters the built-in PDF fonts can draw. */
const safe = (v: unknown) =>
  String(v ?? "")
    .replace(/[≥]/g, ">=")
    .replace(/[≤]/g, "<=")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "");

/** Build a one-page proof document for a credential, generated in the browser. */
export async function buildProofPdf(record: RegistryRecord, verifyUrl: string): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const c = record.credential;
  const s = c.credentialSubject;
  const doc = await PDFDocument.create();
  doc.setTitle(`VeriCred proof - ${s.studentName} - ${c.digiLockerMetadata.docId}`);
  doc.setAuthor(c.issuer.name);
  const page = doc.addPage([595.28, 841.89]);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const navy = rgb(0.078, 0.169, 0.29);
  const blue = rgb(0.145, 0.388, 0.922);
  const muted = rgb(0.29, 0.357, 0.451);
  const red = rgb(0.72, 0.16, 0.12);
  const green = rgb(0.13, 0.45, 0.28);
  const margin = 56;
  const width = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const wrap = (text: string, font: typeof sans, size: number, max: number) => {
    const words = safe(text).split(/(\s+)/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line + w;
      if (font.widthOfTextAtSize(next, size) > max && line.trim()) {
        lines.push(line.trimEnd());
        line = w.trimStart();
        // Break very long tokens (hashes, IDs)
        while (font.widthOfTextAtSize(line, size) > max) {
          let i = line.length;
          while (i > 1 && font.widthOfTextAtSize(line.slice(0, i), size) > max) i--;
          lines.push(line.slice(0, i));
          line = line.slice(i);
        }
      } else line = next;
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines;
  };
  const text = (t: string, opts: { font?: typeof sans; size?: number; color?: ReturnType<typeof rgb>; x?: number; max?: number; gap?: number } = {}) => {
    const font = opts.font ?? sans;
    const size = opts.size ?? 10;
    for (const l of wrap(t, font, size, opts.max ?? width)) {
      page.drawText(l, { x: opts.x ?? margin, y: y - size, size, font, color: opts.color ?? navy });
      y -= size * 1.35;
    }
    y -= opts.gap ?? 0;
  };
  const rule = (thick = 0.5, color = navy) => {
    page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: thick, color });
    y -= 14;
  };
  const label = (t: string) => text(t.toUpperCase(), { font: sansBold, size: 7.5, color: muted, gap: 2 });

  // Masthead
  text("VeriCred", { font: serifItalic, size: 22, gap: 2 });
  text("Proof of academic credential", { font: sans, size: 9, color: muted, gap: 8 });
  rule(1.2);

  // Status
  const revoked = record.isRevoked;
  const expired = !!c.expirationDate && new Date(c.expirationDate).getTime() < Date.now();
  const status = revoked ? "REVOKED" : expired ? "EXPIRED" : "ACTIVE";
  const statusColor = revoked ? red : expired ? muted : green;
  page.drawRectangle({ x: margin, y: y - 26, width: sansBold.widthOfTextAtSize(status, 11) + 24, height: 26, borderColor: statusColor, borderWidth: 1.5 });
  page.drawText(status, { x: margin + 12, y: y - 17.5, size: 11, font: sansBold, color: statusColor });
  const asOf = `Registry status as of ${new Date().toUTCString()}`;
  page.drawText(safe(asOf), { x: margin + sansBold.widthOfTextAtSize(status, 11) + 40, y: y - 17, size: 9, font: sans, color: muted });
  y -= 40;
  if (revoked) {
    text(`Revoked${record.revokedAt ? ` on ${new Date(record.revokedAt).toDateString()}` : ""}: ${record.revocationReason ?? "No reason given"}`, {
      size: 10,
      color: red,
      gap: 6,
    });
  }

  // Credential
  label(DOC_TYPE_LABEL[c.digiLockerMetadata.docType] ?? "Credential");
  text(s.degreeName, { font: serif, size: 24, gap: 0 });
  text(s.major, { font: serif, size: 13, color: muted, gap: 10 });

  const pairs: [string, string][] = [
    ["Holder", s.studentName],
    ["Roll / registration no.", s.studentRollNo],
    ["Institution", s.institutionName],
    ["Issued by", c.issuer.name],
    ["Graduation year", String(s.graduationYear)],
    ["CGPA", `${s.cgpa} / ${s.cgpaScale}`],
    ["Honours", s.honours ?? "-"],
    ["Issued on", new Date(c.issuanceDate).toDateString()],
  ];
  const colW = (width - 24) / 2;
  for (let i = 0; i < pairs.length; i += 2) {
    const top = y;
    let low = y;
    pairs.slice(i, i + 2).forEach(([k, v], j) => {
      y = top;
      const x = margin + j * (colW + 24);
      page.drawText(safe(k).toUpperCase(), { x, y: y - 7.5, size: 7.5, font: sansBold, color: muted });
      y -= 12;
      for (const l of wrap(v, sans, 11, colW)) {
        page.drawText(l, { x, y: y - 11, size: 11, font: sans, color: navy });
        y -= 14.5;
      }
      low = Math.min(low, y);
    });
    y = low - 8;
  }
  y -= 4;
  rule();

  // Identifiers and signature
  label("Credential ID");
  text(c.id, { font: mono, size: 8.5, gap: 6 });
  label("Document ID");
  text(c.digiLockerMetadata.docId, { font: mono, size: 8.5, gap: 6 });
  label("Signature");
  text(`${c.proof.type} - ${c.proof.verificationMethod}`, { font: mono, size: 8.5, gap: 2 });
  text(c.proof.jws, { font: mono, size: 7.5, color: muted, gap: 6 });
  label("Record hash (Merkle root)");
  text(c.proof.merkleRootHash, { font: mono, size: 8.5, gap: 10 });
  rule();

  // How to verify
  label("How to verify");
  text(`Open ${verifyUrl}, choose "Look up an ID" and enter the document ID above. The registry answers with the live status, so a revocation after this date will show there.`, {
    size: 10,
    gap: 4,
  });
  text(verifyUrl, { font: mono, size: 9, color: blue, gap: 0 });

  // Footer
  const foot =
    "Prototype notice: signatures and proofs in VeriCred are a hash-based simulation, not production cryptography. No DigiLocker or blockchain service was contacted.";
  y = margin + 30;
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: margin + width, y: y + 8 }, thickness: 0.5, color: muted });
  text(foot, { size: 7.5, color: muted });

  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
