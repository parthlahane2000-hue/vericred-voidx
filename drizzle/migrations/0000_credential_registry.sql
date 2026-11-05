CREATE TYPE public.app_role AS ENUM ('issuer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- The first account ever created becomes registrar staff; later staff are approved by hand.
CREATE OR REPLACE FUNCTION public.bootstrap_first_issuer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'issuer') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'issuer');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_bootstrap_issuer
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_issuer();

CREATE SEQUENCE public.status_list_index_seq START 200;

CREATE TABLE public.issued_credentials (
  credential_id text PRIMARY KEY,
  doc_id text NOT NULL UNIQUE,
  issuer_did text NOT NULL,
  issuer_name text NOT NULL,
  student_name text NOT NULL,
  degree_name text NOT NULL,
  status_list_index integer NOT NULL DEFAULT nextval('public.status_list_index_seq'),
  document jsonb NOT NULL,
  is_revoked boolean NOT NULL DEFAULT false,
  revocation_reason text,
  revoked_at timestamptz,
  revoked_by text,
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX issued_credentials_doc_id_lower ON public.issued_credentials (lower(doc_id));
CREATE UNIQUE INDEX issued_credentials_id_lower ON public.issued_credentials (lower(credential_id));
GRANT SELECT, INSERT, UPDATE ON public.issued_credentials TO authenticated;
GRANT ALL ON public.issued_credentials TO service_role;
GRANT USAGE ON SEQUENCE public.status_list_index_seq TO authenticated, service_role;
ALTER TABLE public.issued_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Issuers read the registry" ON public.issued_credentials FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'issuer'));
CREATE POLICY "Issuers issue credentials" ON public.issued_credentials FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'issuer') AND issued_by = auth.uid());
CREATE POLICY "Issuers revoke or restore" ON public.issued_credentials FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'issuer')) WITH CHECK (public.has_role(auth.uid(), 'issuer'));

CREATE TABLE public.registry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id text NOT NULL,
  student_name text NOT NULL,
  action text NOT NULL,
  note text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.registry_events TO authenticated;
GRANT ALL ON public.registry_events TO service_role;
ALTER TABLE public.registry_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Issuers read the audit log" ON public.registry_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'issuer'));

-- Only document content and identity columns may be set on insert; revocation goes through updates.
CREATE OR REPLACE FUNCTION public.guard_and_log_credential()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_revoked := false; NEW.revocation_reason := NULL; NEW.revoked_at := NULL; NEW.revoked_by := NULL;
    INSERT INTO public.registry_events (credential_id, student_name, action, actor)
      VALUES (NEW.credential_id, NEW.student_name, 'ISSUED', auth.uid());
    RETURN NEW;
  END IF;
  -- Updates may only change revocation state.
  NEW.credential_id := OLD.credential_id; NEW.doc_id := OLD.doc_id; NEW.document := OLD.document;
  NEW.issuer_did := OLD.issuer_did; NEW.issuer_name := OLD.issuer_name; NEW.student_name := OLD.student_name;
  NEW.degree_name := OLD.degree_name; NEW.status_list_index := OLD.status_list_index;
  NEW.issued_by := OLD.issued_by; NEW.created_at := OLD.created_at;
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
CREATE TRIGGER issued_credentials_guard_and_log
  BEFORE INSERT OR UPDATE ON public.issued_credentials FOR EACH ROW EXECUTE FUNCTION public.guard_and_log_credential();

-- Public lookups: one exact record at a time, never a list.
CREATE OR REPLACE FUNCTION public.lookup_credential(_ref text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'document', document,
    'is_revoked', is_revoked,
    'revocation_reason', revocation_reason,
    'revoked_at', revoked_at
  )
  FROM public.issued_credentials
  WHERE length(trim(_ref)) BETWEEN 4 AND 200
    AND (lower(credential_id) = lower(trim(_ref)) OR lower(doc_id) = lower(trim(_ref)))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.credential_statuses(_ids text[])
RETURNS TABLE (credential_id text, is_revoked boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.credential_id, c.is_revoked FROM public.issued_credentials c
  WHERE cardinality(_ids) <= 100 AND c.credential_id = ANY(_ids)
$$;

CREATE OR REPLACE FUNCTION public.registry_counts()
RETURNS TABLE (total bigint, revoked bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*), count(*) FILTER (WHERE is_revoked) FROM public.issued_credentials
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_credential(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credential_statuses(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registry_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_credential(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credential_statuses(text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registry_counts() TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_issuer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_and_log_credential() FROM PUBLIC, anon, authenticated;