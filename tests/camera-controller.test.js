import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/camera-controller.js', import.meta.url), 'utf8');

describe('3D camera ownership', () => {
  it('keeps the DOM rig for fixed overlays but disables its CSS camera motion in 3D mode', () => {
    const wrapper = source.indexOf('rig = document.createElement');
    const fixedNodes = source.indexOf('fixedNodes.forEach((node) => stage.appendChild(node));', wrapper);
    const threeDGuard = source.indexOf("if (new URLSearchParams(location.search).get('3d') === '1')", fixedNodes);
    const earlyReturn = source.indexOf('return;', threeDGuard);
    const cssPresets = source.indexOf('const presets = [', earlyReturn);

    expect(wrapper).toBeGreaterThan(-1);
    expect(fixedNodes).toBeGreaterThan(wrapper);
    expect(threeDGuard).toBeGreaterThan(fixedNodes);
    expect(earlyReturn).toBeGreaterThan(threeDGuard);
    expect(cssPresets).toBeGreaterThan(earlyReturn);
    expect(source).toContain('do not stack CSS camera transforms');
  });
});
