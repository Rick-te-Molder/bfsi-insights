-- Trigger Cloudflare Pages rebuild when article is approved

CREATE OR REPLACE FUNCTION trigger_site_rebuild()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_webhook_url text;
BEGIN
  -- Only trigger on new publications
  IF TG_TABLE_NAME = 'kb_publication' AND TG_OP = 'INSERT' THEN
    
    -- Get webhook URL from Vault
    SELECT decrypted_secret INTO v_webhook_url
    FROM vault.decrypted_secrets
    WHERE name = 'CLOUDFLARE_DEPLOY_HOOK';
    
    -- Trigger async rebuild
    IF v_webhook_url IS NOT NULL THEN
      PERFORM
        net.http_post(
          url := v_webhook_url,
          headers := '{}'::jsonb
        );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on kb_publication insert (when article is published)
DROP TRIGGER IF EXISTS on_article_published ON kb_publication;
CREATE TRIGGER on_article_published
  AFTER INSERT ON kb_publication
  FOR EACH ROW
  EXECUTE FUNCTION trigger_site_rebuild();