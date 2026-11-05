<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (VeriCred)

- Issued credentials, revocation state and the audit log live in the database (`issued_credentials`, `registry_events`); all access goes through `src/lib/vericred/registry.ts` — one source of truth that employers and staff share.
- Public reads use only the exact-match RPCs (`lookup_credential`, `credential_statuses`, `registry_counts`); the tables are readable/writable only by users with the `issuer` role, and a trigger writes the audit log and blocks edits other than revoke/restore — prevents enumeration and tampering.
- The first account ever created becomes an issuer (bootstrap trigger); later staff need a `user_roles` row added by hand — no self-service escalation.
- Wallet copies, employer checks and scans stay in the browser context in `src/lib/vericred/store.tsx` (localStorage after mount), with revoked status fetched live from the database — avoids hydration mismatches.
- Verification outcomes are decided only by `verifyPresentation` / `verifyByReference` in `src/lib/vericred/verify.ts`, with tests beside it — one source of truth for Verified / Invalid signature / Revoked / Expired / Failed.
- Proofs and signatures are a labelled hash-based simulation (`zkp.ts`); UI must keep the "simulated" notices — the brief forbids claiming real cryptography, DigiLocker or blockchain calls.
- AI document review runs only in `forensics.server.ts` behind the `analyseScan` server function, and results are always shown as preliminary — keeps prompts server-side and avoids presenting AI output as proof.
- Each section is its own route; shared layout (header, footer, provider) is in `__root.tsx` — real URLs per section for sharing and SEO.
- Styling uses semantic tokens and utilities from `src/styles.css` only (no raw colour classes in components); grids use `gap-x-4 md:gap-x-8` so 12-column layouts never overflow on phones.
