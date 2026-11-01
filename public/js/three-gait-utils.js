export function getFootPlantingPose(phase) {
  const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const stance = 0.62;
  const progress = cycle / (Math.PI * 2);
  if (progress < stance) {
    return {
      step: -1 + 2 * (progress / stance),
      kneeFlex: 0.035,
      footLift: 0,
      swingProgress: 0
    };
  }
  const swingProgress = (progress - stance) / (1 - stance);
  const eased = swingProgress * swingProgress * (3 - 2 * swingProgress);
  return {
    step: 1 - 2 * eased,
    kneeFlex: Math.sin(Math.PI * swingProgress) * 0.72,
    footLift: Math.sin(Math.PI * swingProgress) * 0.13,
    swingProgress
  };
}

export function getFootPlantingStep(phase) {
  return getFootPlantingPose(phase).step;
}
