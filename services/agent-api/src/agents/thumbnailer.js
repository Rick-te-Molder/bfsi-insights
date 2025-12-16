import { Buffer } from 'node:buffer';
import { AgentRunner } from '../lib/runner.js';
import { chromium } from 'playwright';

const runner = new AgentRunner('thumbnailer');

// Process PDF: download, store, and render first page as thumbnail using Playwright
async function processPdf(
  pdfUrl,
  queueId,
  supabase,
  config,
  startStep,
  finishStepSuccess,
  finishStepError,
) {
  const bucket = 'asset';

  // Step 1: Download PDF
  const downloadStepId = await startStep('pdf_download', { url: pdfUrl });
  let pdfBuffer;
  try {
    console.log(`   📥 Downloading PDF: ${pdfUrl}`);
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    pdfBuffer = Buffer.from(await response.arrayBuffer());
    await finishStepSuccess(downloadStepId, { size: pdfBuffer.length });
    console.log(`   ✅ Downloaded PDF: ${(pdfBuffer.length / 1024).toFixed(0)}KB`);
  } catch (err) {
    await finishStepError(downloadStepId, err.message);
    throw err;
  }

  // Step 2: Store PDF in Supabase Storage
  const pdfPath = `pdfs/${queueId}.pdf`;
  const storeStepId = await startStep('pdf_store', { path: pdfPath });
  try {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

    const {
      data: { publicUrl: pdfPublicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(pdfPath);
    await finishStepSuccess(storeStepId, { path: pdfPath, publicUrl: pdfPublicUrl });
    console.log(`   ✅ Stored PDF: ${pdfPath}`);
  } catch (err) {
    await finishStepError(storeStepId, err.message);
    throw err;
  }

  // Step 3: Render first page using Playwright's PDF viewer
  const renderStepId = await startStep('pdf_render', { viewport: config.viewport });
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });

    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // Create a data URL from the PDF buffer for local rendering
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

    // Use Chrome's built-in PDF viewer
    await page.goto(pdfDataUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000)); // Wait for PDF to render

    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    await finishStepSuccess(renderStepId, { size: screenshotBuffer.length });
    console.log(`   ✅ Rendered PDF first page`);

    // Step 4: Upload thumbnail
    const thumbnailPath = `thumbnails/${queueId}.jpg`;
    const uploadStepId = await startStep('thumbnail_upload', { path: thumbnailPath });
    try {
      const { error: thumbError } = await supabase.storage
        .from(bucket)
        .upload(thumbnailPath, screenshotBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (thumbError) throw new Error(`Thumbnail upload failed: ${thumbError.message}`);

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(thumbnailPath);
      await finishStepSuccess(uploadStepId, { path: thumbnailPath, publicUrl });
      console.log(`   ✅ Thumbnail uploaded: ${publicUrl}`);

      return { bucket, path: thumbnailPath, publicUrl, pdfPath };
    } catch (err) {
      await finishStepError(uploadStepId, err.message);
      throw err;
    }
  } catch (err) {
    await finishStepError(renderStepId, err.message);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

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
      if (!targetUrl) {
        throw new Error('No URL provided in payload (expected payload.url or payload.source_url)');
      }

      // Handle URLs that can't be screenshotted
      const lowerUrl = targetUrl.toLowerCase();

      // Bad data - reject items with invalid URL schemes (not http/https)
      const hasValidScheme = lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
      if (!hasValidScheme) {
        console.log(
          `   ❌ Rejecting item with invalid URL scheme: ${targetUrl.substring(0, 30)}...`,
        );
        await supabase
          .from('ingestion_queue')
          .update({
            status_code: 540,
            rejection_reason: `Invalid URL scheme: only http/https supported (got: ${targetUrl.substring(0, 50)})`,
          })
          .eq('id', queueId);
        return { bucket: null, path: null, publicUrl: null, rejected: true };
      }

      // PDFs - download, store, and render first page as thumbnail
      if (lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?')) {
        console.log(`   📄 Processing PDF: ${targetUrl}`);
        return await processPdf(
          targetUrl,
          queueId,
          supabase,
          config,
          startStep,
          finishStepSuccess,
          finishStepError,
        );
      }

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
