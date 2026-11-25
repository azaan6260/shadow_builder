export interface LevelProgressRecord {
  bestStars: 1 | 2 | 3;
  bestMoves: number;
  completedAt: number;
}

export type LevelProgressMap = Record<string, LevelProgressRecord>;

const STORAGE_KEY = 'prismgrid_level_progress_v1';

export function loadLevelProgress(): LevelProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as LevelProgressMap;
  } catch {
    return {};
  }
}

export function saveLevelCompletion(
  levelId: string,
  stars: 1 | 2 | 3,
  movesCount: number
): LevelProgressMap {
  const current = loadLevelProgress();
  const existing = current[levelId];
  const updated: LevelProgressMap = {
    ...current,
    [levelId]: {
      bestStars: existing
        ? (Math.max(existing.bestStars, stars) as 1 | 2 | 3)
        : stars,
      bestMoves: existing
        ? Math.min(existing.bestMoves, movesCount)
        : movesCount,
      completedAt: Date.now(),
    },
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  }
  return updated;
}

export function calculateStarRating(
  movesCount: number,
  parMoves: number,
  shadedRegularCount: number,
  maxAllowedShaded: number
): 1 | 2 | 3 {
  const withinPar = movesCount <= parMoves;
  const withinTwoStar = movesCount <= parMoves + 5;
  const zeroUnnecessaryComplaints =
    maxAllowedShaded === 0 ? shadedRegularCount === 0 : shadedRegularCount <= maxAllowedShaded;

  if (withinPar && zeroUnnecessaryComplaints) {
    return 3;
  }
  if (withinTwoStar) {
    return 2;
  }
  return 1;
}

export function getTotalEarnedStars(progress: LevelProgressMap): number {
  return Object.values(progress).reduce((sum, rec) => sum + (rec?.bestStars ?? 0), 0);
}
