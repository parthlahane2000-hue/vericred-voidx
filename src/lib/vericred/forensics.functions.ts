import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { analyseDocument } from "./forensics.server";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
const MAX_DATA_URL = 7_000_000; // ~5 MB file once base64-encoded

const Input = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED),
  dataUrl: z
    .string()
    .max(MAX_DATA_URL, "File is too large (5 MB max)")
    .regex(/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/, "Unsupported file"),
});

export const analyseScan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => analyseDocument(data));
