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
  countSupportedBottomCells,
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
      const originalOtherBlocks = deriveBlocksFromPieces(otherPieces);
      const settledOthers = settlePiecesWithGravity(otherPieces);
      const settledOtherBlocks = deriveBlocksFromPieces(settledOthers);

      const wasInStaging = target.position[2] >= STAGING_Z_MIN;
      const origY = target.position[1];
      const origCenterX = target.position[0] + (target.dims[0] - 1) * 0.5;
      const origCenterZ = target.position[2] + (target.dims[2] - 1) * 0.5;

      // Identify the lower supporting block(s) directly beneath `target` before rotation
      const { supportingPieceIds: origSupporterIds } = countSupportedBottomCells(
        target.position[0],
        origY,
        target.position[2],
        target.dims,
        originalOtherBlocks,
        activeId
      );

      // Collect all top-surface (x, z) cells of those supporting lower block(s) at y === origY - 1
      const supporterTopCellKeys = new Set<string>();
      const supporterTopCells: Array<[number, number]> = [];
      if (origY > 0 && origSupporterIds.size > 0) {
        const supportY = origY - 1;
        for (const b of settledOtherBlocks) {
          if (b.visible && b.y === supportY && origSupporterIds.has(b.pieceId)) {
            const key = `${b.x},${b.z}`;
            if (!supporterTopCellKeys.has(key)) {
              supporterTopCellKeys.add(key);
              supporterTopCells.push([b.x, b.z]);
            }
          }
        }
      }

      const minZBound = wasInStaging ? STAGING_Z_MIN : GRID_Z_MIN;
      const maxZBound = wasInStaging
        ? ALL_Z_MAX - nextDims[2] + 1
        : GRID_Z_MAX - nextDims[2] + 1;

      const clampX = (x: number) =>
        Math.max(GRID_MIN, Math.min(GRID_MAX - nextDims[0] + 1, x));
      const clampZ = (z: number) =>
        Math.max(minZBound, Math.min(maxZBound, z));

      // Gather unique candidate (candX, candZ) anchors:
      // 1. Every anchor that places any bottom cell of the rotated block directly onto the lower supporting block(s)
      // 2. Nearby offsets around the current anchor as fallback
      const candidateCoords: Array<[number, number]> = [];
      const seenCoords = new Set<string>();
      const addCandidate = (rawX: number, rawZ: number) => {
        const cx = clampX(rawX);
        const cz = clampZ(rawZ);
        const key = `${cx},${cz}`;
        if (!seenCoords.has(key)) {
          seenCoords.add(key);
          candidateCoords.push([cx, cz]);
        }
      };

      for (const [sx, sz] of supporterTopCells) {
        for (let dx = 0; dx < nextDims[0]; dx++) {
          for (let dz = 0; dz < nextDims[2]; dz++) {
            addCandidate(sx - dx, sz - dz);
          }
        }
      }

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
      for (const [ox, oz] of searchOffsets) {
        addCandidate(target.position[0] + ox, target.position[2] + oz);
      }

      interface ScoredRotationCandidate {
        pos: [number, number, number];
        restsOnOrigSupporterAtOrigY: boolean;
        staysAtOrigY: boolean;
        supportedCells: number;
        origSupporterOverlapCells: number;
        centerDistSq: number;
      }

      const validCandidates: ScoredRotationCandidate[] = [];

      for (const [candX, candZ] of candidateCoords) {
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
          !isValidPiecePosition(
            testPieces,
            activeId,
            candPos,
            nextDims,
            allowedFloorSet
          )
        ) {
          continue;
        }

        const { supportedCells, supportingPieceIds } = countSupportedBottomCells(
          candX,
          dropY,
          candZ,
          nextDims,
          settledOtherBlocks,
          activeId
        );

        let origSupporterOverlapCells = 0;
        if (origY > 0 && dropY === origY) {
          for (let dx = 0; dx < nextDims[0]; dx++) {
            for (let dz = 0; dz < nextDims[2]; dz++) {
              if (supporterTopCellKeys.has(`${candX + dx},${candZ + dz}`)) {
                origSupporterOverlapCells++;
              }
            }
          }
        }

        let sharesOrigSupporter = false;
        for (const id of supportingPieceIds) {
          if (origSupporterIds.has(id)) {
            sharesOrigSupporter = true;
            break;
          }
        }

        const candCenterX = candX + (nextDims[0] - 1) * 0.5;
        const candCenterZ = candZ + (nextDims[2] - 1) * 0.5;
        const centerDistSq =
          (candCenterX - origCenterX) ** 2 + (candCenterZ - origCenterZ) ** 2;

        validCandidates.push({
          pos: candPos,
          restsOnOrigSupporterAtOrigY:
            origY > 0 && dropY === origY && sharesOrigSupporter,
          staysAtOrigY: dropY === origY,
          supportedCells,
          origSupporterOverlapCells,
          centerDistSq,
        });
      }

      if (validCandidates.length === 0) {
        return false;
      }

      // Rank candidates so placement is decided cleanly by the lower supporting block(s):
      // - When stacked (origY > 0): stay on the exact lower supporting block at `origY`, maximize
      //   bottom-face support coverage (so it snaps flush instead of hanging half off), maximize
      //   overlap with the lower supporting block's top surface, then pick the closest center.
      // - When on the ground (origY === 0): stay on the ground (`dropY === 0`), then pick closest center.
      validCandidates.sort((a, b) => {
        if (origY > 0 && origSupporterIds.size > 0) {
          if (a.restsOnOrigSupporterAtOrigY !== b.restsOnOrigSupporterAtOrigY) {
            return a.restsOnOrigSupporterAtOrigY ? -1 : 1;
          }
          if (a.staysAtOrigY !== b.staysAtOrigY) {
            return a.staysAtOrigY ? -1 : 1;
          }
          if (a.supportedCells !== b.supportedCells) {
            return b.supportedCells - a.supportedCells;
          }
          if (a.origSupporterOverlapCells !== b.origSupporterOverlapCells) {
            return b.origSupporterOverlapCells - a.origSupporterOverlapCells;
          }
        } else {
          if (a.staysAtOrigY !== b.staysAtOrigY) {
            return a.staysAtOrigY ? -1 : 1;
          }
          if (a.supportedCells !== b.supportedCells) {
            return b.supportedCells - a.supportedCells;
          }
        }
        return a.centerDistSq - b.centerDistSq;
      });

      const chosenPos = validCandidates[0].pos;

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
        lastCraneTransfer: null,
        isCraneAnimating: false,
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
      const finalPos =
        nextPieces.find((p) => p.id === activeId)?.position ?? candidatePos;

      const isNowInCentralZone = finalPos[2] <= GRID_Z_MAX;
      const calculatedY = finalPos[1];

      soundFX.playToggle(isNowInCentralZone, [
        Math.sign(finalPos[0]),
        Math.sign(finalPos[1]),
        Math.sign(finalPos[2]),
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
          toPos: finalPos,
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
        const finalPos =
          nextPieces.find((p) => p.id === id)?.position ?? candidatePos;

        soundFX.playToggle(finalPos[2] <= GRID_MAX, [
          Math.sign(finalPos[0]),
          Math.sign(finalPos[1]),
          Math.sign(finalPos[2]),
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
            toPos: finalPos,
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
      const finalPos =
        nextPieces.find((p) => p.id === id)?.position ?? candidatePos;

      soundFX.playToggle(finalPos[2] <= GRID_MAX, [
        Math.sign(finalPos[0]),
        Math.sign(finalPos[1]),
        Math.sign(finalPos[2]),
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
          toPos: finalPos,
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

