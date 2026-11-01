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

  it('frames the processional carpet with low curbs and brass inlay', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('box(0.22, 0.16, 27.2, mats.stone, side * 3.08, 0.025, 3)');
    expect(scene).toContain('box(0.035, 0.025, 27.0, mats.goldBright, side * 3.19, 0.115, 3)');
    expect(scene).toContain('for (const z of [16.8, 17.45])');
  });

  it('adds low raised galleries beyond both side-column rows', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const x = side * 9.15');
    expect(scene).toContain('box(2.35, 0.18, 25.5, mats.wood, x, -0.055, 2.2)');
    expect(scene).toContain('box(2.2, 0.045, 25.2, mats.stone, x, 0.06, 2.2)');
    expect(scene).toContain('side * 10.25');
  });

  it('adds open timber balustrades along both raised gallery edges', () => {
    const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
    expect(scene).toContain('const railX = side * 10.18');
    expect(scene).toContain('box(0.14, 0.14, 24.8, mats.woodLight, railX, 0.66, 2.2)');
    expect(scene).toContain('box(0.1, 0.09, 24.8, mats.goldBright, railX, 0.79, 2.2)');
    expect(scene).toContain('sphere(0.075, mats.goldBright, railX, 1.02, z, 1, 0.7, 1)');
  });

  it('cache-busts the live stylesheet so the 3D HUD redesign reaches browsers', () => {
    const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    expect(html).toContain('/css/live.css?v=3d-console-20261101-2');
  });

  it('replaces the compact legacy cards with a sculpted 3D broadcast console', () => {
    expect(css).toContain('3D BROADCAST INTERFACE');
    expect(css).toContain('.stage-9x16.temple-3d-mode .bottom-hud-bar');
    expect(css).toContain('height: 218px;');
    expect(css).toContain('border-radius: 22px 8px 22px 8px;');
    expect(css).toContain('.stage-9x16.temple-3d-mode .hud-gift-card:hover');
    expect(css).toContain('font-size: 38px;');
    expect(css).toContain('.stage-9x16.temple-3d-mode .hud-right-leaderboard');
    expect(css).toContain('height: 188px;');
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
