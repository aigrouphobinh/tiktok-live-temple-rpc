import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const live = readFileSync(new URL('../public/js/live.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/css/live.css', import.meta.url), 'utf8');

describe('Nghi lễ cúng dường side panel', () => {
  it('renders flower, Rocket, dragon and Donut controls in the ritual rail', () => {
    const start = html.indexOf('<aside class="ritual-side-panel"');
    const end = html.indexOf('</aside>', start);
    const rail = html.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    for (const id of ['sideRoseAction', 'sideRocketAction', 'sideDragonAction', 'sideDonutAction']) {
      expect(rail).toContain(`id="${id}"`);
    }
    for (const emoji of ['🌹', '🚀', '🐉', '🍩']) {
      expect(rail).toContain(emoji);
    }
    expect((rail.match(/class="ritual-side-action/g) || []).length).toBe(7);
  });

  it('routes each new button through the existing gift action aliases', () => {
    const actions = [
      { id: 'sideRoseAction', giftType: 'lotus', giftName: 'Hoa Hồng', source: 'ritual-side-rose' },
      { id: 'sideRocketAction', giftType: 'fruit', giftName: 'Rocket', source: 'ritual-side-rocket' },
      { id: 'sideDragonAction', giftType: 'dragon', giftName: 'Rồng Thiêng Chầu Phật', source: 'ritual-side-dragon' },
      { id: 'sideDonutAction', giftType: 'lamp', giftName: 'Donut', source: 'ritual-side-donut' }
    ];

    for (const action of actions) {
      expect(live).toContain(`getElementById('${action.id}')?.addEventListener('click'`);
      expect(live).toContain(`giftType: '${action.giftType}'`);
      expect(live).toContain(`giftName: '${action.giftName}'`);
      expect(live).toContain(`source: '${action.source}'`);
    }
  });

  it('keeps all seven controls compact and scrollable in desktop and mobile layouts', () => {
    expect(css).toContain('flex: 0 0 76px;');
    expect(css).toContain('max-height: calc(100% - 170px);');
    expect(css).toContain('flex-basis: 66px;');
    expect(css).toContain('max-height: calc(100% - 150px);');
  });
});
