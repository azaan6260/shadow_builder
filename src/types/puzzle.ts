export type ShapeKind =
  | 'cube'
  | 'prism'
  | 'pyramid'
  | 'cube-small'
  | 'cube-large'
  | 'beam-wide'
  | 'pillar-tall'
  | 'beam-deep'
  | 'cylinder'
  | 'wedge'
  | 'sphere'
  | 'octahedron';

/**
 * 2D silhouette profile cast onto the Vertical Screen (XY) or Ground (XZ)
 */
export type SilhouetteProfile = 'rect' | 'circle' | 'triangle' | 'diamond';

export interface WallPiece {
  id: string;
  name: string;
  shape: ShapeKind;
  /** Dimensions in grid units [widthX, heightY, depthZ] */
  dims: [number, number, number];
  /** Current integer anchor position [x, y, z] in the 3D wall workspace (-2..2) */
  position: [number, number, number];
  /** Unique solution target position [targetX, targetY, targetZ] */
  targetPosition: [number, number, number];
  /** Initial scrambled starting position [startX, startY, startZ] */
  initialPosition: [number, number, number];
  /** Accent tint for internal core / selection indicator */
  accentColor: string;
  /** 2D silhouette shape cast onto the Vertical Screen (XY) */
  wallSilhouette: SilhouetteProfile;
  /** 2D silhouette shape cast onto the Ground (XZ) */
  floorSilhouette: SilhouetteProfile;
}

export type CameraPresetId = 'iso-ne' | 'iso-nw' | 'iso-se' | 'top' | 'front' | 'side';

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  zoom: number;
}

export type GlassThemeId = 'cyan' | 'quartz' | 'amber' | 'emerald';

export interface GlassTheme {
  id: GlassThemeId;
  name: string;
  glassColor: string;
  attenuationColor: string;
  edgeColor: string;
  hoverEdgeColor: string;
  coreColor: string;
  swatchHex: string;
}

export interface BlockState {
  id: string;
  pieceId: string;
  shape: ShapeKind;
  x: number;
  y: number;
  z: number;
  visible: boolean;
}

export interface StencilElement {
  pieceId: string;
  pieceName: string;
  shape: ShapeKind;
  profile: SilhouetteProfile;
  /** Center position in 2D plane coordinates */
  center: [number, number];
  /** Size in 2D plane units [width, height] */
  size: [number, number];
  isMatched: boolean;
}

export interface WinCheckResult {
  isWin: boolean;
  wallMatchedCount: number;
  floorMatchedCount: number;
  fullySolvedPieces: number;
  totalPieces: number;
  /** Phase 15 & 16: Window coordinates [[x, y], ...] on the Neighboring Buildings */
  windowCoordinates: Array<[number, number]>;
  /** Phase 16: Set of "x-y" strings for all neighbor building windows */
  windowCoordinateSet: Set<string>;
  /** Phase 16: List of blocked window coordinates [[x, y], ...] hit by projected shadow */
  blockedWindows: Array<[number, number]>;
  /** Phase 16: Set of "x-y" strings for currently blocked (red) windows */
  blockedWindowSet: Set<string>;
  /** Phase 16: Number of blocks placed inside the Central Building Zone (z in -2..2) */
  placedPiecesCount: number;
  /** Phase 16: Number of blocks still sitting in the Staging Area (z >= 3) */
  unplacedPiecesCount: number;
  /** Phase 16: True when all blocks have been moved out of the Staging Area into the Central Building Zone */
  allBlocksPlaced: boolean;
  /** Phase 12: Target angled shadow Set of projected 2D floor coordinates ("shadowX,shadowZ") */
  targetShadow: Set<string>;
  /** Phase 12: Current player angled shadow Set of projected 2D floor coordinates ("shadowX,shadowZ") */
  currentShadow: Set<string>;
  /** Phase 12: Target angled shadow 2D coordinates [[shadowX, shadowZ], ...] */
  targetShadowCoords: Array<[number, number]>;
  /** Phase 12: Current player angled shadow 2D coordinates [[shadowX, shadowZ], ...] */
  currentShadowCoords: Array<[number, number]>;
  /** Phase 12: Number of targetShadow coordinates matched by currentShadow */
  angledMatchedCount: number;
  /** Phase 12: Number of currentShadow coordinates spilling outside targetShadow */
  angledSpilloverCount: number;
  /** Derived Set of unique "x-y" strings for visible blocks in the Central Building Zone */
  wallProjectionSet: Set<string>;
  /** Derived Set of unique "x-z" strings for visible blocks in the Central Building Zone */
  floorProjectionSet: Set<string>;
  /** Target wall coordinates [[x, y], ...] */
  targetWallShape: Array<[number, number]>;
  /** Target floor coordinates [[x, z], ...] */
  targetFloorShape: Array<[number, number]>;
  /** Number of target wall cells covered by current wallProjectionSet */
  wallCellsMatched: number;
  /** Number of current wall cells spilling outside targetWallShape */
  wallSpilloverCount: number;
  /** Number of target floor cells covered by current floorProjectionSet */
  floorCellsMatched: number;
  /** Number of current floor cells spilling outside targetFloorShape */
  floorSpilloverCount: number;
  /** 5x5 occupancy grid on the Neighboring Buildings Wall (XY, coords -2..+2) */
  wallGrid: Array<
    Array<{
      target: boolean;
      current: boolean;
      isWindow?: boolean;
      isBlockedWindow?: boolean;
      profile?: SilhouetteProfile;
    }>
  >;
  /** 5x5 occupancy grid on the Central Building Zone Ground (XZ, coords -2..+2) */
  floorGrid: Array<Array<{ target: boolean; current: boolean; profile?: SilhouetteProfile }>>;
  wallStencils: StencilElement[];
  floorStencils: StencilElement[];
}

