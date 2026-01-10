import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AgentRunner } from '../lib/runner.js';
import { isPdfUrl } from '../lib/url-utils.js';
import { downloadPdf, storePdf, renderPdfFirstPage, uploadThumbnail } from './thumbnailer-pdf.js';
import {
  validateUrlScheme,
  launchBrowser,
  createBrowserContext,
  loadAndPreparePage,
  captureScreenshot,
  uploadScreenshot,
} from './thumbnailer-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PDF_RENDERER_PATH = join(__dirname, '../../scripts/render-pdf.py');

const runner = new AgentRunner('thumbnailer');

// Create step tracker from tools (bundles callbacks into single object)
function createStepTracker(tools) {
  return {
    start: tools.startStep,
    success: tools.finishStepSuccess,
    error: tools.finishStepError,
  };
}

async function renderPdfThumbnail(ctx, pdfBuffer) {
  const { queueId, config, stepTracker } = ctx;
  const renderStepId = await stepTracker.start('pdf_render', { viewport: config.viewport });
  try {
    console.log(`   🎨 Rendering PDF first page with Python script...`);
    const { screenshotBuffer, result } = await renderPdfFirstPage(
      pdfBuffer,
      queueId,
      config,
      PDF_RENDERER_PATH,
    );
    await stepTracker.success(renderStepId, {
      size: screenshotBuffer.length,
      width: result.width,
      height: result.height,
    });
    console.log(`   ✅ Rendered PDF first page: ${result.width}x${result.height}`);
    return screenshotBuffer;
  } catch (err) {
    await stepTracker.error(renderStepId, err.message);
    throw err;
  }
}

// Process PDF: download, store, render first page as thumbnail
async function processPdf(ctx) {
  const { targetUrl, queueId, supabase, stepTracker } = ctx;
  const pdfBuffer = await downloadPdf(targetUrl, stepTracker);
  const { pdfPath } = await storePdf(pdfBuffer, queueId, supabase, stepTracker);

  const screenshotBuffer = await renderPdfThumbnail(ctx, pdfBuffer);
  const { thumbnailPath, publicUrl } = await uploadThumbnail(
    screenshotBuffer,
    queueId,
    supabase,
    stepTracker,
  );
  return { bucket: 'asset', path: thumbnailPath, publicUrl, pdfPath };
}

// Process web page screenshot
async function processWebPage(ctx) {
  const { targetUrl, queueId, supabase, config, stepTracker } = ctx;
  const browser = await launchBrowser(targetUrl, stepTracker);
  try {
    const browserContext = await createBrowserContext(browser, config);
    const page = await browserContext.newPage();
    await loadAndPreparePage(page, targetUrl, config, stepTracker);
    const screenshotBuffer = await captureScreenshot(page, stepTracker);
    return await uploadScreenshot(screenshotBuffer, queueId, supabase, stepTracker);
  } finally {
    await browser.close();
  }
}

// Parse config with defaults
function parseConfig(configText) {
  const defaults = { viewport: { width: 1200, height: 675 }, timeout: 45000, wait: 8000 };
  try {
    return { ...defaults, ...JSON.parse(configText) };
  } catch (err) {
    console.warn('📸 Thumbnail config JSON parse failed, using defaults:', err.message);
    return defaults;
  }
}

// Get and validate target URL from payload
function getTargetUrl(payload) {
  const targetUrl = payload.url || payload.source_url;
  if (!targetUrl) {
    throw new Error('No URL provided in payload (expected payload.url or payload.source_url)');
  }
  console.log(`   🔍 Checking URL: ${targetUrl}`);
  validateUrlScheme(targetUrl);
  return targetUrl;
}

export async function runThumbnailer(queueItem) {
  return runner.run(
    { queueId: queueItem.id, payload: queueItem.payload, pipelineRunId: queueItem.pipelineRunId },
    async (context, configText, tools) => {
      const { payload, queueId } = context;
      const stepTracker = createStepTracker(tools);
      const config = parseConfig(configText);
      const targetUrl = getTargetUrl(payload);
      const ctx = { targetUrl, queueId, supabase: tools.supabase, config, stepTracker };

      console.log(`📸 Generating thumbnail for: ${payload.title}`);
      const isPdf = isPdfUrl(targetUrl);
      console.log(`   🔍 isPdfUrl result: ${isPdf}`);

      if (isPdf) {
        console.log(`   📄 Detected PDF URL`);
        return await processPdf(ctx);
      }
      return await processWebPage(ctx);
    },
  );
}
