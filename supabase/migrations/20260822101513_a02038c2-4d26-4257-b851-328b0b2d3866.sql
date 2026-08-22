CREATE OR REPLACE FUNCTION public.admin_change_password(_admin_password text, _new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.admin_check(_admin_password) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _new_password IS NULL OR length(_new_password) < 4 THEN
    RAISE EXCEPTION 'New password must be at least 4 characters';
  END IF;
  UPDATE public.admin_config SET password = _new_password;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_change_password(text, text) TO anon, authenticated;