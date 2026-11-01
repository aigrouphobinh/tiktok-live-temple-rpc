import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const artifactDir = 'artifacts';
const viewport = { width: 1080, height: 1920 };
const deviceScaleFactor = 2;
const scenarios = [
  { id: 'low', deviceMemory: 2, hardwareConcurrency: 8, expectedPixelRatio: 1 },
  { id: 'medium', deviceMemory: 6, hardwareConcurrency: 8, expectedPixelRatio: 1.15 },
  { id: 'high', deviceMemory: 8, hardwareConcurrency: 8, expectedPixelRatio: 1.25 }
];

await mkdir(artifactDir, { recursive: true });

const report = {
  url: 'http://127.0.0.1:3000/?obs=1&3d=1&stats=1',
  capturedAt: new Date().toISOString(),
  viewport,
  deviceScaleFactor,
  note: 'Browser capability hints are overridden for deterministic profile coverage. This is a Chromium/SwiftShader visual and configuration audit, not a physical-GPU benchmark.',
  profiles: [],
  summary: {
    passed: false,
    allProfilesPassed: false,
    drawCallsStrictlyIncrease: false
  }
};

let browser;

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

  for (const scenario of scenarios) {
    const errors = [];
    const failedRequests = [];
    let page;
    let rendererStats = null;

    const profileReport = {
      id: scenario.id,
      requestedHints: {
        deviceMemory: scenario.deviceMemory,
        hardwareConcurrency: scenario.hardwareConcurrency
      },
      expectedPixelRatio: scenario.expectedPixelRatio,
      expectedShadowMapSize: scenario.id === 'low' ? 512 : 1024,
      expectedEnvironmentDetail: scenario.id,
      ready: false,
      sceneCanvasVisible: false,
      browserHints: null,
      renderProfile: null,
      stage: null,
      canvas: null,
      framebufferScale: null,
      webgl: null,
      rendererStats: null,
      consoleErrors: errors,
      failedRequests,
      checks: {}
    };

    try {
      page = await browser.newPage({ viewport, deviceScaleFactor });
      await page.addInitScript((hints) => {
        Object.defineProperty(navigator, 'deviceMemory', {
          configurable: true,
          get: () => hints.deviceMemory
        });
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          configurable: true,
          get: () => hints.hardwareConcurrency
        });
      }, {
        deviceMemory: scenario.deviceMemory,
        hardwareConcurrency: scenario.hardwareConcurrency
      });

      page.on('console', async (message) => {
        if (message.type() === 'error') errors.push(message.text());
        if (message.text().includes('[Temple3D] GPU frame stats')) {
          try {
            const args = message.args();
            const payload = await args[1]?.jsonValue();
            if (payload && typeof payload === 'object') rendererStats = payload;
          } catch (error) {
            errors.push(`Unable to read renderer stats: ${error.message}`);
          }
        }
      });
      page.on('pageerror', (error) => errors.push(error.stack || error.message));
      page.on('requestfailed', (request) => {
        failedRequests.push({
          url: request.url(),
          error: request.failure()?.errorText || 'request failed'
        });
      });

      const profileUrl = new URL(report.url);
      profileUrl.searchParams.set('profileAudit', scenario.id);
      await page.goto(profileUrl.toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });

      try {
        await page.waitForFunction(
          () => window.__TEMPLE_3D_READY__ === true,
          null,
          { timeout: 60000 }
        );
        profileReport.ready = true;
      } catch (error) {
        profileReport.readinessError = error.message;
      }

      // The renderer emits a diagnostic snapshot after five seconds when stats=1.
      await page.waitForTimeout(6500);
      if (!rendererStats) await page.waitForTimeout(2500);

      const scene = await page.evaluate(async () => {
        const stage = document.getElementById('stage9x16');
        const canvas = document.getElementById('temple3dCanvas');
        const stageRect = stage?.getBoundingClientRect();
        const canvasRect = canvas?.getBoundingClientRect();
        let context = null;
        try {
          context = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
        } catch {}
        const quality = await import('/js/temple-render-quality.js');
        const renderProfile = quality.getTempleRenderProfile({
          devicePixelRatio: window.devicePixelRatio || 1,
          deviceMemory: navigator.deviceMemory,
          hardwareConcurrency: navigator.hardwareConcurrency
        });
        return {
          readyFlag: window.__TEMPLE_3D_READY__ === true,
          userAgent: navigator.userAgent,
          devicePixelRatio: window.devicePixelRatio,
          browserHints: {
            deviceMemory: navigator.deviceMemory ?? null,
            hardwareConcurrency: navigator.hardwareConcurrency ?? null
          },
          renderProfile,
          stage: stageRect ? {
            x: stageRect.x, y: stageRect.y,
            width: stageRect.width, height: stageRect.height
          } : null,
          canvas: canvas ? {
            hidden: canvas.hidden,
            width: canvas.width,
            height: canvas.height,
            rect: canvasRect ? {
              x: canvasRect.x, y: canvasRect.y,
              width: canvasRect.width, height: canvasRect.height
            } : null
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

      profileReport.browserHints = scene.browserHints;
      profileReport.userAgent = scene.userAgent;
      profileReport.devicePixelRatio = scene.devicePixelRatio;
      profileReport.renderProfile = scene.renderProfile;
      profileReport.stage = scene.stage;
      profileReport.canvas = scene.canvas;
      profileReport.webgl = scene.webgl;
      profileReport.backgroundDisplay = scene.backgroundDisplay;
      profileReport.sceneCanvasVisible = scene.canvas?.hidden === false;
      profileReport.framebufferScale = scene.canvas ? {
        x: scene.canvas.width / viewport.width,
        y: scene.canvas.height / viewport.height
      } : null;
      profileReport.rendererStats = rendererStats;

      profileReport.checks = {
        hintsMatchRequested: scene.browserHints?.deviceMemory === scenario.deviceMemory
          && scene.browserHints?.hardwareConcurrency === scenario.hardwareConcurrency,
        expectedTierSelected: scene.renderProfile?.tier === scenario.id,
        expectedPixelRatioSelected: scene.renderProfile?.pixelRatio === scenario.expectedPixelRatio,
        framebufferScaleMatches: Boolean(scene.canvas)
          && Math.abs((scene.canvas.width / viewport.width) - scenario.expectedPixelRatio) < 0.002
          && Math.abs((scene.canvas.height / viewport.height) - scenario.expectedPixelRatio) < 0.002,
        rendererStatsCaptured: Boolean(rendererStats),
        rendererPixelRatioMatches: rendererStats?.pixelRatio === scenario.expectedPixelRatio,
        sceneReady: profileReport.ready && scene.readyFlag,
        canvasVisible: profileReport.sceneCanvasVisible,
        webgl2Available: scene.webgl?.version?.includes('WebGL 2') === true,
        contextHealthy: scene.webgl?.contextLost === false,
        noConsoleErrors: errors.length === 0,
        noFailedRequests: failedRequests.length === 0
      };
      profileReport.checks.passed = Object.values(profileReport.checks).every(Boolean);

      if (profileReport.sceneCanvasVisible) {
        const screenshotPath = `${artifactDir}/temple-3d-${scenario.id}.png`;
        await page.locator('#stage9x16').screenshot({
          path: screenshotPath,
          animations: 'disabled',
          timeout: 45000,
          scale: 'css'
        });
        profileReport.screenshot = screenshotPath;

        if (scenario.id === 'high') {
          await page.screenshot({
            path: `${artifactDir}/temple-3d-full-page.png`,
            fullPage: false,
            animations: 'disabled',
            scale: 'css'
          });
          await copyFile(screenshotPath, `${artifactDir}/temple-3d-portrait.png`);
        }
      }
    } catch (error) {
      profileReport.fatalError = error.stack || error.message;
      profileReport.checks.passed = false;
    } finally {
      await page?.close();
    }

    report.profiles.push(profileReport);
    console.log(`[Temple 3D audit] ${scenario.id}: ${profileReport.checks.passed ? 'PASS' : 'FAIL'}`);
  }

  const byTier = Object.fromEntries(report.profiles.map((profile) => [
    profile.id,
    profile.rendererStats?.drawCalls ?? null
  ]));
  const drawCalls = [byTier.low, byTier.medium, byTier.high];
  report.summary = {
    passed: report.profiles.length === scenarios.length
      && report.profiles.every((profile) => profile.checks.passed),
    allProfilesPassed: report.profiles.length === scenarios.length
      && report.profiles.every((profile) => profile.checks.passed),
    drawCallsByTier: byTier,
    drawCallsStrictlyIncrease: drawCalls.every(Number.isFinite)
      && drawCalls[0] < drawCalls[1]
      && drawCalls[1] < drawCalls[2]
  };

  // A stable detail profile should submit progressively more batches at higher tiers.
  report.summary.passed = report.summary.allProfilesPassed
    && report.summary.drawCallsStrictlyIncrease;

  await writeFile(
    `${artifactDir}/temple-3d-visual-report.json`,
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.summary.passed) process.exitCode = 1;
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
