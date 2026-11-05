export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", opts);
}

export function formatDateTime(iso: string) {
  return formatDate(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "Indian Institute of Technology Delhi (IITD)" -> "IITD"; "University of Mumbai" -> "UM" */
export function monogram(name: string) {
  const paren = name.match(/\(([^)]+)\)/);
  if (paren?.[1]) return paren[1].slice(0, 5);
  const words = name.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter((w) => w && !/^(of|the|and|for)$/i.test(w));
  return words.slice(0, 3).map((w) => w.charAt(0).toUpperCase()).join("");
}

export function shortHash(h: string, n = 10) {
  if (!h) return "";
  return h.length <= n * 2 + 1 ? h : `${h.slice(0, n)}…${h.slice(-4)}`;
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const DOC_TYPE_LABEL: Record<string, string> = {
  DEGREE: "Degree",
  MARK_SHEET: "Marksheet",
  SKILL_BADGE: "Skill certificate",
  DIPLOMA: "Diploma",
};
