import type { W3CVerifiableCredential } from "@/lib/vericred/types";
import { DOC_TYPE_LABEL, formatDate, monogram } from "@/lib/vericred/format";
import { cn } from "@/lib/utils";
import { Monogram, StatusMark } from "@/components/site/primitives";

export function credentialState(c: W3CVerifiableCredential, revoked: boolean) {
  if (revoked) return { tone: "destructive" as const, label: "Revoked" };
  if (c.expirationDate && new Date(c.expirationDate).getTime() < Date.now()) return { tone: "warning" as const, label: "Expired" };
  return { tone: "success" as const, label: "Valid" };
}

/** Compact, document-like rendering of a credential. */
export function CredentialSlip({
  credential,
  revoked,
  className,
}: {
  credential: W3CVerifiableCredential;
  revoked: boolean;
  className?: string;
}) {
  const s = credential.credentialSubject;
  const state = credentialState(credential, revoked);
  return (
    <article className={cn("sheet relative p-6", revoked && "bg-destructive-soft/50", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Monogram text={monogram(credential.issuer.name)} className="size-10 text-xs" />
          <div className="min-w-0">
            <p className="kicker">{DOC_TYPE_LABEL[credential.digiLockerMetadata.docType] ?? credential.digiLockerMetadata.docType}</p>
            <p className="truncate text-sm text-muted-foreground">{credential.digiLockerMetadata.orgName}</p>
          </div>
        </div>
        <StatusMark tone={state.tone}>{state.label}</StatusMark>
      </div>
      <h3 className="mt-6 text-2xl leading-snug">{s.degreeName}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{s.major}</p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-border pt-4">
        <p className="text-sm">{s.studentName}</p>
        <p className="datum text-muted-foreground">
          {credential.digiLockerMetadata.docId} · {formatDate(credential.issuanceDate, { year: "numeric", month: "short" })}
        </p>
      </div>
    </article>
  );
}
