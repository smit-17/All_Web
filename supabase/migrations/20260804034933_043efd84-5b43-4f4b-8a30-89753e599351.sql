CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  icon text NOT NULL DEFAULT 'AppWindow',
  category text NOT NULL DEFAULT 'General',
  accent text NOT NULL DEFAULT 'gold',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  password_salt text NOT NULL DEFAULT gen_random_uuid()::text,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.apps TO service_role;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER apps_set_updated_at BEFORE UPDATE ON public.apps
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.apps (name, description, url, icon, category, sort_order, password_salt, password_hash)
SELECT s.name, s.description, s.url, s.icon, s.category, s.sort_order, salt.v,
       encode(digest(salt.v || 'lepdo123', 'sha256'), 'hex')
FROM (VALUES
  ('Calculator', 'Quick pricing and margin calculations for diamonds and jewellery.', 'https://example.com/calculator', 'Calculator', 'Tools', 1),
  ('Lead Manager', 'Track enquiries, follow-ups and customer pipeline in one place.', 'https://example.com/leads', 'Users', 'Sales', 2),
  ('Website', 'Manage the public LEPDO website content and pages.', 'https://example.com/website', 'Globe', 'Marketing', 3),
  ('Price List', 'Live wholesale and retail price sheets for all product lines.', 'https://example.com/prices', 'Tags', 'Sales', 4),
  ('Catalog', 'Browse and publish the full product catalog with media.', 'https://example.com/catalog', 'BookOpen', 'Sales', 5),
  ('Image Storage', 'Central library for product photography and marketing assets.', 'https://example.com/images', 'Images', 'Storage', 6),
  ('Accounting', 'Invoices, ledgers and financial reporting.', 'https://example.com/accounting', 'Receipt', 'Finance', 7)
) AS s(name, description, url, icon, category, sort_order)
CROSS JOIN LATERAL (SELECT gen_random_uuid()::text AS v) AS salt;