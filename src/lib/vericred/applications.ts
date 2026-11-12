import { supabase } from "@/integrations/supabase/client";

export interface ApplicationForm {
  studentName: string;
  rollNo: string;
  institutionName: string;
  degreeName: string;
  major: string;
  graduationYear: string;
  cgpa: string;
}

export interface ApplicationRow {
  id: string;
  preliminaryId: string;
  applicantEmail: string;
  studentName: string;
  rollNo: string;
  institutionName: string;
  degreeName: string;
  major: string;
  graduationYear: number;
  cgpa: number;
  transcriptPath: string;
  transcriptName: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  reviewerNote: string | null;
  createdAt: string;
}

export const MAX_TRANSCRIPT_BYTES = 10 * 1024 * 1024;
export const TRANSCRIPT_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/** Returns an error message per invalid field; empty object means the application can be sent. */
export function validateApplication(f: ApplicationForm, file: { size: number; type: string } | null): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.studentName.trim().length < 2) e["studentName"] = "Enter your full name.";
  if (!f.rollNo.trim()) e["rollNo"] = "Enter your roll number.";
  if (!f.institutionName.trim()) e["institutionName"] = "Enter your university.";
  if (!f.degreeName.trim()) e["degreeName"] = "Enter the degree.";
  if (!f.major.trim()) e["major"] = "Enter your major.";
  const y = Number(f.graduationYear);
  if (!Number.isInteger(y) || y < 1950 || y > 2100) e["graduationYear"] = "Enter a year like 2026.";
  const c = Number(f.cgpa);
  if (f.cgpa.trim() === "" || !Number.isFinite(c) || c < 0 || c > 10) e["cgpa"] = "CGPA must be between 0 and 10.";
  if (!file) e["transcript"] = "Attach your transcript.";
  else if (!TRANSCRIPT_TYPES.includes(file.type)) e["transcript"] = "Use a PDF, PNG or JPG.";
  else if (file.size > MAX_TRANSCRIPT_BYTES) e["transcript"] = "The file must be 10 MB or smaller.";
  return e;
}

type Raw = Record<string, unknown>;
const toRow = (r: Raw): ApplicationRow => ({
  id: r["id"] as string,
  preliminaryId: r["preliminary_id"] as string,
  applicantEmail: r["applicant_email"] as string,
  studentName: r["student_name"] as string,
  rollNo: r["roll_no"] as string,
  institutionName: r["institution_name"] as string,
  degreeName: r["degree_name"] as string,
  major: r["major"] as string,
  graduationYear: r["graduation_year"] as number,
  cgpa: Number(r["cgpa"]),
  transcriptPath: r["transcript_path"] as string,
  transcriptName: r["transcript_name"] as string,
  status: r["status"] as ApplicationRow["status"],
  reviewerNote: (r["reviewer_note"] as string | null) ?? null,
  createdAt: r["created_at"] as string,
});

export async function submitApplication(userId: string, email: string, f: ApplicationForm, file: File): Promise<ApplicationRow> {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("transcripts").upload(path, file, { contentType: file.type });
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
  const { data, error } = await supabase
    .from("credential_applications")
    .insert({
      applicant_id: userId,
      applicant_email: email,
      student_name: f.studentName.trim(),
      roll_no: f.rollNo.trim(),
      institution_name: f.institutionName.trim(),
      degree_name: f.degreeName.trim(),
      major: f.major.trim(),
      graduation_year: Number(f.graduationYear),
      cgpa: Number(f.cgpa),
      transcript_path: path,
      transcript_name: file.name.slice(0, 200),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toRow(data as Raw);
}

export async function listMyApplications(userId: string): Promise<ApplicationRow[]> {
  const { data, error } = await supabase.from("credential_applications").select("*").eq("applicant_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Raw[]).map(toRow);
}

export async function listAllApplications(): Promise<ApplicationRow[]> {
  const { data, error } = await supabase.from("credential_applications").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data as Raw[]).map(toRow);
}

export async function reviewApplication(id: string, status: "APPROVED" | "REJECTED", note: string | null) {
  const { error } = await supabase.from("credential_applications").update({ status, reviewer_note: note }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function transcriptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("transcripts").createSignedUrl(path, 300);
  if (error || !data) throw new Error(error?.message ?? "Couldn't open the transcript.");
  return data.signedUrl;
}
