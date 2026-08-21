CREATE OR REPLACE VIEW public.public_apps AS
SELECT
  id,
  name,
  description,
  url,
  icon,
  category,
  accent,
  sort_order,
  is_active,
  password_plain
FROM public.apps
WHERE is_active = true;

GRANT SELECT ON public.public_apps TO anon;
GRANT SELECT ON public.public_apps TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_app_password(_app_id uuid, _password text)
RETURNS TABLE(url text, ok boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.url, (a.password_plain = _password) AS ok
  FROM public.apps a
  WHERE a.id = _app_id AND a.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.verify_app_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_app_password(uuid, text) TO authenticated;