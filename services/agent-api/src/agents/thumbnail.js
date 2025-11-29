import { AgentRunner } from '../lib/runner.js';
import { chromium } from 'playwright'; // Use chromium directly or 'playwright' package

const runner = new AgentRunner('thumbnail-generator');

export async function runThumbnailer(queueItem) {
  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
    },
    async (context, configText, tools) => {
      const { payload, queueId } = context;
      const { supabase } = tools;

      let config = {
        viewport: { width: 1200, height: 675 },
        timeout: 45000,
        wait: 8000,
      };
      try {
        const parsed = JSON.parse(configText);
        config = { ...config, ...parsed };
      } catch (err) {
        console.warn('📸 Thumbnail config JSON parse failed, using defaults:', err.message);
      }

      console.log(`📸 Generating thumbnail for: ${payload.title}`);

      const targetUrl = payload.url || payload.source_url;
      if (!targetUrl) throw new Error('No URL provided');

      const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'],
      });

      try {
        const context = await browser.newContext({
          viewport: config.viewport,
          deviceScaleFactor: 1,
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        const page = await context.newPage();

        console.log(`   📥 Loading page: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout });

        // Trigger Lazy Loading
        await new Promise((r) => setTimeout(r, 2000));
        await page.evaluate(() => window.scrollTo(0, 300));

        console.log(`   ⏳ Waiting ${config.wait}ms for rendering...`);
        await new Promise((r) => setTimeout(r, config.wait));

        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise((r) => setTimeout(r, 1000));

        // Inject CSS (Cookie blocker)
        await page.addStyleTag({
          content: `
                [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"],
                [class*="gdpr"], [id*="gdpr"], [aria-label*="cookie"], [aria-label*="consent"],
                .onetrust-pc-dark-filter, #onetrust-consent-sdk, .osano-cm-window, .cc-window,
                .cookie-banner, [class*="CookieBanner"], [id*="CookieBanner"],
                #CybotCookiebotDialog
                { display: none !important; visibility: hidden !important; opacity: 0 !important; }
            `,
        });
        await new Promise((r) => setTimeout(r, 500));

        const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });

        const bucket = 'asset';
        const fileName = `thumbnails/${queueId}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, screenshotBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw new Error(`Storage Upload Failed: ${uploadError.message}`);

        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(fileName);

        console.log(`   ✅ Thumbnail uploaded: ${publicUrl}`);
        return {
          bucket,
          path: fileName,
          publicUrl,
        };
      } finally {
        await browser.close();
      }
    },
  );
}
