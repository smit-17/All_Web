DROP VIEW IF EXISTS public.public_apps;

GRANT SELECT(id, name, description, url, icon, category, accent, sort_order, is_active, password_plain) ON public.apps TO anon;
GRANT SELECT(id, name, description, url, icon, category, accent, sort_order, is_active, password_plain) ON public.apps TO authenticated;

CREATE POLICY "Public can view active apps" ON public.apps FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Signed-in users can view active apps" ON public.apps FOR SELECT TO authenticated USING (is_active = true);

DROP FUNCTION IF EXISTS public.verify_app_password(uuid, text);

CREATE OR REPLACE FUNCTION public.verify_app_password(_app_id uuid, _password text)
RETURNS TABLE(url text, ok boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT a.url, (a.password_plain = _password) AS ok
  FROM public.apps a
  WHERE a.id = _app_id AND a.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.verify_app_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_app_password(uuid, text) TO authenticated;