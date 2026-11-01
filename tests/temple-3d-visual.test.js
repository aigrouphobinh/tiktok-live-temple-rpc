import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/css/live.css', import.meta.url), 'utf8');

describe('3D sanctuary visual treatment', () => {
  it('adds a non-interactive cinematic vignette only in 3D mode', () => {
    expect(css).toContain('.stage-9x16.temple-3d-mode::after');
    expect(css).toContain('pointer-events: none;');
    expect(css).toContain('radial-gradient(ellipse at 50% 43%');
    expect(css).toContain('linear-gradient(180deg');
  });

  it('adds an instanced gilded outer aureole and warm focal glow', async () => {
    const scene = (await import('node:fs')).readFileSync(
      new URL('../public/js/temple-3d.js', import.meta.url), 'utf8'
    );
    expect(scene).toContain('new THREE.TorusGeometry(2.3,0.035,8,96)');
    expect(scene).toContain('new THREE.InstancedMesh(');
    expect(scene).toContain('new THREE.SphereGeometry(0.045,8,6), mats.goldBright, 32');
    expect(scene).toContain('new THREE.PointLight(0xffbd69, 8, 7, 2)');
  });

  it('uses one static instanced mesh for gilded column fluting', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('new THREE.CylinderGeometry(0.012, 0.012, 5.9, 6)');
    expect(scene).toContain('mats.goldBright, 10 * 8');
    expect(scene).toContain('columnFlutes.instanceMatrix.setUsage(THREE.StaticDrawUsage)');
    expect(scene).toContain('columnFlutes.castShadow = false');
  });

  it('keeps the vignette below the live HUD layer', () => {
    const overlay = css.slice(css.lastIndexOf('.stage-9x16.temple-3d-mode::after'));
    const hudLayer = css.slice(0, css.lastIndexOf('.stage-9x16.temple-3d-mode::after'));
    expect(overlay).toContain('z-index: 2;');
    expect(hudLayer).toContain('.stage-9x16.temple-3d-mode .minimal-top-bar');
    expect(hudLayer).toContain('.stage-9x16.temple-3d-mode .bottom-hud-bar');
    expect(hudLayer).toContain('z-index: 30;');
  });
});
