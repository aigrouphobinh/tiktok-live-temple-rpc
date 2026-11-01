export function getFootPlantingStep(phase) {
  const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const stance = 0.62;
  const progress = cycle / (Math.PI * 2);
  if (progress < stance) return -1 + 2 * (progress / stance);
  const swing = (progress - stance) / (1 - stance);
  const eased = swing * swing * (3 - 2 * swing);
  return 1 - 2 * eased;
}
