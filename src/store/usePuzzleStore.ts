import { create } from 'zustand';
import {
  ALL_Z_MAX,
  BlockState,
  GRID_MAX,
  GRID_MIN,
  GRID_Z_MAX,
  GRID_Z_MIN,
  PUZZLE_LEVELS,
  STAGING_Z_MIN,
  WallPiece,
  calculateGravityDrop,
  deriveBlocksFromPieces,
  getTargetFloorShape,
  getTargetShadow,
  getTargetWallShape,
  isValidPiecePosition,
  resolveBestPlacementAnchor,
  rotatePieceByAxis,
  settlePiecesWithGravity,
} from '../types/puzzle';
import { soundFX } from '../utils/sound';

function instantiateLevelPieces(levelId: string): WallPiece[] {
  const level = PUZZLE_LEVELS.find((l) => l.id === levelId) ?? PUZZLE_LEVELS[0];
  const raw = level.pieces.map((p) => ({
    ...p,
    dims: [...p.dims] as [number, number, number],
    baseDims: [...(p.baseDims ?? p.dims)] as [number, number, number],
    rotation: [...(p.rotation ?? [0, 0, 0])] as [number, number, number],
    position: [...p.initialPosition] as [number, number, number],
  }));
  return settlePiecesWithGravity(raw);
}

function getLevelWindowCoordinates(levelId: string): Array<[number, number]> {
  const level = PUZZLE_LEVELS.find((l) => l.id === levelId) ?? PUZZLE_LEVELS[0];
  return level.windowCoordinates.map(([wx, wy]) => [wx, wy]);
}

function getLevelAllowedFloorCells(levelId: string): Array<[number, number]> {
  const level = PUZZLE_LEVELS.find((l) => l.id === levelId) ?? PUZZLE_LEVELS[0];
  return level.allowedFloorCells.map(([fx, fz]) => [fx, fz]);
}

