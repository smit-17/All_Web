CREATE TABLE IF NOT EXISTS public.admin_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  password text NOT NULL
);
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.admin_config TO service_role;
INSERT INTO public.admin_config (id, password) VALUES (true, 'lepdo-admin')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_check(_admin_password text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_config c WHERE c.password = _admin_password);
$$;

CREATE OR REPLACE FUNCTION public.admin_list_apps(_admin_password text)
RETURNS TABLE(id uuid, name text, description text, url text, icon text, category text,
              accent text, sort_order integer, is_active boolean, password_plain text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.admin_check(_admin_password) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT a.id, a.name, a.description, a.url, a.icon, a.category, a.accent,
         a.sort_order, a.is_active, a.password_plain
  FROM public.apps a ORDER BY a.sort_order ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_app(
  _admin_password text, _id uuid, _name text, _description text, _url text, _icon text,
  _category text, _accent text, _sort_order integer, _is_active boolean, _password text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _salt text; _new_id uuid;
BEGIN
  IF NOT public.admin_check(_admin_password) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  _salt := gen_random_uuid()::text;

  IF _id IS NULL THEN
    IF _password IS NULL OR length(_password) < 1 THEN
      RAISE EXCEPTION 'A password is required for a new application';
    END IF;
    INSERT INTO public.apps (name, description, url, icon, category, accent, sort_order,
                             is_active, password_salt, password_hash, password_plain)
    VALUES (_name, _description, _url, _icon, _category, _accent, _sort_order, _is_active,
            _salt, encode(digest(_salt || _password, 'sha256'), 'hex'), _password)
    RETURNING id INTO _new_id;
    RETURN _new_id;
  END IF;

  UPDATE public.apps SET
    name = _name, description = _description, url = _url, icon = _icon, category = _category,
    accent = _accent, sort_order = _sort_order, is_active = _is_active,
    password_salt = CASE WHEN _password IS NULL OR _password = '' THEN password_salt ELSE _salt END,
    password_hash = CASE WHEN _password IS NULL OR _password = '' THEN password_hash
                         ELSE encode(digest(_salt || _password, 'sha256'), 'hex') END,
    password_plain = CASE WHEN _password IS NULL OR _password = '' THEN password_plain ELSE _password END
  WHERE id = _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_app(_admin_password text, _id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.admin_check(_admin_password) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.apps WHERE id = _id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_check(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_apps(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_app(text, uuid, text, text, text, text, text, text, integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_app(text, uuid) TO anon, authenticated;