export interface PuzzleLevel {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  /** X and Y coordinates of Balconies with residents on the Neighboring Buildings (-2..2, 0..4) */
  windowCoordinates: Array<[number, number]>;
  pieces: Omit<WallPiece, 'position'>[];
}

/**
 * Single Sun Light Position at the top-back at a 60-degree elevation angle from the ground,
 * centered at X = 0 so shadows are directed straight towards the Neighboring Buildings (-Z):
 * Horizontal distance = 10; Vertical height = 10 * tan(60°) ≈ 17.32
 */
export const LIGHT_POSITION: [number, number, number] = [0, 17.32, 10];

/** Grid Z coordinate of the protruding Neighboring Building balconies (just behind row z = -2) */
export const BALCONY_GRID_Z = -2.65;

export const GRID_MIN = -2;
export const GRID_MAX = 2;
export const GRID_COORDS = [-2, -1, 0, 1, 2] as const;

/** Foreground Staging Area Z coordinates where unplaced skyscraper blocks sit */
export const STAGING_Z_MIN = 3;
export const STAGING_Z_MAX = 4;
export const STAGING_Z_COORDS = [3, 4] as const;
export const ALL_Z_MAX = 4;

export const GRID_Y_MIN = 0;
export const GRID_Y_MAX = 4;
export const GRID_Y_COORDS = [0, 1, 2, 3, 4] as const;

/**
 * Returns true if the piece is completely inside the 5x5 Central Building Zone
 * (x in [-2..2] and z in [-2..2]), i.e. not sitting in the foreground Staging Area (z >= 3).
 */
export function isPieceInCentralZone(
  piece: Pick<WallPiece, 'position' | 'dims'>
): boolean {
  const [x, , z] = piece.position;
  const [w, , d] = piece.dims;
  return (
    x >= GRID_MIN &&
    x + w - 1 <= GRID_MAX &&
    z >= GRID_MIN &&
    z + d - 1 <= GRID_MAX
  );
}

/**
 * Computes the world center offset of a piece given its integer anchor [x, y, z] and dimensions [w, h, d].
 * X & Z use [-2..+2]; Y uses [0..4] where y = 0 rests directly on the floor plane (world Y = -2 * spacing).
 */
export function getPieceWorldCenter(
  pos: [number, number, number],
  dims: [number, number, number],
  spacing = 1.0
): [number, number, number] {
  return [
    (pos[0] + (dims[0] - 1) * 0.5) * spacing,
    (pos[1] - 2 + (dims[1] - 1) * 0.5) * spacing,
    (pos[2] + (dims[2] - 1) * 0.5) * spacing,
  ];
}

