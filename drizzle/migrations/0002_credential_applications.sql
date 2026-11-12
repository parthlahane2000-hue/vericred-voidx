CREATE TABLE public.credential_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preliminary_id text NOT NULL UNIQUE DEFAULT ('PRE-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  applicant_id uuid NOT NULL DEFAULT auth.uid(),
  applicant_email text NOT NULL,
  student_name text NOT NULL,
  roll_no text NOT NULL,
  institution_name text NOT NULL,
  degree_name text NOT NULL,
  major text NOT NULL,
  graduation_year integer NOT NULL,
  cgpa numeric(4,2) NOT NULL,
  transcript_path text NOT NULL,
  transcript_name text NOT NULL,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','APPROVED','REJECTED')),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.credential_applications TO authenticated;
GRANT ALL ON public.credential_applications TO service_role;
ALTER TABLE public.credential_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicants read own applications" ON public.credential_applications FOR SELECT TO authenticated USING (applicant_id = auth.uid());
CREATE POLICY "Applicants submit applications" ON public.credential_applications FOR INSERT TO authenticated WITH CHECK (applicant_id = auth.uid() AND status = 'SUBMITTED' AND transcript_path LIKE auth.uid()::text || '/%');
CREATE POLICY "Issuers read applications" ON public.credential_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'issuer'));
CREATE POLICY "Issuers review applications" ON public.credential_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'issuer')) WITH CHECK (public.has_role(auth.uid(),'issuer'));

CREATE OR REPLACE FUNCTION public.guard_application() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.applicant_email := lower(trim(NEW.applicant_email));
    NEW.reviewer_note := NULL; NEW.reviewed_at := NULL; NEW.status := 'SUBMITTED';
    IF NEW.cgpa < 0 OR NEW.cgpa > 10 THEN RAISE EXCEPTION 'CGPA must be between 0 and 10'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.preliminary_id <> OLD.preliminary_id OR NEW.applicant_id <> OLD.applicant_id OR NEW.transcript_path <> OLD.transcript_path
     OR NEW.student_name <> OLD.student_name OR NEW.cgpa <> OLD.cgpa OR NEW.degree_name <> OLD.degree_name THEN
    RAISE EXCEPTION 'Only the review decision can change';
  END IF;
  NEW.reviewed_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER guard_application BEFORE INSERT OR UPDATE ON public.credential_applications FOR EACH ROW EXECUTE FUNCTION public.guard_application();

CREATE POLICY "Applicants upload own transcripts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'transcripts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Applicants read own transcripts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'transcripts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Issuers read transcripts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'transcripts' AND public.has_role(auth.uid(),'issuer'));