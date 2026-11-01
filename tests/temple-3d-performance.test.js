import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
const visualAuditSource = readFileSync(new URL('../scripts/capture-temple-3d-visual.mjs', import.meta.url), 'utf8');

describe('Three.js scene performance safeguards', () => {
  it('accumulates slow-renderer intervals until percentile samples are reliable', () => {
    const diagnosticsStart = source.indexOf("if (statsEnabled && now - lastStatsAt >= 5000)");
    const diagnosticsEnd = source.indexOf("if (!effects.length && now > ritualUntil", diagnosticsStart);
    const diagnostics = source.slice(diagnosticsStart, diagnosticsEnd);
    expect(diagnostics).toContain('if (percentilesReliable) {');
    expect(diagnostics).toContain('frameIntervals.length = 0;');
    expect(diagnostics).toContain('frameWindowStartedAt = now;');
    expect(diagnostics.indexOf('if (percentilesReliable) {')).toBeLessThan(diagnostics.indexOf('frameIntervals.length = 0;'));
  });
  it('limits decorative lantern point lights to two per aisle', () => {
    expect(source).toContain('for (const x of [-5.8, 5.8])');
    expect(source).toContain('for (const z of [-7, -1, 5, 11])');
    expect(source).toContain('if (z === -7 || z === 5)');
    expect(source).toContain('lanterns.push(light);');
  });

  it('bounds concurrent transient gift and ritual effects and disposes evictions', () => {
    expect(source).toContain('const MAX_EFFECTS = 40;');
    expect(source).toContain('if (effects.length >= MAX_EFFECTS)');
    expect(source).toContain('world.remove(old.object); disposeThreeObjectTree(old.object);');
  });

  it('scales ambient incense draw calls to the selected render tier', () => {
    expect(source).toContain("const incenseWispCount = renderProfile.tier === 'low' ? 3");
    expect(source).toContain(": renderProfile.tier === 'medium' ? 4 : 6;");
    expect(source).toContain('Array.from({ length: incenseWispCount }');
    expect(source).toContain('const incenseSmokeGeometry = new THREE.SphereGeometry(0.105, 8, 6);');
  });

  it('keeps the fixed elevated portrait camera and 30fps frame cap', () => {
    expect(source).toContain('camera.position.set(0, 11.75, 28.5);');
    expect(source).toContain('camera.lookAt(0, -1.5, -5.5);');
    expect(source).toContain('if (now - lastFrame < 33) return;');
  });
  it('adapts render pixel ratio to device capacity without exceeding 1.25x', async () => {
    const { getTemplePixelRatio } = await import('../public/js/temple-render-quality.js');
    expect(getTemplePixelRatio({ devicePixelRatio: 2, deviceMemory: 4, hardwareConcurrency: 8 })).toBe(1);
    expect(getTemplePixelRatio({ devicePixelRatio: 2, deviceMemory: 8, hardwareConcurrency: 8 })).toBe(1.25);
    expect(getTemplePixelRatio({ devicePixelRatio: 1, deviceMemory: 8, hardwareConcurrency: 8 })).toBe(1);
    expect(getTemplePixelRatio({ devicePixelRatio: 2, hardwareConcurrency: 8 })).toBe(1.25);
    expect(getTemplePixelRatio({ devicePixelRatio: 2, deviceMemory: 8, hardwareConcurrency: 2 })).toBe(1);
  });

  it('gives the Buddha a fuller shoulder and torso silhouette at portrait scale', () => {
    expect(source).toContain('statue.scale.set(1.16, 1, 1.04);');
    expect(source).toContain('sphere(0.76, mats.statueStone, 0, 3.35, 0.02, 1.16, 1.2, 0.9, statue);');
    expect(source).toContain('sphere(0.8, mats.statueStone, 0, 3.72, -0.015, 1.18, 0.72, 0.8, statue);');
    expect(source).toContain('color: 0x98866d, roughness: 0.92');
  });

  it('keeps the sanctuary roofless and preserves the open altar sightline', () => {
    expect(source).not.toMatch(/makeCurvedRoofSide|roofTile|roofTrim|roofStartZ|const ridge =/);
    expect(source).toContain('Open-air sanctuary: keep the upper sightline clear');
    expect(source).toContain('camera.lookAt(0, -1.5, -5.5);');
  });

});


describe('Three.js opt-in GPU diagnostics', () => {
  it('resets frame samples across tab visibility pauses', () => {
    expect(source).toContain('function resetFrameDiagnostics()');
    const resetStart = source.indexOf('function resetFrameDiagnostics()');
    const resetEnd = source.indexOf('\n  }', resetStart);
    const reset = source.slice(resetStart, resetEnd);
    expect(reset).toContain('frameIntervals.length = 0;');
    expect(reset).toContain('lastRenderedFrameAt = 0;');
    expect(reset).toContain('frameWindowStartedAt = 0;');
    expect(reset).toContain('lastStatsAt = 0;');
    const visibilityStart = source.indexOf('function onVisibilityChange()');
    const visibilityEnd = source.indexOf('function onWindowResize()', visibilityStart);
    expect(source.slice(visibilityStart, visibilityEnd)).toContain('resetFrameDiagnostics();');
  });

  it('reports renderer draw calls, triangles and resource counts only when stats=1', () => {
    expect(source).toContain("const statsEnabled = modelParams.get('stats') === '1';");
    expect(source).toContain("console.info('[Temple3D] Frame diagnostics'");
    expect(source).toContain('drawCalls: info.render.calls');
    expect(source).toContain('triangles: info.render.triangles');
    expect(source).toContain('geometries: info.memory.geometries');
    expect(source).toContain('textures: info.memory.textures');
    expect(source).toContain('activeEffects: effects.length');
    expect(source).toContain('now - lastStatsAt >= 5000');
    expect(source).toContain('frameIntervals.push(now - lastRenderedFrameAt);');
    expect(source).toContain('frameSamples: sampleCount');
    expect(source).toContain('sampleWindowMs');
    expect(source).toContain('sampleCount * 1000 / sampleWindowMs');
    expect(source).not.toContain('(sampleCount + 1) * 1000 / sampleWindowMs');
    expect(visualAuditSource).toContain("[Temple3D] Frame diagnostics");
    expect(visualAuditSource).not.toContain("[Temple3D] GPU frame stats");
    expect(source).toContain("sampleQuality: percentilesReliable ? 'reliable' : 'insufficient'");
    expect(source).toContain('MIN_FRAME_SAMPLES_FOR_PERCENTILES = 30');
    expect(source).toContain('frameTimeP50Ms: percentile(0.50)');
    expect(source).toContain('frameTimeP95Ms: percentile(0.95)');
    expect(source).toContain('if (frameIntervals.length > 300) frameIntervals.shift();');
  });
});


describe('Three.js shared primitive geometry', () => {
  it('caches box, cylinder, sphere and plane geometry by immutable dimensions', () => {
    expect(source).toContain('const primitiveGeometryCache = new Map();');
    expect(source).toContain('const getPrimitiveGeometry = (key, create) =>');
    expect(source).toContain('`box:${w}:${h}:${d}`');
    expect(source).toContain('`cylinder:${rt}:${rb}:${h}:${radial}`');
    expect(source).toContain('`sphere:${r}:24:16`');
    expect(source).toContain('`plane:${w}:${h}`');
    expect(source).toContain('primitiveGeometryCache.set(key, create())');
  });
});
