import { comparisonKey } from "@/lib/text";

/** Levenshtein edit distance between two strings (iterative, O(n*m)). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Normalized Levenshtein similarity in 0..1 (1 = identical). */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Jaro similarity (0..1). */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (
    (matches / a.length +
      matches / b.length +
      (matches - transpositions) / matches) /
    3
  );
}

/** Jaro-Winkler similarity (0..1), favouring a common prefix. */
export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const j = jaro(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return j + prefix * prefixScale * (1 - j);
}

export interface SimilarityResult {
  score: number;
  explanation: string;
}

/**
 * Diacritics-insensitive name similarity used to flag near-duplicates for
 * human review. Combines Jaro-Winkler and normalized Levenshtein.
 */
export function nameSimilarity(a: string, b: string): SimilarityResult {
  const ka = comparisonKey(a);
  const kb = comparisonKey(b);
  if (!ka || !kb) return { score: 0, explanation: "One value is empty" };
  if (ka === kb)
    return { score: 1, explanation: "Values are identical after normalization" };

  const jw = jaroWinkler(ka, kb);
  const lev = levenshteinSimilarity(ka, kb);
  const score = Math.max(jw, lev);
  return {
    score,
    explanation: `Jaro-Winkler ${(jw * 100).toFixed(0)}%, edit-distance ${(lev * 100).toFixed(0)}%`,
  };
}