/**
 * Returns all integer grid cells [cx, cy, cz] occupied by a piece at `pos` with `dims`
 */
export function getOccupiedCells(
  pos: [number, number, number],
  dims: [number, number, number]
): Array<[number, number, number]> {
  const cells: Array<[number, number, number]> = [];
  for (let dx = 0; dx < dims[0]; dx++) {
    for (let dy = 0; dy < dims[1]; dy++) {
      for (let dz = 0; dz < dims[2]; dz++) {
        cells.push([pos[0] + dx, pos[1] + dy, pos[2] + dz]);
      }
    }
  }
  return cells;
}

/**
 * Expands the current 3D movable wall pieces into an array of occupied 3D blocks
 * with `{ x, y, z, visible: true }` for analytical 2D orthographic Set projection.
 */
export function deriveBlocksFromPieces(pieces: WallPiece[]): BlockState[] {
  const blocks: BlockState[] = [];
  for (const piece of pieces) {
    const cells = getOccupiedCells(piece.position, piece.dims);
    cells.forEach(([x, y, z], idx) => {
      blocks.push({
        id: `${piece.id}-cell-${idx}`,
        pieceId: piece.id,
        shape: piece.shape,
        x,
        y,
        z,
        visible: true,
      });
    });
  }
  return blocks;
}

/**
 * Phase 11: Deterministic Gravity Engine
 * Scans `currentBlocks` at `targetX` and `targetZ` (and across `[w, d]` footprint for multi-cell shapes),
 * finds the highest `y` value occupied by a block, and returns `highestY + 1` (or `0` if empty).
 */
export function calculateGravityDrop(
  targetX: number,
  targetZ: number,
  currentBlocks: BlockState[],
  excludePieceId?: string | null,
  dims: [number, number, number] = [1, 1, 1]
): number {
  let highestY = -1;
  const [w, , d] = dims;

  for (const block of currentBlocks) {
    if (!block.visible) continue;
    if (excludePieceId && block.pieceId === excludePieceId) continue;

    const withinX = block.x >= targetX && block.x < targetX + w;
    const withinZ = block.z >= targetZ && block.z < targetZ + d;

    if (withinX && withinZ && block.y > highestY) {
      highestY = block.y;
    }
  }

  return highestY === -1 ? 0 : highestY + 1;
}

/**
 * Settles all pieces from bottom-to-top using `calculateGravityDrop` so if a lower
 * support block moves out from underneath an upper block, the upper block drops naturally.
 */
export function settlePiecesWithGravity(pieces: WallPiece[]): WallPiece[] {
  const sorted = [...pieces].sort((a, b) => a.position[1] - b.position[1]);
  const settled: WallPiece[] = [];

  for (const piece of sorted) {
    const settledBlocks = deriveBlocksFromPieces(settled);
    const dropY = calculateGravityDrop(
      piece.position[0],
      piece.position[2],
      settledBlocks,
      piece.id,
      piece.dims
    );
    settled.push({
      ...piece,
      position: [piece.position[0], dropY, piece.position[2]],
    });
  }

  // Restore original piece order
  return pieces.map((orig) => settled.find((s) => s.id === orig.id) ?? orig);
}

/**
 * Computes the unique 2D targetWallShape array of [x, y] coordinates for the Vertical Screen stencil.
 */
export function getTargetWallShape(
  pieces: Array<Pick<WallPiece, 'targetPosition' | 'dims'>>
): Array<[number, number]> {
  const seen = new Set<string>();
  const result: Array<[number, number]> = [];
  for (const piece of pieces) {
    const [tx, ty] = piece.targetPosition;
    const [w, h] = piece.dims;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const x = tx + dx;
        const y = ty + dy;
        const key = `${x}-${y}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push([x, y]);
        }
      }
    }
  }
  return result;
}

/**
 * Computes the unique 2D targetFloorShape array of [x, z] coordinates for the Ground stencil.
 */
export function getTargetFloorShape(
  pieces: Array<Pick<WallPiece, 'targetPosition' | 'dims'>>
): Array<[number, number]> {
  const seen = new Set<string>();
  const result: Array<[number, number]> = [];
  for (const piece of pieces) {
    const [tx, , tz] = piece.targetPosition;
    const [w, , d] = piece.dims;
    for (let dx = 0; dx < w; dx++) {
      for (let dz = 0; dz < d; dz++) {
        const x = tx + dx;
        const z = tz + dz;
        const key = `${x}-${z}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push([x, z]);
        }
      }
    }
  }
  return result;
}

