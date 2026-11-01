import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const artifactDir = 'artifacts';
await mkdir(artifactDir, { recursive: true });

const errors = [];
const failedRequests = [];
let browser;

const report = {
  url: 'http://127.0.0.1:3000/?obs=1&3d=1',
  capturedAt: new Date().toISOString(),
  viewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
  ready: false,
  sceneCanvasVisible: false,
  webgl: null,
  stage: null,
  sceneCanvas: null,
  consoleErrors: errors,
  failedRequests
};

try {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader'
    ]
  });

  const page = await browser.newPage({
    viewport: report.viewport,
    deviceScaleFactor: report.viewport.deviceScaleFactor
  });

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || 'request failed'
    });
  });

  await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  try {
    await page.waitForFunction(
      () => window.__TEMPLE_3D_READY__ === true,
      { timeout: 60000 }
    );
    report.ready = true;
  } catch (error) {
    report.readinessError = error.message;
  }

  await page.waitForTimeout(2500);
  report.scene = await page.evaluate(() => {
    const stage = document.getElementById('stage9x16');
    const canvas = document.getElementById('temple3dCanvas');
    const stageRect = stage?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    let context = null;
    try {
      context = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    } catch {}
    return {
      readyFlag: window.__TEMPLE_3D_READY__ === true,
      stageClass: stage?.className || null,
      stage: stageRect ? {
        x: stageRect.x, y: stageRect.y,
        width: stageRect.width, height: stageRect.height
      } : null,
      canvas: canvasRect ? {
        hidden: canvas.hidden,
        x: canvasRect.x, y: canvasRect.y,
        width: canvasRect.width, height: canvasRect.height
      } : null,
      webgl: context ? {
        version: context.getParameter(context.VERSION),
        renderer: context.getParameter(context.RENDERER),
        contextLost: context.isContextLost()
      } : null,
      backgroundDisplay: document.querySelector('.sanctuary-bg-img')
        ? getComputedStyle(document.querySelector('.sanctuary-bg-img')).display
        : null
    };
  });
  report.sceneCanvasVisible = report.scene?.canvas?.hidden === false;
  report.webgl = report.scene?.webgl || null;
  report.stage = report.scene?.stage || null;
  report.sceneCanvas = report.scene?.canvas || null;

  await page.locator('#stage9x16').screenshot({
    path: `${artifactDir}/temple-3d-portrait.png`,
    animations: 'disabled',
    timeout: 45000
  });
  await page.screenshot({
    path: `${artifactDir}/temple-3d-full-page.png`,
    fullPage: false,
    animations: 'disabled'
  });

  await writeFile(
    `${artifactDir}/temple-3d-visual-report.json`,
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.ready || !report.sceneCanvasVisible || !report.webgl || report.webgl.contextLost) {
    process.exitCode = 1;
  }
} catch (error) {
  report.fatalError = error.stack || error.message;
  await writeFile(
    `${artifactDir}/temple-3d-visual-report.json`,
    JSON.stringify(report, null, 2)
  );
  console.error(report.fatalError);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
