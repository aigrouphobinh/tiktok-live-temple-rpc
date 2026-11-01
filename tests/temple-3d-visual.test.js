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

  it('keeps the scene treatment above the canvas and below the live HUD', () => {
    const overlay = css.slice(css.lastIndexOf('.stage-9x16.temple-3d-mode::after'));
    expect(overlay).toContain('z-index: 2;');
    expect(overlay).toContain('.stage-9x16.temple-3d-mode .minimal-top-bar');
    expect(overlay).toContain('z-index: 30;');
  });
});
