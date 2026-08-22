ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS admin_password_plain text NOT NULL DEFAULT '';

DROP FUNCTION IF EXISTS public.admin_list_apps(text);

CREATE FUNCTION public.admin_list_apps(_admin_password text)
 RETURNS TABLE(id uuid, name text, description text, url text, icon text, category text, accent text, sort_order integer, is_active boolean, password_plain text, admin_password_plain text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.admin_check(_admin_password) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT a.id, a.name, a.description, a.url, a.icon, a.category, a.accent,
         a.sort_order, a.is_active, a.password_plain, a.admin_password_plain
  FROM public.apps a ORDER BY a.sort_order ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_upsert_app(_admin_password text, _id uuid, _name text, _description text, _url text, _icon text, _category text, _accent text, _sort_order integer, _is_active boolean, _password text, _app_admin_password text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE _salt text; _new_id uuid;
BEGIN
  IF NOT public.admin_check(_admin_password) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  _salt := gen_random_uuid()::text;

  IF _id IS NULL THEN
    IF _password IS NULL OR length(_password) < 1 THEN
      RAISE EXCEPTION 'A password is required for a new application';
    END IF;
    INSERT INTO public.apps (name, description, url, icon, category, accent, sort_order,
                             is_active, password_salt, password_hash, password_plain, admin_password_plain)
    VALUES (_name, _description, _url, _icon, _category, _accent, _sort_order, _is_active,
            _salt, encode(digest(_salt || _password, 'sha256'), 'hex'), _password, coalesce(_app_admin_password, ''))
    RETURNING id INTO _new_id;
    RETURN _new_id;
  END IF;

  UPDATE public.apps SET
    name = _name, description = _description, url = _url, icon = _icon, category = _category,
    accent = _accent, sort_order = _sort_order, is_active = _is_active,
    admin_password_plain = coalesce(_app_admin_password, admin_password_plain),
    password_salt = CASE WHEN _password IS NULL OR _password = '' THEN password_salt ELSE _salt END,
    password_hash = CASE WHEN _password IS NULL OR _password = '' THEN password_hash
                         ELSE encode(digest(_salt || _password, 'sha256'), 'hex') END,
    password_plain = CASE WHEN _password IS NULL OR _password = '' THEN password_plain ELSE _password END
  WHERE id = _id;
  RETURN _id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_apps(text) TO anon, authenticated;