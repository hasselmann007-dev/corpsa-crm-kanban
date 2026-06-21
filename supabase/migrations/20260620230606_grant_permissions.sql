-- Grant table privileges to default Supabase roles for API access
GRANT ALL PRIVILEGES ON TABLE public.leads TO postgres, anon, authenticated, service_role;