/**
 * Phase 12: Angled Vector Projection Algorithm
 * Iterates through the `blocks` array and calculates each visible block's shadow floor
 * coordinates (`y = 0`) under the 60-degree directional sun light at `[lightX, lightY, lightZ]`:
 *   shadowX = x - (lightX / lightY) * (y + 1)
 *   shadowZ = z - (lightZ / lightY) * (y + 1)
 * Note: Since a block at y=0 has height 1 unit above the floor, `(y + 1)` projects its top shadow edge onto the floor.
 */
export function projectAngledShadow(
  blocks: BlockState[],
  lightPosition: [number, number, number] = LIGHT_POSITION
): { shadowSet: Set<string>; coords: Array<[number, number]> } {
  const [lightX, lightY, lightZ] = lightPosition;
  const ratioX = lightX / lightY;
  const ratioZ = lightZ / lightY;

  const shadowSet = new Set<string>();
  const coords: Array<[number, number]> = [];

  for (const block of blocks) {
    if (!block.visible) continue;
    const effY = block.y + 1;
    const shadowX = Number((block.x - ratioX * effY).toFixed(2));
    const shadowZ = Number((block.z - ratioZ * effY).toFixed(2));
    const key = `${shadowX},${shadowZ}`;
    if (!shadowSet.has(key)) {
      shadowSet.add(key);
      coords.push([shadowX, shadowZ]);
    }
  }

  return { shadowSet, coords };
}

/**
 * Phase 12: Computes the `targetShadow` Set of angled 2D floor coordinates for the level's target state.
 */
export function getTargetShadow(
  pieces: Array<Pick<WallPiece, 'id' | 'shape' | 'targetPosition' | 'dims'>>,
  lightPosition: [number, number, number] = LIGHT_POSITION
): { targetShadow: Set<string>; coords: Array<[number, number]> } {
  const targetBlocks: BlockState[] = [];
  for (const piece of pieces) {
    const cells = getOccupiedCells(piece.targetPosition, piece.dims);
    cells.forEach(([x, y, z], idx) => {
      targetBlocks.push({
        id: `${piece.id}-target-${idx}`,
        pieceId: piece.id,
        shape: piece.shape,
        x,
        y,
        z,
        visible: true,
      });
    });
  }
  const { shadowSet, coords } = projectAngledShadow(targetBlocks, lightPosition);
  return { targetShadow: shadowSet, coords };
}

/**
 * Checks if placing `movingPieceId` at `candidatePos` stays within the construction site
 * (X: -2..2, Y: 0..4, Z: -2..4 including the Central Building Zone [-2..2] and Staging Area [3..4])
 * and does not collide with any other piece.
 */
