import { Buffer } from 'node:buffer';
import { AgentRunner } from '../lib/runner.js';
import { chromium } from 'playwright';
import { isPdfUrl } from '../lib/url-utils.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PDF_RENDERER_PATH = join(__dirname, '../../scripts/render-pdf.py');

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
  let pdfPublicUrl;
  try {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(pdfPath);
    pdfPublicUrl = publicUrl;
    await finishStepSuccess(storeStepId, { path: pdfPath, publicUrl: pdfPublicUrl });
    console.log(`   ✅ Stored PDF: ${pdfPath}`);
  } catch (err) {
    await finishStepError(storeStepId, err.message);
    throw err;
  }

  // Step 3: Render first page using Python script
  const renderStepId = await startStep('pdf_render', { viewport: config.viewport });
  const tempPdfPath = join(tmpdir(), `${queueId}.pdf`);
  const tempImagePath = join(tmpdir(), `${queueId}.jpg`);

  try {
    console.log(`   🎨 Rendering PDF first page with Python script...`);

    // Write PDF buffer to temp file
    await writeFile(tempPdfPath, pdfBuffer);

    // Call Python script to render PDF
    const pythonPath = process.env.PYTHON_PATH || '/usr/bin/python3';
    const result = await new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [PDF_RENDERER_PATH, tempPdfPath, tempImagePath]);
      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`PDF rendering failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            reject(new Error(result.message || 'PDF rendering failed'));
            return;
          }
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse PDF rendering result: ${e.message}`));
        }
      });

      python.on('error', (err) => {
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      });
    });

    // Read rendered image
    const screenshotBuffer = await readFile(tempImagePath);

    // Clean up temp files
    await unlink(tempPdfPath).catch(() => {});
    await unlink(tempImagePath).catch(() => {});

    await finishStepSuccess(renderStepId, {
      size: screenshotBuffer.length,
      width: result.width,
      height: result.height,
    });
    console.log(`   ✅ Rendered PDF first page: ${result.width}x${result.height}`);

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
      console.log(`   🔍 Checking URL: ${targetUrl}`);

      // Bad data - reject items with invalid URL schemes (not http/https)
      const hasValidScheme = lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
      if (!hasValidScheme) {
        console.log(`   ❌ Invalid URL scheme: ${targetUrl.substring(0, 30)}...`);
        throw new Error(
          `Invalid URL scheme: only http/https supported (got: ${targetUrl.substring(0, 50)})`,
        );
      }

      // PDFs - download, store, and render first page as thumbnail
      console.log(`   🔍 Calling isPdfUrl for: ${targetUrl}`);
      const isPdf = isPdfUrl(targetUrl);
      console.log(`   🔍 isPdfUrl result: ${isPdf}`);
      if (isPdf) {
        console.log(`   📄 Detected PDF URL, calling processPdf: ${targetUrl}`);
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
