import { describe, expect, it } from "vitest";
import { validateApplication, type ApplicationForm } from "./applications";

const ok: ApplicationForm = { studentName: "Riya Patel", rollNo: "21CS044", institutionName: "IIT Delhi", degreeName: "B.Tech", major: "CS", graduationYear: "2026", cgpa: "8.4" };
const pdf = { size: 1000, type: "application/pdf" };

describe("validateApplication", () => {
  it("accepts a complete application with a PDF transcript", () => expect(validateApplication(ok, pdf)).toEqual({}));
  it("requires a transcript", () => expect(validateApplication(ok, null)["transcript"]).toBeDefined());
  it("rejects transcripts over 10 MB", () => expect(validateApplication(ok, { size: 10 * 1024 * 1024 + 1, type: "application/pdf" })["transcript"]).toBeDefined());
  it("rejects CGPA above 10", () => expect(validateApplication({ ...ok, cgpa: "10.5" }, pdf)["cgpa"]).toBeDefined());
});
