/** 听写正确率（接口为数字，如 38、38.5） */
export function parseAccuracyValue(
  accuracy: number | null | undefined
): number | null {
  if (accuracy == null || !Number.isFinite(accuracy)) return null;
  return accuracy;
}

export function hasAccuracyValue(accuracy: number | null | undefined): boolean {
  return parseAccuracyValue(accuracy) != null;
}

export function formatAccuracyPercent(
  accuracy: number | null | undefined
): string {
  const n = parseAccuracyValue(accuracy);
  if (n == null) return "";
  const rounded = Math.round(n * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${text}%`;
}

export function accuracyScoreClass(accuracy: number | null | undefined): string {
  const score = parseAccuracyValue(accuracy);
  if (score == null) return "";
  return score >= 80 ? "is-high" : "is-low";
}