export function isValidPiecePosition(
  pieces: WallPiece[],
  movingPieceId: string,
  candidatePos: [number, number, number],
  dims: [number, number, number]
): boolean {
  if (
    candidatePos[0] < GRID_MIN ||
    candidatePos[0] + dims[0] - 1 > GRID_MAX ||
    candidatePos[1] < GRID_Y_MIN ||
    candidatePos[1] + dims[1] - 1 > GRID_Y_MAX ||
    candidatePos[2] < GRID_MIN ||
    candidatePos[2] + dims[2] - 1 > ALL_Z_MAX
  ) {
    return false;
  }

  const candidateCells = getOccupiedCells(candidatePos, dims);

  for (const other of pieces) {
    if (other.id === movingPieceId) continue;
    const otherCells = getOccupiedCells(other.position, other.dims);
    for (const [cx, cy, cz] of candidateCells) {
      for (const [ox, oy, oz] of otherCells) {
        if (cx === ox && cy === oy && cz === oz) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Checks if a Neighboring Building balcony at `[wx, wy]` (with resident standing at `[wx, wy, BALCONY_GRID_Z]`)
 * is cast into shadow by any block in `centralZoneBlocks` under the single 60-degree Sun at `lightPosition`.
 * Uses 3D ray-box (AABB slab) intersection from key points on the balcony resident along the Sun direction vector
 * `[lightX, lightY, lightZ]`, matching the Three.js directionalLight shadow map.
 */
export function isBalconyShadedByBlocks(
  wx: number,
  wy: number,
  centralZoneBlocks: BlockState[],
  lightPosition: [number, number, number] = LIGHT_POSITION
): boolean {
  const [lx, ly, lz] = lightPosition;
  // Sample points across the balcony resident (feet, torso, head) at z = BALCONY_GRID_Z
  const samplePoints: Array<[number, number, number]> = [
    [wx, wy, BALCONY_GRID_Z],
    [wx, wy + 0.22, BALCONY_GRID_Z - 0.08],
    [wx, wy - 0.18, BALCONY_GRID_Z + 0.08],
    [wx - 0.16, wy, BALCONY_GRID_Z],
    [wx + 0.16, wy, BALCONY_GRID_Z],
  ];

  const slabAxis = (
    minVal: number,
    maxVal: number,
    originVal: number,
    dirVal: number
  ): [number, number] | null => {
    if (Math.abs(dirVal) < 1e-6) {
      if (originVal < minVal || originVal > maxVal) return null;
      return [-Infinity, Infinity];
    }
    const t1 = (minVal - originVal) / dirVal;
    const t2 = (maxVal - originVal) / dirVal;
    return [Math.min(t1, t2), Math.max(t1, t2)];
  };

  for (const block of centralZoneBlocks) {
    if (!block.visible) continue;
    // Block AABB in grid coordinates (each unit block spans [x - 0.52, x + 0.52])
    const minX = block.x - 0.52;
    const maxX = block.x + 0.52;
    const minY = block.y - 0.52;
    const maxY = block.y + 0.52;
    const minZ = block.z - 0.52;
    const maxZ = block.z + 0.52;

    for (const [px, py, pz] of samplePoints) {
      const sx = slabAxis(minX, maxX, px, lx);
      if (!sx) continue;
      const sy = slabAxis(minY, maxY, py, ly);
      if (!sy) continue;
      const sz = slabAxis(minZ, maxZ, pz, lz);
      if (!sz) continue;

      const tEnter = Math.max(0.001, sx[0], sy[0], sz[0]);
      const tExit = Math.min(sx[1], sy[1], sz[1]);

      if (tEnter <= tExit) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Phase 16: "Right to Light" Analytical Validator & Single 60° Sun Balcony Shadow Evaluator
 * 1. Traces the 60-degree Sun ray from each Neighboring Building balcony (`windowCoordinates`)
 *    through the 3D blocks in the Central Building Zone to check if any balcony resident is in shadow.
 * 2. Tracks how many blocks are still in the Staging Area (`z >= 3`) vs placed in the Central Building Zone (`z <= 2`).
 * 3. Win State: `allBlocksPlaced` (0 blocks in Staging Area) AND `blockedWindowSet.size === 0` (0 angry shaded balconies).
 */
export function checkWinCondition(
  pieces: WallPiece[],
  windowCoordinates: Array<[number, number]> = []
): WinCheckResult {
  const blocks = deriveBlocksFromPieces(pieces);
  const visibleBlocks = blocks.filter((b) => b.visible === true);

  // Blocks placed inside the Central Building Zone (z in -2..2) can cast shadows onto the Neighboring Building balconies
  const centralZoneBlocks = visibleBlocks.filter(
    (b) => b.z >= GRID_MIN && b.z <= GRID_MAX
  );

  // 1. 2D Projected Shadow Coordinates on the Neighboring Buildings Wall
  const wallProjectionSet = new Set<string>(
    centralZoneBlocks.map((b) => `${b.x}-${b.y}`)
  );

  // 2. Ground Footprint in the Central Building Zone (XZ plane: "x-z")
  const floorProjectionSet = new Set<string>(
    centralZoneBlocks.map((b) => `${b.x}-${b.z}`)
  );

  // 3. Intersection check: Does the 60° Sun shadow from any block hit any balcony resident?
  const windowCoordinateSet = new Set<string>(
    windowCoordinates.map(([wx, wy]) => `${wx}-${wy}`)
  );
  const blockedWindows: Array<[number, number]> = [];
  const blockedWindowSet = new Set<string>();

  for (const [wx, wy] of windowCoordinates) {
    const key = `${wx}-${wy}`;
    if (isBalconyShadedByBlocks(wx, wy, centralZoneBlocks, LIGHT_POSITION)) {
      blockedWindows.push([wx, wy]);
      blockedWindowSet.add(key);
      wallProjectionSet.add(key);
    }
  }

  // 4. Staging Area vs Central Building Zone placement check
  let placedPiecesCount = 0;
  let unplacedPiecesCount = 0;
  for (const piece of pieces) {
    if (isPieceInCentralZone(piece)) {
      placedPiecesCount++;
    } else {
      unplacedPiecesCount++;
    }
  }
  const allBlocksPlaced = unplacedPiecesCount === 0 && pieces.length > 0;

  // Angled Floor Shadow Projection under 60° Sun
  const { targetShadow, coords: targetShadowCoords } = getTargetShadow(
    pieces,
    LIGHT_POSITION
  );
  const { shadowSet: currentShadow, coords: currentShadowCoords } =
    projectAngledShadow(centralZoneBlocks, LIGHT_POSITION);

  let angledMatchedCount = 0;
  for (const key of targetShadow) {
    if (currentShadow.has(key)) angledMatchedCount++;
  }
  let angledSpilloverCount = 0;
  for (const key of currentShadow) {
    if (!targetShadow.has(key)) angledSpilloverCount++;
  }

  const targetWallShape = getTargetWallShape(pieces);
  const targetFloorShape = getTargetFloorShape(pieces);

  const wallCellsMatched = windowCoordinates.length - blockedWindows.length;
  const wallSpilloverCount = blockedWindows.length;
  const floorCellsMatched = placedPiecesCount;
  const floorSpilloverCount = unplacedPiecesCount;

  const wallStencils: StencilElement[] = [];
  const floorStencils: StencilElement[] = [];

  // Initialize 5x5 2D grids for HUD preview (indices 0..4 map to coords -2..+2)
  const wallGrid = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => ({
      target: false,
      current: false,
      isWindow: false,
      isBlockedWindow: false,
      profile: undefined as SilhouetteProfile | undefined,
    }))
  );

  const floorGrid = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => ({
      target: false,
      current: false,
      profile: undefined as SilhouetteProfile | undefined,
    }))
  );

  // Mark balcony coordinates on the 5x5 Neighboring Building Wall grid
  for (const [wx, wy] of windowCoordinates) {
    const gx = wx + 2;
    const gy = wy;
    if (gx >= 0 && gx < 5 && gy >= 0 && gy < 5) {
      const isBlocked = blockedWindowSet.has(`${wx}-${wy}`);
      wallGrid[gy][gx].target = true;
      wallGrid[gy][gx].isWindow = true;
      wallGrid[gy][gx].isBlockedWindow = isBlocked;
      wallGrid[gy][gx].profile = 'rect';
    }
  }

  // Populate current player shadow & central zone occupancy on the 5x5 grids
  let sunSafePiecesCount = 0;
  for (const piece of pieces) {
    const [w, h, d] = piece.dims;
    const [cx, cy, cz] = piece.position;
    const inCentral = isPieceInCentralZone(piece);

    const pieceBlocks = deriveBlocksFromPieces([piece]);
    const blocksAnyBalcony =
      inCentral &&
      windowCoordinates.some(([wx, wy]) =>
        isBalconyShadedByBlocks(wx, wy, pieceBlocks, LIGHT_POSITION)
      );

    if (inCentral && !blocksAnyBalcony) {
      sunSafePiecesCount++;
    }

    if (inCentral) {
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          const gx = cx + dx + 2;
          const gy = cy + dy;
          if (gx >= 0 && gx < 5 && gy >= 0 && gy < 5) {
            wallGrid[gy][gx].current = true;
          }
        }
        for (let dz = 0; dz < d; dz++) {
          const gx = cx + dx + 2;
          const gz = cz + dz + 2;
          if (gx >= 0 && gx < 5 && gz >= 0 && gz < 5) {
            floorGrid[gz][gx].current = true;
            floorGrid[gz][gx].target = true;
            floorGrid[gz][gx].profile = piece.floorSilhouette;
          }
        }
      }
    }
  }

  const totalPieces = pieces.length;
  // Win State: All blocks from staging area placed in central building zone AND zero balconies shaded
  const isWin = allBlocksPlaced && blockedWindowSet.size === 0;

  return {
    isWin,
    wallMatchedCount: windowCoordinates.length - blockedWindows.length,
    floorMatchedCount: placedPiecesCount,
    fullySolvedPieces: sunSafePiecesCount,
    totalPieces,
    windowCoordinates,
    windowCoordinateSet,
    blockedWindows,
    blockedWindowSet,
    placedPiecesCount,
    unplacedPiecesCount,
    allBlocksPlaced,
    targetShadow,
    currentShadow,
    targetShadowCoords,
    currentShadowCoords,
    angledMatchedCount,
    angledSpilloverCount,
    wallProjectionSet,
    floorProjectionSet,
    targetWallShape,
    targetFloorShape,
    wallCellsMatched,
    wallSpilloverCount,
    floorCellsMatched,
    floorSpilloverCount,
    wallGrid,
    floorGrid,
    wallStencils,
    floorStencils,
  };
}

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'iso-ne', label: 'Isometric NE', position: [13, 12, 14], zoom: 44 },
  { id: 'iso-nw', label: 'Isometric NW', position: [-13, 12, 14], zoom: 44 },
  { id: 'iso-se', label: 'Isometric SE', position: [13, 12, -13], zoom: 44 },
  { id: 'front', label: 'Neighbor Balconies (XY)', position: [0, 0, 18], zoom: 52 },
  { id: 'top', label: 'Site Plan (XZ)', position: [0.01, 18, 1.0], zoom: 46 },
  { id: 'side', label: 'Elevation (YZ)', position: [18, 0, 1.0], zoom: 50 },
];

