import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, StatusMark } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAllApplications, reviewApplication, transcriptUrl, type ApplicationRow } from "@/lib/vericred/applications";
import { formatDateTime } from "@/lib/vericred/format";

export const APP_STATUS: Record<ApplicationRow["status"], { label: string; tone: "warning" | "success" | "destructive" }> = {
  SUBMITTED: { label: "Awaiting review", tone: "warning" },
  APPROVED: { label: "Approved for issue", tone: "success" },
  REJECTED: { label: "Not approved", tone: "destructive" },
};

export async function openTranscript(path: string) {
  try {
    window.open(await transcriptUrl(path), "_blank", "noopener");
  } catch (e) {
    toast.error((e as Error).message);
  }
}

export function ApplicationsReview() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["applications", "all"], queryFn: listAllApplications });
  const review = useMutation({
    mutationFn: (v: { id: string; status: "APPROVED" | "REJECTED"; note: string | null }) => reviewApplication(v.id, v.status, v.note),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["applications"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const rows = q.data ?? [];
  return (
    <section className="mt-10">
      <p className="max-w-md text-sm text-muted-foreground">
        Students apply with a transcript and get a preliminary ID. Approving doesn't issue anything — issue the credential from the "Issue" tab once the transcript checks out.
      </p>
      {q.isPending && <p className="kicker py-10">Loading applications…</p>}
      {q.isError && <p className="py-10 text-destructive">{(q.error as Error).message}</p>}
      {q.isSuccess && rows.length === 0 && <p className="py-10 text-muted-foreground">No applications yet.</p>}
      <ol className="mt-6 border-t border-foreground">
        {rows.map((r) => (
          <ReviewRow key={r.id} r={r} busy={review.isPending} onDecide={(status, note) => review.mutate({ id: r.id, status, note })} />
        ))}
      </ol>
    </section>
  );
}

function ReviewRow({ r, busy, onDecide }: { r: ApplicationRow; busy: boolean; onDecide: (s: "APPROVED" | "REJECTED", note: string | null) => void }) {
  const [note, setNote] = useState(r.reviewerNote ?? "");
  const s = APP_STATUS[r.status];
  return (
    <li className="grid grid-cols-12 gap-x-4 gap-y-4 border-b border-border py-8 md:gap-x-8">
      <div className="col-span-12 min-w-0 lg:col-span-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="datum">{r.preliminaryId}</span>
          <StatusMark tone={s.tone}>{s.label}</StatusMark>
        </div>
        <h3 className="mt-2 text-2xl leading-tight">{r.studentName} — {r.degreeName}, {r.major}</h3>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Field label="University">{r.institutionName}</Field>
          <Field label="Roll no.">{r.rollNo}</Field>
          <Field label="Claimed CGPA">{r.cgpa}</Field>
          <Field label="Graduation">{r.graduationYear}</Field>
          <Field label="Email" className="col-span-2 min-w-0 break-all">{r.applicantEmail}</Field>
          <Field label="Received">{formatDateTime(r.createdAt)}</Field>
        </dl>
      </div>
      <div className="col-span-12 flex min-w-0 flex-col items-start gap-3 lg:col-span-4 lg:col-start-9">
        <Button variant="outline" onClick={() => void openTranscript(r.transcriptPath)}>
          <FileText className="size-4" /> Open transcript
        </Button>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the student (optional)" maxLength={300} />
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => onDecide("APPROVED", note.trim() || null)}>Approve</Button>
          <Button variant="outline" disabled={busy} onClick={() => onDecide("REJECTED", note.trim() || null)}>Decline</Button>
        </div>
      </div>
    </li>
  );
}
