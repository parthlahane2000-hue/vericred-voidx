export const NAV_ITEMS = [
  { to: "/student", label: "Student portal", hint: "Your issued credentials and proof downloads" },
  { to: "/apply", label: "Apply", hint: "Send your transcript and get a preliminary ID" },
  { to: "/wallet", label: "Wallet", hint: "Student credentials and proofs" },
  { to: "/verify", label: "Employer", hint: "Check a proof or credential ID" },
  { to: "/cross-verify", label: "Cross-check", hint: "Compare a document with the record" },
  { to: "/forensics", label: "Forgery lab", hint: "AI review of an uploaded scan" },
  { to: "/issuer", label: "University", hint: "Issue and revoke credentials" },
  { to: "/explainer", label: "How it works", hint: "The technology, plainly" },
] as const;

export type NavPath = (typeof NAV_ITEMS)[number]["to"];