function buildAllowedFloorSet(cells: Array<[number, number]>): Set<string> {
  return new Set(cells.map(([fx, fz]) => `${fx},${fz}`));
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
  /** Limited buildable (x, z) floor coordinates inside the Central Building Zone */
  allowedFloorCells: Array<[number, number]>;
  /** Set of "x,z" strings for buildable floor cells inside the Central Building Zone */
  allowedFloorSet: Set<string>;
  /** Phase 17: Most recent crane transfer operation for sequencing the 3D Tower Crane */
  lastCraneTransfer: CraneTransferOp | null;
  /** Whether the Tower Crane is currently moving a block into position */
  isCraneAnimating: boolean;
  /** Phase 12: Set of projected 2D angled shadow floor coordinates ("shadowX,shadowZ") */
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
  setCraneAnimating: (animating: boolean) => void;
  selectPiece: (id: string | null) => void;
  cycleSelectedPiece: () => void;

  /**
   * Rotates the currently selected block 90 degrees around the world X, Y, or Z axis,
   * updating its 3D Euler orientation and grid dimensions `[w, h, d]`.
   */
  rotateSelectedPiece: (axis: 'x' | 'y' | 'z') => boolean;

  /**
   * Phase 11 & 17: Moves the currently selected block to `(targetX, targetZ)` using
   * `calculateGravityDrop(targetX, targetZ, currentBlocks)` to find `calculatedY = highestY + 1` (or 0),
   * triggers the Tower Crane animation sequence, and deselects it.
   */
  moveSelectedWithGravity: (
    targetX: number,
    targetZ: number,
    preferLeftX?: boolean,
    preferBackZ?: boolean
  ) => boolean;

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
  const initialAllowedCells = getLevelAllowedFloorCells(defaultLevelId);
  const initialAllowedSet = buildAllowedFloorSet(initialAllowedCells);

  return {
    activeLevelId: defaultLevelId,
    pieces: initialPieces,
    blocks: initialBlocks,
    windowCoordinates: getLevelWindowCoordinates(defaultLevelId),
    allowedFloorCells: initialAllowedCells,
    allowedFloorSet: initialAllowedSet,
    lastCraneTransfer: null,
    isCraneAnimating: false,
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

    setCraneAnimating: (animating) => {
      set({ isCraneAnimating: animating });
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

    rotateSelectedPiece: (axis) => {
      const { pieces, selectedBlockId, selectedPieceId, allowedFloorSet } = get();
      const activeId = selectedBlockId ?? selectedPieceId;
      if (!activeId) return false;

      const target = pieces.find((p) => p.id === activeId);
      if (!target) return false;

      const currentRot: [number, number, number] = target.rotation ?? [0, 0, 0];
      const { dims: nextDims, rotation: nextRotation } = rotatePieceByAxis(
        target.dims,
        currentRot,
        axis
      );

      const otherPieces = pieces.filter((p) => p.id !== activeId);
      const settledOthers = settlePiecesWithGravity(otherPieces);
      const settledOtherBlocks = deriveBlocksFromPieces(settledOthers);

      const wasInStaging = target.position[2] >= STAGING_Z_MIN;

      // Search nearby (dx, dz) offsets around current anchor so rotating a 2-unit block near an edge or garden
      // automatically snaps onto the nearest valid foundation / staging cells.
      const searchOffsets: Array<[number, number]> = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ];

      let chosenPos: [number, number, number] | null = null;

      for (const [ox, oz] of searchOffsets) {
        const rawX = target.position[0] + ox;
        const rawZ = target.position[2] + oz;
        const candX = Math.max(
          GRID_MIN,
          Math.min(GRID_MAX - nextDims[0] + 1, rawX)
        );
        const minZBound = wasInStaging ? STAGING_Z_MIN : GRID_Z_MIN;
        const maxZBound = wasInStaging
          ? ALL_Z_MAX - nextDims[2] + 1
          : GRID_Z_MAX - nextDims[2] + 1;
        const candZ = Math.max(minZBound, Math.min(maxZBound, rawZ));

        const dropY = calculateGravityDrop(
          candX,
          candZ,
          settledOtherBlocks,
          activeId,
          nextDims
        );
        const candPos: [number, number, number] = [candX, dropY, candZ];

        const testPieces = pieces.map((p) =>
          p.id === activeId
            ? { ...p, dims: nextDims, rotation: nextRotation, position: candPos }
            : settledOthers.find((s) => s.id === p.id) ?? p
        );

        if (
          isValidPiecePosition(
            testPieces,
            activeId,
            candPos,
            nextDims,
            allowedFloorSet
          )
        ) {
          chosenPos = candPos;
          break;
        }
      }

      if (!chosenPos) {
        return false;
      }

      const updatedPieces = pieces.map((p) =>
        p.id === activeId
          ? {
              ...p,
              dims: nextDims,
              rotation: nextRotation,
              position: chosenPos!,
            }
          : settledOthers.find((s) => s.id === p.id) ?? p
      );

      const nextPieces = settlePiecesWithGravity(updatedPieces);
      const nextBlocks = deriveBlocksFromPieces(nextPieces);

      soundFX.playToggle(chosenPos[2] <= GRID_Z_MAX, [
        axis === 'x' ? 1 : 0,
        axis === 'y' ? 1 : 0,
        axis === 'z' ? 1 : 0,
      ]);

      set((state) => ({
        pieces: nextPieces,
        blocks: nextBlocks,
        selectedBlockId: activeId,
        selectedPieceId: activeId,
        history: [
          ...state.history.slice(-49),
          { pieces: state.pieces, blocks: state.blocks },
        ],
        blocksHistory: [...state.blocksHistory.slice(-49), state.blocks],
        movesCount: state.movesCount + 1,
        lastMoveInfo: `Rotated ${target.name.split(' (')[0]} around ${axis.toUpperCase()}-axis → (${nextDims.join('×')})`,
      }));

      return true;
    },

    moveSelectedWithGravity: (
      targetX,
      targetZ,
      preferLeftX = false,
      preferBackZ = false
    ) => {
      const { pieces, selectedBlockId, selectedPieceId, allowedFloorSet } = get();
      const activeId = selectedBlockId ?? selectedPieceId;
      if (!activeId) return false;

      const target = pieces.find((p) => p.id === activeId);
      if (!target) return false;

      const fromPos: [number, number, number] = [...target.position];

      const { gridPos: candidatePos, isValid, settledOthers } =
        resolveBestPlacementAnchor(
          target,
          targetX,
          targetZ,
          pieces,
          allowedFloorSet,
          preferLeftX,
          preferBackZ,
          true
        );

      // If position didn't change, just deselect
      if (
        target.position[0] === candidatePos[0] &&
        target.position[1] === candidatePos[1] &&
        target.position[2] === candidatePos[2]
      ) {
        set({ selectedBlockId: null, selectedPieceId: null });
        return false;
      }

      if (!isValid) {
        return false;
      }

      const candidatePieces = pieces.map((p) => {
        if (p.id === activeId) {
          return { ...p, position: candidatePos };
        }
        return settledOthers.find((s) => s.id === p.id) ?? p;
      });

      const nextPieces = settlePiecesWithGravity(candidatePieces);
      const nextBlocks = deriveBlocksFromPieces(nextPieces);

      const isNowInCentralZone = candidatePos[2] <= GRID_Z_MAX;
      const calculatedY = candidatePos[1];

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
        isCraneAnimating: true,
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
        lastMoveInfo:
          calculatedY > 0
            ? `Crane cantilevered ${target.name.split(' (')[0]} at [${candidatePos.join(', ')}] (y=${calculatedY})`
            : `Crane placed ${target.name.split(' (')[0]} at [${candidatePos.join(', ')}] (y=${calculatedY})`,
      }));
      return true;
    },

    nudgePiece: (id, delta) => {
      const { pieces, allowedFloorSet } = get();
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
          GRID_Z_MIN,
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
        if (
          !isValidPiecePosition(
            candidatePieces,
            id,
            candidatePos,
            target.dims,
            allowedFloorSet
          )
        ) {
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
          isCraneAnimating: true,
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

      if (
        !isValidPiecePosition(
          pieces,
          id,
          candidatePos,
          target.dims,
          allowedFloorSet
        )
      ) {
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
        isCraneAnimating: true,
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
      const { pieces, allowedFloorSet } = get();
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

      if (
        !isValidPiecePosition(
          pieces,
          id,
          candidatePos,
          target.dims,
          allowedFloorSet
        )
      ) {
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
        isCraneAnimating: true,
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
      const allowedCells = getLevelAllowedFloorCells(activeLevelId);
      const allowedSet = buildAllowedFloorSet(allowedCells);
      soundFX.playToggle(true, [0, 0, 0]);
      set((state) => ({
        pieces: fresh,
        blocks: freshBlocks,
        windowCoordinates: getLevelWindowCoordinates(activeLevelId),
        allowedFloorCells: allowedCells,
        allowedFloorSet: allowedSet,
        lastCraneTransfer: null,
        isCraneAnimating: false,
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
      const allowedCells = getLevelAllowedFloorCells(levelId);
      const allowedSet = buildAllowedFloorSet(allowedCells);
      soundFX.playToggle(true, [0, 1, 0]);
      set({
        activeLevelId: levelId,
        pieces: fresh,
        blocks: freshBlocks,
        windowCoordinates: getLevelWindowCoordinates(levelId),
        allowedFloorCells: allowedCells,
        allowedFloorSet: allowedSet,
        lastCraneTransfer: null,
        isCraneAnimating: false,
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
          isCraneAnimating: false,
          history: nextHistory,
          blocksHistory: nextBlocksHistory,
          movesCount: Math.max(0, state.movesCount - 1),
          lastMoveInfo: `Undid last move (${nextHistory.length} left in history)`,
        };
      });
    },
  };
});

