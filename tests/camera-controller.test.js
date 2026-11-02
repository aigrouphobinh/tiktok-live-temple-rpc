import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/camera-controller.js', import.meta.url), 'utf8');

describe('3D camera ownership', () => {
  it('keeps the DOM rig for fixed overlays but disables its CSS camera motion in 3D mode', () => {
    const wrapper = source.indexOf('rig = document.createElement');
    const fixedNodes = source.indexOf('fixedNodes.forEach((node) => stage.appendChild(node));', wrapper);
    const threeDGuard = source.indexOf("if (new URLSearchParams(location.search).get('3d') === '1')", fixedNodes);
    const legacyDirector = source.indexOf('const presets = [', threeDGuard);
    const guard = source.slice(threeDGuard, legacyDirector);

    expect(wrapper).toBeGreaterThan(-1);
    expect(fixedNodes).toBeGreaterThan(wrapper);
    expect(threeDGuard).toBeGreaterThan(fixedNodes);
    expect(legacyDirector).toBeGreaterThan(threeDGuard);
    expect(guard).toContain("rig.style.transform = 'none';");
    expect(guard).toContain('} else {');
    expect(guard).not.toContain('return;');
    expect(source).toContain('do not stack CSS camera transforms');
  });
});
