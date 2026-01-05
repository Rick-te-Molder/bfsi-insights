import { chromium } from 'playwright';

// Validate URL scheme
export function validateUrlScheme(targetUrl) {
  const lowerUrl = targetUrl.toLowerCase();
  const hasValidScheme = lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://');
  if (!hasValidScheme) {
    console.log(`   ❌ Invalid URL scheme: ${targetUrl.substring(0, 30)}...`);
    throw new Error(
      `Invalid URL scheme: only http/https supported (got: ${targetUrl.substring(0, 50)})`,
    );
  }
}

// Launch browser
export async function launchBrowser(targetUrl, stepTracker) {
  const stepId = await stepTracker.start('browser_launch', { url: targetUrl });
  try {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
      ],
    });
    await stepTracker.success(stepId, { status: 'launched' });
    return browser;
  } catch (err) {
    await stepTracker.error(stepId, err.message);
    throw err;
  }
}

// Create browser context with viewport
export async function createBrowserContext(browser, config) {
  return browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
}

// Load page with timeout
async function loadPage(page, targetUrl, config, stepTracker) {
  const stepId = await stepTracker.start('page_load', { url: targetUrl });
  try {
    console.log(`   📥 Loading page: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout });
    await stepTracker.success(stepId, { status: 'loaded' });
  } catch (err) {
    await stepTracker.error(stepId, err.message);
    throw err;
  }
}

// Trigger lazy loading by scrolling
async function triggerLazyLoading(page, waitMs) {
  await new Promise((r) => setTimeout(r, 2000));
  await page.evaluate(() => window.scrollTo(0, 300));
  console.log(`   ⏳ Waiting ${waitMs}ms for rendering...`);
  await new Promise((r) => setTimeout(r, waitMs));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 1000));
}

// Hide cookie banners via CSS injection
async function hideCookieBanners(page) {
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
}

// Load and prepare page for screenshot
export async function loadAndPreparePage(page, targetUrl, config, stepTracker) {
  await loadPage(page, targetUrl, config, stepTracker);
  await triggerLazyLoading(page, config.wait);
  await hideCookieBanners(page);
}

// Capture screenshot
export async function captureScreenshot(page, stepTracker) {
  const stepId = await stepTracker.start('screenshot', { quality: 80 });
  try {
    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    await stepTracker.success(stepId, { size: screenshotBuffer.length });
    return screenshotBuffer;
  } catch (err) {
    await stepTracker.error(stepId, err.message);
    throw err;
  }
}

// Upload screenshot to storage
export async function uploadScreenshot(screenshotBuffer, queueId, supabase, stepTracker) {
  const bucket = 'asset';
  const fileName = `thumbnails/${queueId}.jpg`;
  const stepId = await stepTracker.start('storage_upload', { bucket });
  try {
    const { error } = await supabase.storage.from(bucket).upload(fileName, screenshotBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw new Error(`Storage Upload Failed: ${error.message}`);
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(fileName);
    await stepTracker.success(stepId, { path: fileName, publicUrl });
    console.log(`   ✅ Thumbnail uploaded: ${publicUrl}`);
    return { bucket, path: fileName, publicUrl };
  } catch (err) {
    await stepTracker.error(stepId, err.message);
    throw err;
  }
}
