ALTER TABLE public.issued_credentials ADD COLUMN student_email text;
CREATE INDEX issued_credentials_student_email_lower ON public.issued_credentials (lower(student_email));

-- Signed-in students see only credentials issued to their own (confirmed) email address.
CREATE POLICY "Students read their own credentials" ON public.issued_credentials
  FOR SELECT TO authenticated
  USING (student_email IS NOT NULL AND lower(student_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Only a staff sign-up can claim the very first registrar seat; students never do.
CREATE OR REPLACE FUNCTION public.bootstrap_first_issuer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.raw_user_meta_data ->> 'signup_as', '') = 'staff'
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'issuer') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'issuer');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_and_log_credential()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_revoked := false; NEW.revocation_reason := NULL; NEW.revoked_at := NULL; NEW.revoked_by := NULL;
    NEW.student_email := nullif(lower(trim(NEW.student_email)), '');
    INSERT INTO public.registry_events (credential_id, student_name, action, actor)
      VALUES (NEW.credential_id, NEW.student_name, 'ISSUED', auth.uid());
    RETURN NEW;
  END IF;
  NEW.credential_id := OLD.credential_id; NEW.doc_id := OLD.doc_id; NEW.document := OLD.document;
  NEW.issuer_did := OLD.issuer_did; NEW.issuer_name := OLD.issuer_name; NEW.student_name := OLD.student_name;
  NEW.degree_name := OLD.degree_name; NEW.status_list_index := OLD.status_list_index;
  NEW.issued_by := OLD.issued_by; NEW.created_at := OLD.created_at; NEW.student_email := OLD.student_email;
  IF NEW.is_revoked AND NOT OLD.is_revoked THEN
    IF NEW.revocation_reason IS NULL OR length(trim(NEW.revocation_reason)) < 8 THEN
      RAISE EXCEPTION 'A revocation reason of at least 8 characters is required';
    END IF;
    NEW.revoked_at := now();
    NEW.revoked_by := coalesce(NEW.revoked_by, 'Registrar''s office');
    INSERT INTO public.registry_events (credential_id, student_name, action, note, actor)
      VALUES (NEW.credential_id, NEW.student_name, 'REVOKED', NEW.revocation_reason, auth.uid());
  ELSIF OLD.is_revoked AND NOT NEW.is_revoked THEN
    NEW.revocation_reason := NULL; NEW.revoked_at := NULL; NEW.revoked_by := NULL;
    INSERT INTO public.registry_events (credential_id, student_name, action, actor)
      VALUES (NEW.credential_id, NEW.student_name, 'RESTORED', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_issuer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_and_log_credential() FROM PUBLIC, anon, authenticated;