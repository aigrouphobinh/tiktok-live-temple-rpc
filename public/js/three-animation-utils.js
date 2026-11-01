const DEFAULT_CLIP_ALIASES = {
  idle: ['idle', 'breath', 'resting', 'standing', 'stand'],
  walk: ['walking', 'walk', 'locomotion', 'approach', 'travel', 'running', 'run', 'movement', 'move'],
  bow: ['prostrate', 'worship', 'prayer', 'pray', 'kneel', 'bow']
};

function hasNameToken(name, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(name);
}

/**
 * Select the most specific matching animation clip. Alias order is intentional:
 * explicit action names win over generic synonyms, and token boundaries avoid
 * matching unrelated words such as "remove" for the "move" action.
 */
export function findBestAnimationClip(animations = [], aliases = DEFAULT_CLIP_ALIASES) {
  return Object.entries(aliases).reduce((result, [action, tokens]) => {
    const candidates = animations.map((clip, index) => {
      const name = String(clip?.name || '').trim();
      const normalized = name.toLowerCase().replace(/[_|./-]+/g, ' ').replace(/\s+/g, ' ').trim();
      const aliasIndex = tokens.findIndex((token) => hasNameToken(normalized, token));
      if (!name || aliasIndex < 0) return null;
      const exact = normalized === tokens[aliasIndex];
      return { clip, index, score: (exact ? 10000 : 5000) - aliasIndex * 100 - normalized.length };
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.index - b.index);
    result[action] = candidates[0]?.clip || null;
    return result;
  }, {});
}

export { DEFAULT_CLIP_ALIASES };