export const GLASS_THEMES: Record<GlassThemeId, GlassTheme> = {
  cyan: {
    id: 'cyan',
    name: 'Pre-Cast Concrete',
    glassColor: '#cbd5e1',
    attenuationColor: '#64748b',
    edgeColor: '#1e293b',
    hoverEdgeColor: '#0284c7',
    coreColor: '#38bdf8',
    swatchHex: '#cbd5e1',
  },
  quartz: {
    id: 'quartz',
    name: 'Curtain Wall Glass',
    glassColor: '#93c5fd',
    attenuationColor: '#1d4ed8',
    edgeColor: '#1e3a8a',
    hoverEdgeColor: '#0f172a',
    coreColor: '#60a5fa',
    swatchHex: '#93c5fd',
  },
  amber: {
    id: 'amber',
    name: 'Weathering Corten Steel',
    glassColor: '#d97757',
    attenuationColor: '#9a3412',
    edgeColor: '#431407',
    hoverEdgeColor: '#0f172a',
    coreColor: '#f59e0b',
    swatchHex: '#d97757',
  },
  emerald: {
    id: 'emerald',
    name: 'Anodized Patina',
    glassColor: '#6b9080',
    attenuationColor: '#065f46',
    edgeColor: '#1f2937',
    hoverEdgeColor: '#0f172a',
    coreColor: '#10b981',
    swatchHex: '#6b9080',
  },
};

