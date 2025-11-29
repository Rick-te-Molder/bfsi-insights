import { AgentRunner } from '../lib/runner.js';
import { chromium } from 'playwright';

const runner = new AgentRunner('thumbnail-generator');

export async function runThumbnailer(queueItem) {
  return runner.run(
    {
      queueId: queueItem.id,
      payload: queueItem.payload,
    },
    async (context, configText, tools) => {
      const { payload, queueId } = context;
      const { supabase, startStep, finishStepSuccess, finishStepError } = tools;

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

      // Step 1: Launch browser
      const browserStepId = await startStep('browser_launch', { url: targetUrl });
      let browser;
      try {
        browser = await chromium.launch({
          headless: true,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--no-sandbox',
          ],
        });
        await finishStepSuccess(browserStepId, { status: 'launched' });
      } catch (err) {
        await finishStepError(browserStepId, err.message);
        throw err;
      }

      try {
        const browserContext = await browser.newContext({
          viewport: config.viewport,
          deviceScaleFactor: 1,
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        const page = await browserContext.newPage();

        // Step 2: Load page
        const loadStepId = await startStep('page_load', { url: targetUrl });
        try {
          console.log(`   📥 Loading page: ${targetUrl}`);
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout });
          await finishStepSuccess(loadStepId, { status: 'loaded' });
        } catch (err) {
          await finishStepError(loadStepId, err.message);
          throw err;
        }

        // Trigger lazy loading and wait for rendering
        await new Promise((r) => setTimeout(r, 2000));
        await page.evaluate(() => window.scrollTo(0, 300));

        console.log(`   ⏳ Waiting ${config.wait}ms for rendering...`);
        await new Promise((r) => setTimeout(r, config.wait));

        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise((r) => setTimeout(r, 1000));

        // Inject CSS to hide cookie banners
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

        // Step 3: Capture screenshot
        const screenshotStepId = await startStep('screenshot', { quality: 80 });
        let screenshotBuffer;
        try {
          screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
          await finishStepSuccess(screenshotStepId, { size: screenshotBuffer.length });
        } catch (err) {
          await finishStepError(screenshotStepId, err.message);
          throw err;
        }

        // Step 4: Upload to storage
        const uploadStepId = await startStep('storage_upload', { bucket: 'asset' });
        const bucket = 'asset';
        const fileName = `thumbnails/${queueId}.jpg`;

        try {
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

          await finishStepSuccess(uploadStepId, { path: fileName, publicUrl });

          console.log(`   ✅ Thumbnail uploaded: ${publicUrl}`);
          return {
            bucket,
            path: fileName,
            publicUrl,
          };
        } catch (err) {
          await finishStepError(uploadStepId, err.message);
          throw err;
        }
      } finally {
        await browser.close();
      }
    },
  );
}
