import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, FileText, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Container, Field, Notice, PageIntro, SectionLabel, StatusMark } from "@/components/site/primitives";
import { APP_STATUS, openTranscript } from "@/components/vericred/ApplicationsReview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMyApplications, submitApplication, validateApplication, type ApplicationForm, type ApplicationRow } from "@/lib/vericred/applications";
import { formatDateTime } from "@/lib/vericred/format";

export const Route = createFileRoute("/_authenticated/apply")({
  head: () => ({
    meta: [
      { title: "Apply for a credential — VeriCred" },
      { name: "description", content: "Send your transcript to the registrar and get a preliminary credential ID while it's reviewed." },
      { property: "og:title", content: "Apply for a credential — VeriCred" },
      { property: "og:description", content: "Upload a transcript, get a preliminary ID, follow the review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplyPage,
});

const EMPTY: ApplicationForm = { studentName: "", rollNo: "", institutionName: "", degreeName: "", major: "", graduationYear: "", cgpa: "" };
const FIELDS: [keyof ApplicationForm, string, string][] = [
  ["studentName", "Full name", "As printed on your transcript"],
  ["rollNo", "Roll number", "e.g. 21CS044"],
  ["institutionName", "University", "e.g. IIT Delhi"],
  ["degreeName", "Degree", "e.g. B.Tech"],
  ["major", "Major", "e.g. Computer Science"],
  ["graduationYear", "Graduation year", "2026"],
  ["cgpa", "CGPA (out of 10)", "8.4"],
];

function ApplyPage() {
  const { user } = Route.useRouteContext();
  const email = user.email ?? "";
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["applications", "mine", user.id], queryFn: () => listMyApplications(user.id) });
  const [form, setForm] = useState<ApplicationForm>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<ApplicationRow | null>(null);

  const send = useMutation({
    mutationFn: () => submitApplication(user.id, email, form, file!),
    onSuccess: (row) => {
      setFresh(row);
      setForm(EMPTY);
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateApplication(form, file);
    setErrors(errs);
    if (Object.keys(errs).length === 0) send.mutate();
  };

  const apps = mine.data ?? [];

  return (
    <>
      <PageIntro
        number="07"
        kicker="Candidate portal"
        title={<>Apply now. <span className="italic">Get a reference</span> straight away.</>}
        dek="Send your transcript to the registrar. You get a preliminary ID the moment it's received — quote it when you follow up. It isn't a credential until the university issues one."
        aside={
          <dl className="grid grid-cols-2 gap-6 border-t border-border pt-4">
            <div><dt className="kicker">Applications</dt><dd className="mt-1 font-display text-3xl">{mine.isPending ? "—" : apps.length}</dd></div>
            <div><dt className="kicker">Awaiting review</dt><dd className="mt-1 font-display text-3xl">{mine.isPending ? "—" : apps.filter((a) => a.status === "SUBMITTED").length}</dd></div>
          </dl>
        }
      />
      <Container>
        <div className="grid grid-cols-12 gap-x-4 gap-y-12 md:gap-x-8">
          <form onSubmit={onSubmit} noValidate className="col-span-12 min-w-0 lg:col-span-7">
            <SectionLabel>Your application</SectionLabel>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              {FIELDS.map(([k, label, ph]) => (
                <label key={k} className={k === "studentName" ? "sm:col-span-2" : undefined}>
                  <span className="text-sm font-medium">{label}</span>
                  <Input className="mt-2" value={form[k]} placeholder={ph} inputMode={k === "cgpa" ? "decimal" : k === "graduationYear" ? "numeric" : undefined}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} aria-invalid={!!errors[k]} />
                  {errors[k] && <span className="mt-1 block text-sm text-destructive">{errors[k]}</span>}
                </label>
              ))}
              <div className="sm:col-span-2">
                <span className="text-sm font-medium">Transcript</span>
                <label className="mt-2 flex cursor-pointer flex-wrap items-center gap-3 border border-dashed border-border px-4 py-6 hover:border-foreground">
                  <Upload className="size-4 shrink-0" />
                  <span className="min-w-0 break-all text-sm">{file ? file.name : "Choose a PDF, PNG or JPG (10 MB max)"}</span>
                  <input type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                {errors["transcript"] && <span className="mt-1 block text-sm text-destructive">{errors["transcript"]}</span>}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={send.isPending}>{send.isPending ? "Sending…" : "Send application"}</Button>
              <span className="datum min-w-0 break-all text-muted-foreground">Updates go to {email}</span>
            </div>
          </form>

          <aside className="col-span-12 min-w-0 lg:col-span-4 lg:col-start-9">
            {fresh ? (
              <div className="border-t-2 border-accent pt-6">
                <SectionLabel>Received — your preliminary ID</SectionLabel>
                <p className="datum mt-3 break-all text-2xl">{fresh.preliminaryId}</p>
                <Button variant="outline" className="mt-4" onClick={() => void navigator.clipboard.writeText(fresh.preliminaryId).then(() => toast.success("Copied"))}>
                  <Copy className="size-4" /> Copy ID
                </Button>
                <p className="mt-4 text-sm text-muted-foreground">This is a reference for your application only. Employers can't verify it — they'll check the credential once it's issued.</p>
              </div>
            ) : (
              <Notice title="What happens next">
                The registrar checks your transcript against their records. If approved, they issue the credential to this email and it appears in your Student portal.
              </Notice>
            )}
          </aside>
        </div>

        <section className="mt-20">
          <SectionLabel>Your applications</SectionLabel>
          {mine.isPending && <p className="kicker py-8">Loading…</p>}
          {mine.isError && <p className="py-8 text-destructive">{(mine.error as Error).message}</p>}
          {mine.isSuccess && apps.length === 0 && <p className="py-8 text-muted-foreground">Nothing sent yet.</p>}
          <ol className="mt-4 border-t border-foreground">
            {apps.map((a) => (
              <li key={a.id} className="grid grid-cols-12 gap-x-4 gap-y-4 border-b border-border py-6 md:gap-x-8">
                <div className="col-span-12 min-w-0 lg:col-span-7">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="datum break-all">{a.preliminaryId}</span>
                    <StatusMark tone={APP_STATUS[a.status].tone}>{APP_STATUS[a.status].label}</StatusMark>
                  </div>
                  <h3 className="mt-2 text-2xl leading-tight">{a.degreeName}, {a.major}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{a.institutionName} · sent {formatDateTime(a.createdAt)}</p>
                  {a.reviewerNote && <p className="mt-3 border-l-2 border-border pl-4 text-sm">Registrar: {a.reviewerNote}</p>}
                </div>
                <div className="col-span-12 min-w-0 lg:col-span-4 lg:col-start-9">
                  <dl className="grid grid-cols-2 gap-4"><Field label="Claimed CGPA">{a.cgpa}</Field><Field label="Graduation">{a.graduationYear}</Field></dl>
                  <Button variant="ghost" className="mt-3 px-0" onClick={() => void openTranscript(a.transcriptPath)}>
                    <FileText className="size-4" /> <span className="min-w-0 truncate">{a.transcriptName}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </Container>
    </>
  );
}
