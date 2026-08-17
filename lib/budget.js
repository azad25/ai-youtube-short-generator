const IMAGE_COMPLEXITY = {
  'Character Explained': 2,
  'Story Explained': 4,
  Timeline: 3,
  'Ending Explained': 3,
  'Upcoming Movie': 3,
  Theory: 3,
  'Movie Connection': 3,
  'Plot Summary': 3
};

export function budgetSnapshot({ limit = 20, spent = 0, plannedShorts = 450, completedShorts = 0, reserve = 2 }) {
  const remaining = Math.max(0, Number(limit) - Number(spent));
  const shortsRemaining = Math.max(1, Number(plannedShorts) - Number(completedShorts));
  const spendable = Math.max(0, remaining - Number(reserve));
  return { limit: Number(limit), spent: Number(spent), reserve: Number(reserve), remaining, shortsRemaining, allowedPerShort: spendable / shortsRemaining };
}

export function recommendImagePlan({ contentType, budget, imageCostCeiling = 0.009, minimumImages = 2, maximumImages = 5 }) {
  const preferredImages = Math.min(maximumImages, Math.max(minimumImages, IMAGE_COMPLEXITY[contentType] || 3));
  const affordableImages = Math.floor(budget.allowedPerShort / imageCostCeiling);
  const imageCount = Math.min(preferredImages, maximumImages, Math.max(0, affordableImages));
  return {
    imageCount,
    preferredImages,
    estimatedImageSpend: imageCount * imageCostCeiling,
    canGenerate: imageCount >= minimumImages,
    reason: imageCount >= minimumImages ? 'Within the configured budget ceiling.' : 'Remaining budget cannot safely fund the minimum image plan.'
  };
}
