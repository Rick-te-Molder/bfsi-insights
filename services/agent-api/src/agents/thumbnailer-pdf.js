import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

// Download PDF from URL
export async function downloadPdf(pdfUrl, stepTracker) {
  const stepId = await stepTracker.start('pdf_download', { url: pdfUrl });
  try {
    console.log(`   📥 Downloading PDF: ${pdfUrl}`);
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    await stepTracker.success(stepId, { size: pdfBuffer.length });
    console.log(`   ✅ Downloaded PDF: ${(pdfBuffer.length / 1024).toFixed(0)}KB`);
    return pdfBuffer;
  } catch (err) {
    await stepTracker.error(stepId, err.message);
    throw err;
  }
}

// Store PDF in Supabase Storage
export async function storePdf(pdfBuffer, queueId, supabase, stepTracker) {
  const bucket = 'asset';
  const pdfPath = `pdfs/${queueId}.pdf`;
  const stepId = await stepTracker.start('pdf_store', { path: pdfPath });
  try {
    const { error } = await supabase.storage.from(bucket).upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) throw new Error(`PDF upload failed: ${error.message}`);
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(pdfPath);
    await stepTracker.success(stepId, { path: pdfPath, publicUrl });
    console.log(`   ✅ Stored PDF: ${pdfPath}`);
    return { pdfPath, publicUrl };
  } catch (err) {
    await stepTracker.error(stepId, err.message);
    throw err;
  }
}

// Handle Python process close event
function handlePythonClose(code, stdout, stderr, resolve, reject) {
  if (code !== 0) {
    console.error(`   ❌ Python script exited with code ${code}`);
    console.error(`   📤 stdout: ${stdout}`);
    console.error(`   📤 stderr: ${stderr}`);
    reject(new Error(`PDF rendering failed (exit code ${code}): ${stderr || stdout}`));
    return;
  }
  try {
    const result = JSON.parse(stdout);
    if (result.success) resolve(result);
    else reject(new Error(result.message || 'PDF rendering failed'));
  } catch (e) {
    reject(new Error(`Failed to parse PDF rendering result: ${e.message}`));
  }
}

// Spawn Python process for PDF rendering
function spawnPythonRenderer(pythonPath, scriptPath, args) {
  return new Promise((resolve, reject) => {
    const python = spawn(pythonPath, [scriptPath, ...args]);
    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    python.on('close', (code) => handlePythonClose(code, stdout, stderr, resolve, reject));
    python.on('error', (err) =>
      reject(new Error(`Failed to spawn Python process: ${err.message}`)),
    );
  });
}

// Render PDF first page using Python script
export async function renderPdfFirstPage(pdfBuffer, queueId, config, scriptPath) {
  const tempPdfPath = join(tmpdir(), `${queueId}.pdf`);
  const tempImagePath = join(tmpdir(), `${queueId}.jpg`);
  const cleanup = async () => {
    // eslint-disable-next-line no-empty-function -- intentionally ignore cleanup errors
    await unlink(tempPdfPath).catch(() => {});
    // eslint-disable-next-line no-empty-function -- intentionally ignore cleanup errors
    await unlink(tempImagePath).catch(() => {});
  };

  try {
    await writeFile(tempPdfPath, pdfBuffer);
    const pythonPath = process.env.PYTHON_PATH || '/usr/bin/python3';
    const args = [
      tempPdfPath,
      tempImagePath,
      config.viewport.width.toString(),
      config.viewport.height.toString(),
    ];
    const result = await spawnPythonRenderer(pythonPath, scriptPath, args);
    const screenshotBuffer = await readFile(tempImagePath);
    await cleanup();
    return { screenshotBuffer, result };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

// Upload thumbnail to storage
export async function uploadThumbnail(screenshotBuffer, queueId, supabase, stepTracker) {
  const bucket = 'asset';
  const thumbnailPath = `thumbnails/${queueId}.jpg`;
  const stepId = await stepTracker.start('thumbnail_upload', { path: thumbnailPath });
  try {
    const { error } = await supabase.storage.from(bucket).upload(thumbnailPath, screenshotBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw new Error(`Thumbnail upload failed: ${error.message}`);
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(thumbnailPath);
    await stepTracker.success(stepId, { path: thumbnailPath, publicUrl });
    console.log(`   ✅ Thumbnail uploaded: ${publicUrl}`);
    return { thumbnailPath, publicUrl };
  } catch (err) {
    await stepTracker.error(stepId, err.message);
    throw err;
  }
}
