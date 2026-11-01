import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');

describe('Three.js lifecycle recovery', () => {
  it('attaches the environment architecture once to the existing world', () => {
    expect(source).toContain("import { createTempleEnvironment } from './temple-environment.js';");
    expect(source.match(/createTempleEnvironment\\(\\{/g)).toHaveLength(1);
    expect(source.indexOf('scene.add(world);')).toBeLessThan(source.indexOf('createTempleEnvironment({'));
    expect(source).toContain('scene: world,');
    expect(source).toContain('gallerySurfaceY: 0.0825');
    expect(source).toContain('detailLevel: environmentDetailLevel');
  });

  it('disposes the environment layer before disposing shared scene resources', () => {
    const cleanupStart = source.indexOf('function releaseWorldResources()');
    const cleanupEnd = source.indexOf('function onVisibilityChange()', cleanupStart);
    const cleanup = source.slice(cleanupStart, cleanupEnd);
    expect(cleanup).toContain('templeEnvironment.dispose();');
    expect(cleanup.indexOf('templeEnvironment.dispose();'))
      .toBeLessThan(cleanup.indexOf('disposeThreeSceneResources(scene);'));
  });

  it('uses one idempotent cleanup path for context loss and page teardown', () => {
    expect(source).toContain('let resourcesDisposed = false;');
    expect(source).toContain('function releaseWorldResources()');
    expect(source).toContain('if (resourcesDisposed) return;');
    expect(source).toContain('releaseWorldResources();');
  });

  it('stops the animation loop and releases scene resources after WebGL context loss', () => {
    const handler = source.slice(source.indexOf("canvas.addEventListener('webglcontextlost'"), source.indexOf("window.addEventListener('pagehide'"));
    expect(handler).toContain('event.preventDefault();');
    expect(handler).toContain('disposed = true;');
    expect(handler).toContain('stop();');
    expect(handler).toContain('releaseWorldResources();');
    expect(handler).toContain("stage.classList.remove('temple-3d-mode');");
    expect(handler).toContain("window.dispatchEvent(new Event('temple:3d-unavailable'));");
  });

  it('prevents resize callbacks from touching a disposed renderer', () => {
    const handler = source.slice(source.indexOf('function onWindowResize()'), source.indexOf("document.addEventListener('visibilitychange'"));
    expect(handler).toContain('if (disposed) return;');
    expect(handler).toContain('renderer.setSize(1080, 1920, false);');
  });

  it('shares cleanup with pagehide rather than disposing the scene twice', () => {
    const handler = source.slice(source.indexOf("window.addEventListener('pagehide'"));
    expect(handler).toContain('disposed = true;');
    expect(handler).toContain('releaseWorldResources();');
    expect(handler).not.toContain('disposeThreeObjectTree(scene)');
  });
});
