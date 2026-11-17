import { create } from 'zustand';
import {
  ALL_Z_MAX,
  BlockState,
  GRID_MAX,
  GRID_MIN,
  PUZZLE_LEVELS,
  WallPiece,
  calculateGravityDrop,
  deriveBlocksFromPieces,
  getTargetFloorShape,
  getTargetShadow,
  getTargetWallShape,
  isValidPiecePosition,
  settlePiecesWithGravity,
} from '../types/puzzle';
import { soundFX } from '../utils/sound';

function instantiateLevelPieces(levelId: string): WallPiece[] {
  const level = PUZZLE_LEVELS.find((l) => l.id === levelId) ?? PUZZLE_LEVELS[0];
  const raw = level.pieces.map((p) => ({
    ...p,
    position: [...p.initialPosition] as [number, number, number],
  }));
  return settlePiecesWithGravity(raw);
}

function getLevelWindowCoordinates(levelId: string): Array<[number, number]> {
  const level = PUZZLE_LEVELS.find((l) => l.id === levelId) ?? PUZZLE_LEVELS[0];
  return level.windowCoordinates.map(([wx, wy]) => [wx, wy]);
}

export interface HistorySnapshot {
  pieces: WallPiece[];
  blocks: BlockState[];
}

export interface CraneTransferOp {
  seq: number;
  pieceId: string;
  fromPos: [number, number, number];
  toPos: [number, number, number];
  dims: [number, number, number];
}

interface PuzzleStoreState {
  activeLevelId: string;
  pieces: WallPiece[];
  /** Expanded 3D block cells with `{ x, y, z, visible: true }` for analytical Set projections */
  blocks: BlockState[];
  /** Phase 15 & 16: Window coordinates [[x, y], ...] on the Neighboring Buildings */
  windowCoordinates: Array<[number, number]>;
  /** Phase 17: Most recent crane transfer operation for sequencing the 3D Gantry Crane */
  lastCraneTransfer: CraneTransferOp | null;
  /** Phase 12: Set of projected 2D angled shadow floor coordinates ("shadowX,shadowZ") under light [10, 10, 5] */
  targetShadow: Set<string>;
  /** 2D array of [x, y] target coordinates on the back wall */
  targetWallShape: Array<[number, number]>;
  /** 2D array of [x, z] target coordinates on the floor */
  targetFloorShape: Array<[number, number]>;
  /** Whether the Right to Light win condition is met */
  hasWon: boolean;
  /** Currently selected block ID (Phase 11 Select & Move state) */
  selectedBlockId: string | null;
  selectedPieceId: string | null;
  /** History stack of previous `{ pieces, blocks }` snapshots for step-by-step Undo */
  history: HistorySnapshot[];
  /** Snapshots of the `blocks` state array pushed before each action */
  blocksHistory: BlockState[][];
  movesCount: number;
  lastMoveInfo: string | null;

  setHasWon: (won: boolean) => void;
  selectPiece: (id: string | null) => void;
  cycleSelectedPiece: () => void;

  /**
   * Phase 11 & 17: Moves the currently selected block to `(targetX, targetZ)` using
   * `calculateGravityDrop(targetX, targetZ, currentBlocks)` to find `calculatedY = highestY + 1` (or 0),
   * triggers the Gantry Crane animation sequence, and deselects it.
   */
  moveSelectedWithGravity: (targetX: number, targetZ: number) => boolean;

  /**
   * Moves a piece by a delta [dx, dy, dz] if within bounds and collision-free
   */
  nudgePiece: (id: string, delta: [number, number, number]) => boolean;

  /**
   * Moves a piece directly to a target grid anchor [x, y, z] if valid
   */
  movePieceTo: (id: string, newPos: [number, number, number]) => boolean;

  /**
   * Resets all pieces in the current level back to their initial positions
   */
  resetLevel: () => void;

  /**
   * Switches to a specific level
   */
  setLevel: (levelId: string) => void;

  /**
   * Pops the last snapshot from history and restores it as the active blocks & pieces state
   */
  undo: () => void;
}

let craneOpCounter = 1;

