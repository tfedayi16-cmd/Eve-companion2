-- Function to retrieve a decrypted secret from the vault by name.
-- Only callable by service_role (used by Edge Functions to get API keys).
CREATE OR REPLACE FUNCTION public.get_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  RETURN (
    SELECT decrypted_secret
    FROM vault.decrypted_secrets
    WHERE name = secret_name
    LIMIT 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_secret(text) TO service_role;
