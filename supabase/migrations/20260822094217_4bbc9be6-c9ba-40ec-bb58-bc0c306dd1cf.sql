CREATE OR REPLACE FUNCTION public.admin_login(_password text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_config c WHERE c.password = _password);
$$;
GRANT EXECUTE ON FUNCTION public.admin_login(text) TO anon, authenticated;