export const usePuzzleStore = create<PuzzleStoreState>((set, get) => {
  const defaultLevelId = PUZZLE_LEVELS[0].id;
  const initialPieces = instantiateLevelPieces(defaultLevelId);
  const initialBlocks = deriveBlocksFromPieces(initialPieces);

  return {
    activeLevelId: defaultLevelId,
    pieces: initialPieces,
    blocks: initialBlocks,
    windowCoordinates: getLevelWindowCoordinates(defaultLevelId),
    lastCraneTransfer: null,
    targetShadow: getTargetShadow(initialPieces).targetShadow,
    targetWallShape: getTargetWallShape(initialPieces),
    targetFloorShape: getTargetFloorShape(initialPieces),
    hasWon: false,
    selectedBlockId: null,
    selectedPieceId: null,
    history: [],
    blocksHistory: [],
    movesCount: 0,
    lastMoveInfo: null,

    setHasWon: (won) => {
      set({ hasWon: won });
    },

    selectPiece: (id) => {
      set({ selectedBlockId: id, selectedPieceId: id });
      if (id) {
        soundFX.playHover();
      }
    },

    cycleSelectedPiece: () => {
      const { pieces, selectedPieceId } = get();
      if (pieces.length === 0) return;
      const idx = pieces.findIndex((p) => p.id === selectedPieceId);
      const next = pieces[(idx + 1) % pieces.length];
      set({ selectedBlockId: next.id, selectedPieceId: next.id });
      soundFX.playHover();
    },

    moveSelectedWithGravity: (targetX, targetZ) => {
      const { pieces, selectedBlockId, selectedPieceId } = get();
      const activeId = selectedBlockId ?? selectedPieceId;
      if (!activeId) return false;

      const target = pieces.find((p) => p.id === activeId);
      if (!target) return false;

      const fromPos: [number, number, number] = [...target.position];

      // Clamp targetX inside [-2..+2] and targetZ inside [-2..ALL_Z_MAX]
      const clampedX = Math.max(
        GRID_MIN,
        Math.min(GRID_MAX - target.dims[0] + 1, targetX)
      );
      const clampedZ = Math.max(
        GRID_MIN,
        Math.min(ALL_Z_MAX - target.dims[2] + 1, targetZ)
      );

      // First settle any remaining pieces as if `activeId` was lifted out
      const otherPieces = pieces.filter((p) => p.id !== activeId);
      const settledOthers = settlePiecesWithGravity(otherPieces);
      const settledOtherBlocks = deriveBlocksFromPieces(settledOthers);

      // Calculate deterministic gravity drop Y at (clampedX, clampedZ)
      const calculatedY = calculateGravityDrop(
        clampedX,
        clampedZ,
        settledOtherBlocks,
        activeId,
        target.dims
      );

      const candidatePos: [number, number, number] = [
        clampedX,
        calculatedY,
        clampedZ,
      ];

      // If position didn't change, just deselect
      if (
        target.position[0] === candidatePos[0] &&
        target.position[1] === candidatePos[1] &&
        target.position[2] === candidatePos[2]
      ) {
        set({ selectedBlockId: null, selectedPieceId: null });
        return false;
      }

      const candidatePieces = pieces.map((p) => {
        if (p.id === activeId) {
          return { ...p, position: candidatePos };
        }
        return settledOthers.find((s) => s.id === p.id) ?? p;
      });

      if (!isValidPiecePosition(candidatePieces, activeId, candidatePos, target.dims)) {
        return false;
      }

      const nextPieces = settlePiecesWithGravity(candidatePieces);
      const nextBlocks = deriveBlocksFromPieces(nextPieces);

      const isNowInCentralZone = candidatePos[2] <= GRID_MAX;

      soundFX.playToggle(isNowInCentralZone, [
        Math.sign(candidatePos[0]),
        Math.sign(candidatePos[1]),
        Math.sign(candidatePos[2]),
      ]);

      set((state) => ({
        pieces: nextPieces,
        blocks: nextBlocks,
        selectedBlockId: null,
        selectedPieceId: null,
        lastCraneTransfer: {
          seq: ++craneOpCounter,
          pieceId: activeId,
          fromPos,
          toPos: candidatePos,
          dims: target.dims,
        },
        history: [
          ...state.history.slice(-49),
          { pieces: state.pieces, blocks: state.blocks },
        ],
        blocksHistory: [...state.blocksHistory.slice(-49), state.blocks],
        movesCount: state.movesCount + 1,
        lastMoveInfo: `Crane placed ${target.name.split(' (')[0]} at [${candidatePos.join(', ')}] (y=${calculatedY})`,
      }));
      return true;
    },

    nudgePiece: (id, delta) => {
      const { pieces } = get();
      const target = pieces.find((p) => p.id === id);
      if (!target) return false;

      const fromPos: [number, number, number] = [...target.position];
      const nextX = target.position[0] + delta[0];
      const nextZ = target.position[2] + delta[2];

      // If nudging horizontally (delta X or Z), use deterministic gravity to find landing Y
      if (delta[0] !== 0 || delta[2] !== 0) {
        const clampedX = Math.max(
          GRID_MIN,
          Math.min(GRID_MAX - target.dims[0] + 1, nextX)
        );
        const clampedZ = Math.max(
          GRID_MIN,
          Math.min(ALL_Z_MAX - target.dims[2] + 1, nextZ)
        );
        const otherPieces = pieces.filter((p) => p.id !== id);
        const settledOthers = settlePiecesWithGravity(otherPieces);
        const settledOtherBlocks = deriveBlocksFromPieces(settledOthers);
        const calculatedY = calculateGravityDrop(
          clampedX,
          clampedZ,
          settledOtherBlocks,
          id,
          target.dims
        );
        const candidatePos: [number, number, number] = [
          clampedX,
          calculatedY,
          clampedZ,
        ];
        if (
          target.position[0] === candidatePos[0] &&
          target.position[1] === candidatePos[1] &&
          target.position[2] === candidatePos[2]
        ) {
          return false;
        }
        const candidatePieces = pieces.map((p) =>
          p.id === id
            ? { ...p, position: candidatePos }
            : settledOthers.find((s) => s.id === p.id) ?? p
        );
        if (!isValidPiecePosition(candidatePieces, id, candidatePos, target.dims)) {
          return false;
        }
        const nextPieces = settlePiecesWithGravity(candidatePieces);
        const nextBlocks = deriveBlocksFromPieces(nextPieces);

        soundFX.playToggle(candidatePos[2] <= GRID_MAX, [
          Math.sign(candidatePos[0]),
          Math.sign(candidatePos[1]),
          Math.sign(candidatePos[2]),
        ]);

        set((state) => ({
          pieces: nextPieces,
          blocks: nextBlocks,
          selectedBlockId: id,
          selectedPieceId: id,
          lastCraneTransfer: {
            seq: ++craneOpCounter,
            pieceId: id,
            fromPos,
            toPos: candidatePos,
            dims: target.dims,
          },
          history: [
            ...state.history.slice(-49),
            { pieces: state.pieces, blocks: state.blocks },
          ],
          blocksHistory: [...state.blocksHistory.slice(-49), state.blocks],
          movesCount: state.movesCount + 1,
          lastMoveInfo: `Crane moved ${target.name.split(' (')[0]} to [${candidatePos.join(', ')}]`,
        }));
        return true;
      }

      const candidatePos: [number, number, number] = [
        target.position[0] + delta[0],
        target.position[1] + delta[1],
        target.position[2] + delta[2],
      ];

      if (!isValidPiecePosition(pieces, id, candidatePos, target.dims)) {
        return false;
      }

      const nextPieces = pieces.map((p) =>
        p.id === id ? { ...p, position: candidatePos } : p
      );
      const nextBlocks = deriveBlocksFromPieces(nextPieces);

      soundFX.playToggle(candidatePos[2] <= GRID_MAX, [
        Math.sign(candidatePos[0]),
        Math.sign(candidatePos[1]),
        Math.sign(candidatePos[2]),
      ]);

      set((state) => ({
        pieces: nextPieces,
        blocks: nextBlocks,
        selectedBlockId: id,
        selectedPieceId: id,
        lastCraneTransfer: {
          seq: ++craneOpCounter,
          pieceId: id,
          fromPos,
          toPos: candidatePos,
          dims: target.dims,
        },
        history: [
          ...state.history.slice(-49),
          { pieces: state.pieces, blocks: state.blocks },
        ],
        blocksHistory: [...state.blocksHistory.slice(-49), state.blocks],
        movesCount: state.movesCount + 1,
        lastMoveInfo: `Crane moved ${target.name.split(' (')[0]} to (${candidatePos.join(', ')})`,
      }));
      return true;
    },

    movePieceTo: (id, candidatePos) => {
      const { pieces } = get();
      const target = pieces.find((p) => p.id === id);
      if (!target) return false;

      const fromPos: [number, number, number] = [...target.position];

      if (
        target.position[0] === candidatePos[0] &&
        target.position[1] === candidatePos[1] &&
        target.position[2] === candidatePos[2]
      ) {
        return false;
      }

      if (!isValidPiecePosition(pieces, id, candidatePos, target.dims)) {
        return false;
      }

      const nextPieces = settlePiecesWithGravity(
        pieces.map((p) => (p.id === id ? { ...p, position: candidatePos } : p))
      );
      const nextBlocks = deriveBlocksFromPieces(nextPieces);

      soundFX.playToggle(candidatePos[2] <= GRID_MAX, [
        Math.sign(candidatePos[0]),
        Math.sign(candidatePos[1]),
        Math.sign(candidatePos[2]),
      ]);

      set((state) => ({
        pieces: nextPieces,
        blocks: nextBlocks,
        selectedBlockId: id,
        selectedPieceId: id,
        lastCraneTransfer: {
          seq: ++craneOpCounter,
          pieceId: id,
          fromPos,
          toPos: candidatePos,
          dims: target.dims,
        },
        history: [
          ...state.history.slice(-49),
          { pieces: state.pieces, blocks: state.blocks },
        ],
        blocksHistory: [...state.blocksHistory.slice(-49), state.blocks],
        movesCount: state.movesCount + 1,
        lastMoveInfo: `Crane moved ${target.name.split(' (')[0]} to (${candidatePos.join(', ')})`,
      }));
      return true;
    },

    resetLevel: () => {
      const { activeLevelId } = get();
      const fresh = instantiateLevelPieces(activeLevelId);
      const freshBlocks = deriveBlocksFromPieces(fresh);
      soundFX.playToggle(true, [0, 0, 0]);
      set((state) => ({
        pieces: fresh,
        blocks: freshBlocks,
        windowCoordinates: getLevelWindowCoordinates(activeLevelId),
        lastCraneTransfer: null,
        targetShadow: getTargetShadow(fresh).targetShadow,
        targetWallShape: getTargetWallShape(fresh),
        targetFloorShape: getTargetFloorShape(fresh),
        hasWon: false,
        selectedBlockId: null,
        selectedPieceId: null,
        history: [
          ...state.history.slice(-49),
          { pieces: state.pieces, blocks: state.blocks },
        ],
        blocksHistory: [...state.blocksHistory.slice(-49), state.blocks],
        movesCount: 0,
        lastMoveInfo: 'Reset all skyscraper modules to initial positions',
      }));
    },

    setLevel: (levelId) => {
      const fresh = instantiateLevelPieces(levelId);
      const freshBlocks = deriveBlocksFromPieces(fresh);
      soundFX.playToggle(true, [0, 1, 0]);
      set({
        activeLevelId: levelId,
        pieces: fresh,
        blocks: freshBlocks,
        windowCoordinates: getLevelWindowCoordinates(levelId),
        lastCraneTransfer: null,
        targetShadow: getTargetShadow(fresh).targetShadow,
        targetWallShape: getTargetWallShape(fresh),
        targetFloorShape: getTargetFloorShape(fresh),
        hasWon: false,
        selectedBlockId: null,
        selectedPieceId: null,
        history: [],
        blocksHistory: [],
        movesCount: 0,
        lastMoveInfo: null,
      });
    },

    undo: () => {
      set((state) => {
        if (state.history.length === 0) return state;
        const lastSnapshot = state.history[state.history.length - 1];
        const nextHistory = state.history.slice(0, -1);
        const nextBlocksHistory = state.blocksHistory.slice(0, -1);
        soundFX.playToggle(true, [0, 0, 0]);
        return {
          pieces: lastSnapshot.pieces,
          blocks: lastSnapshot.blocks,
          lastCraneTransfer: null,
          history: nextHistory,
          blocksHistory: nextBlocksHistory,
          movesCount: Math.max(0, state.movesCount - 1),
          lastMoveInfo: `Undid last move (${nextHistory.length} left in history)`,
        };
      });
    },
  };
});