export const PUZZLE_LEVELS: PuzzleLevel[] = [
  {
    id: 'level-1-monument',
    number: '01',
    title: '01. Sunlit Balconies',
    subtitle:
      'Use the Tower Crane to move modules that shade the neighboring balcony residents and stack all Staging Area blocks in the Central Zone.',
    windowCoordinates: [
      [-2, 0],
      [-2, 2],
      [-1, 0],
      [-1, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
    pieces: [
      {
        id: 'p1-base-beam',
        name: 'Podium Retail Base (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        targetPosition: [-1, 0, 1],
        initialPosition: [-1, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-pillar',
        name: 'Glass Curtain Core (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        targetPosition: [0, 1, 1],
        initialPosition: [-1, 1, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-pyramid',
        name: 'Tapered Spire Module (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        targetPosition: [0, 3, 1],
        initialPosition: [-2, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-prism',
        name: 'Skylight Prism Unit (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        targetPosition: [1, 0, 1],
        initialPosition: [0, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-cube',
        name: 'Pre-Cast Corner Module (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        targetPosition: [2, 0, 1],
        initialPosition: [2, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-2-temple',
    number: '02',
    title: '02. Twin Neighbor Terraces',
    subtitle:
      'Relocate the 2×2 Atrium casting a 60° sun shadow onto the West Tower balconies and crane all Staging Area units into sunlit central columns.',
    windowCoordinates: [
      [-2, 0],
      [-2, 1],
      [-1, 0],
      [-1, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
    ],
    pieces: [
      {
        id: 'p2-large-block',
        name: 'Double-Height Atrium (2×2×1)',
        shape: 'cube-large',
        dims: [2, 2, 1],
        targetPosition: [-1, 0, 1],
        initialPosition: [-2, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-prism',
        name: 'Solar Gable Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        targetPosition: [0, 2, 1],
        initialPosition: [-2, 0, 3],
        accentColor: '#a78bfa',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-deep-beam',
        name: 'Cantilever Annex (1×1×2)',
        shape: 'beam-deep',
        dims: [1, 1, 2],
        targetPosition: [1, 0, 0],
        initialPosition: [0, 0, 3],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-pyramid',
        name: 'Penthouse Crown (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        targetPosition: [0, 3, 1],
        initialPosition: [1, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-cube',
        name: 'Steel Frame Module (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        targetPosition: [-1, 2, 1],
        initialPosition: [2, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-3-citadel',
    number: '03',
    title: '03. Stepback Balcony Zoning',
    subtitle:
      'Keep the 60° sunbeams clear of all 10 neighboring balconies while stacking every modular unit with the Tower Crane.',
    windowCoordinates: [
      [-2, 0],
      [-2, 1],
      [-2, 2],
      [-1, 0],
      [-1, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    pieces: [
      {
        id: 'p3-wide-wall',
        name: 'Foundation Podium (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        targetPosition: [-2, 0, 1],
        initialPosition: [1, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-tall-tower',
        name: 'Stepback Core Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        targetPosition: [0, 0, 1],
        initialPosition: [1, 1, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-prism',
        name: 'Mechanical Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        targetPosition: [-1, 1, 1],
        initialPosition: [-2, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-pyramid',
        name: 'Beacon Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        targetPosition: [0, 2, 1],
        initialPosition: [-1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-deep',
        name: 'Deep Plaza Module (1×1×2)',
        shape: 'beam-deep',
        dims: [1, 1, 2],
        targetPosition: [1, 0, 0],
        initialPosition: [1, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-cube',
        name: 'Steel Frame Unit (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        targetPosition: [1, 1, 1],
        initialPosition: [2, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-4-observatory',
    number: '04',
    title: '04. High-Rise Solar Terrace',
    subtitle:
      'Construct a 6-module tower in the central plot so the single 60° sun casts zero shadows onto the 12 neighboring balconies.',
    windowCoordinates: [
      [-2, 0],
      [-2, 1],
      [-2, 2],
      [-1, 0],
      [-1, 1],
      [-1, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    pieces: [
      {
        id: 'p4-core',
        name: 'Central Core Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        targetPosition: [0, 0, 1],
        initialPosition: [-1, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-cyl',
        name: 'Cylindrical Atrium (1×2×1)',
        shape: 'cylinder',
        dims: [1, 2, 1],
        targetPosition: [0, 0, 2],
        initialPosition: [-2, 0, 3],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'circle',
      },
      {
        id: 'p4-beam-w',
        name: 'Skywalk Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        targetPosition: [-1, 0, 0],
        initialPosition: [-1, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-pyramid',
        name: 'Pre-Cast Habitat (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        targetPosition: [1, 0, 1],
        initialPosition: [1, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-sphere',
        name: 'Observatory Dome (1×1×1)',
        shape: 'sphere',
        dims: [1, 1, 1],
        targetPosition: [0, 2, 1],
        initialPosition: [2, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'circle',
        floorSilhouette: 'circle',
      },
      {
        id: 'p4-octa',
        name: 'Diamond Crown Spire (1×1×1)',
        shape: 'octahedron',
        dims: [1, 1, 1],
        targetPosition: [0, 3, 1],
        initialPosition: [0, 0, 4],
        accentColor: '#fb923c',
        wallSilhouette: 'diamond',
        floorSilhouette: 'diamond',
      },
    ],
  },
];
