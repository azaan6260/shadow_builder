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
  | 'octahedron'
  | 'pipe-frame';

/**
 * Returns true if the given block shape is opaque and casts a solar shadow.
 * The 'pipe-frame' (Open Steel Pipe Cube) is hollow and lets 100% of sunlight pass through!
 */
export function doesShapeBlockSun(shape: ShapeKind): boolean {
  return shape !== 'pipe-frame';
}

/**
 * 2D silhouette profile cast onto the Vertical Screen (XY) or Ground (XZ)
 */
export type SilhouetteProfile = 'rect' | 'circle' | 'triangle' | 'diamond';

export interface WallPiece {
  id: string;
  name: string;
  shape: ShapeKind;
  /** Dimensions in grid units [widthX, heightY, depthZ] for current orientation */
  dims: [number, number, number];
  /** Unrotated original dimensions [w0, h0, d0] for 3D geometry rendering */
  baseDims?: [number, number, number];
  /** 3D Euler rotation [rx, ry, rz] in radians around X, Y, Z axes */
  rotation?: [number, number, number];
  /** Current integer anchor position [x, y, z] in the 3D wall workspace (-3..3) */
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
  /** 7x7 occupancy grid on the Neighboring Buildings Wall (XY) */
  wallGrid: Array<
    Array<{
      target: boolean;
      current: boolean;
      isWindow?: boolean;
      isBlockedWindow?: boolean;
      profile?: SilhouetteProfile;
    }>
  >;
  /** 7x7 occupancy grid on the Central Building Zone Ground (XZ) */
  floorGrid: Array<Array<{ target: boolean; current: boolean; profile?: SilhouetteProfile }>>;
  wallStencils: StencilElement[];
  floorStencils: StencilElement[];
}

export interface PuzzleLevel {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  /** X and Y coordinates of Balconies with residents on the Neighboring Buildings (-3..3, 0..4) */
  windowCoordinates: Array<[number, number]>;
  /** Limited buildable (x, z) floor coordinates inside the Central Building Zone (-3..3, -2..2). Non-listed cells are restricted courtyard gardens. */
  allowedFloorCells: Array<[number, number]>;
  pieces: Omit<WallPiece, 'position'>[];
}

/**
 * Single Sun Light Position at the top-back at a 40-degree elevation angle from the ground,
 * centered at X = 0 so prominent shadows are directed straight towards the Neighboring Buildings (-Z):
 * Horizontal distance = 12; Vertical height = 12 * tan(40°) ≈ 10.07
 */
export const LIGHT_POSITION: [number, number, number] = [0, 10.07, 12];

/** Grid Z coordinate of the protruding Neighboring Building balconies (just behind row z = -2) */
export const BALCONY_GRID_Z = -2.75;

/** Shared world Y coordinate of the urban ground / foundation plane */
export const FLOOR_WORLD_Y = -2.08;

/**
 * Uniform isotropic world size of a 1x1x1 modular block cell across X, Y, and Z.
 * At 0.56 world units, each block is a true 1:1:1 cube that is half the height of a
 * Neighboring Building floor (BUILDING_FLOOR_BLOCK_RATIO = 2.0 -> 1.12 world units per story),
 * ensuring blocks keep 100% identical proportions whether oriented horizontally or vertically!
 */
export const BLOCK_SPACING = 0.56;

/** 7-Column X Grid (-3..+3) for compact modular skyscraper blocks */
export const GRID_MIN = -3;
export const GRID_MAX = 3;
export const GRID_COORDS = [-3, -2, -1, 0, 1, 2, 3] as const;

/** Central Building Zone Z Grid (-2..+2) */
export const GRID_Z_MIN = -2;
export const GRID_Z_MAX = 2;
export const GRID_Z_COORDS = [-2, -1, 0, 1, 2] as const;

/** Foreground Staging Area Z coordinates where unplaced skyscraper blocks sit */
export const STAGING_Z_MIN = 3;
export const STAGING_Z_MAX = 4;
export const STAGING_Z_COORDS = [3, 4] as const;
export const ALL_Z_MAX = 4;

export const GRID_Y_MIN = 0;
export const GRID_Y_MAX = 14;
export const GRID_Y_COORDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

/**
 * Isotropic Y-to-XZ block ratio (1.0 = exact cube in all 3 axes so rotating a block
 * vertically never squashes its height or distorts its aspect ratio).
 */
export const BLOCK_HEIGHT_SCALE = 1.0;

/**
 * Number of stacked cubic block units that equal one full Neighboring Building story.
 * At 2.0, each 1x1x1 block is half a building floor tall, and 2 stacked blocks equal 1 story.
 */
export const BUILDING_FLOOR_BLOCK_RATIO = 2.0;

/** Base vertical offset (in block units above FLOOR_WORLD_Y) for Floor 0 balconies */
export const BALCONY_BASE_BLOCK_Y = 0.72;

/**
 * Rotates a piece 90 degrees around the world X, Y, or Z axis:
 * - Swaps grid dimensions `[w, h, d]`:
 *   - X-axis: `[w, d, h]`
 *   - Y-axis: `[d, h, w]`
 *   - Z-axis: `[h, w, d]`
 * - Updates the 3D Euler rotation `[rx, ry, rz]` (intrinsic XYZ order) via exact 3x3 orthogonal matrix pre-multiplication
 *   so chained X, Y, and Z rotations always align with the world grid without gimbal lock.
 */
export function rotatePieceByAxis(
  currentDims: [number, number, number],
  currentRotation: [number, number, number] = [0, 0, 0],
  axis: 'x' | 'y' | 'z'
): { dims: [number, number, number]; rotation: [number, number, number] } {
  const [w, h, d] = currentDims;
  const nextDims: [number, number, number] =
    axis === 'x'
      ? [w, d, h]
      : axis === 'y'
      ? [d, h, w]
      : [h, w, d];

  const [rx, ry, rz] = currentRotation;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  // Current rotation matrix M = Rx(rx) * Ry(ry) * Rz(rz) (Three.js 'XYZ' Euler order)
  const m00 = cy * cz;
  const m01 = -cy * sz;
  const m02 = sy;
  const m10 = sx * sy * cz + cx * sz;
  const m11 = -sx * sy * sz + cx * cz;
  const m12 = -sx * cy;
  const m20 = -cx * sy * cz + sx * sz;
  const m21 = cx * sy * sz + sx * cz;
  const m22 = cx * cy;

  // Pre-multiply by 90-degree world rotation around `axis`: R_next = R_axis(pi/2) * M
  let n00 = m00, n01 = m01, n02 = m02;
  let n10 = m10, n11 = m11, n12 = m12;
  let n20 = m20, n21 = m21, n22 = m22;

  if (axis === 'x') {
    // Rx(90°): row0 = row0, row1 = -row2, row2 = row1
    n10 = -m20; n11 = -m21; n12 = -m22;
    n20 = m10;  n21 = m11;  n22 = m12;
  } else if (axis === 'y') {
    // Ry(90°): row0 = row2, row1 = row1, row2 = -row0
    n00 = m20;  n01 = m21;  n02 = m22;
    n20 = -m00; n21 = -m01; n22 = -m02;
  } else {
    // Rz(90°): row0 = -row1, row1 = row0, row2 = row2
    n00 = -m10; n01 = -m11; n02 = -m12;
    n10 = m00;  n11 = m01;  n12 = m02;
  }

  // Extract Three.js 'XYZ' Euler angles from R_next
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const nextRy = Math.asin(clamp(n02));
  let nextRx = 0;
  let nextRz = 0;
  if (Math.abs(n02) < 0.9999) {
    nextRx = Math.atan2(-n12, n22);
    nextRz = Math.atan2(-n01, n00);
  } else {
    nextRx = Math.atan2(n21, n11);
    nextRz = 0;
  }

  // Snap to clean multiples of pi/2 to avoid floating-point drift
  const snapQuarter = (rad: number) => {
    const q = Math.round(rad / (Math.PI / 2)) * (Math.PI / 2);
    return Math.abs(q) < 1e-6 ? 0 : q;
  };

  return {
    dims: nextDims,
    rotation: [snapQuarter(nextRx), snapQuarter(nextRy), snapQuarter(nextRz)],
  };
}

/**
 * Deterministic irregular offset [offX, offY, offZ] in grid units for a balcony at [wx, wy]
 * so balconies are arranged in an organic, non-regular staggered architectural pattern.
 */
export function getBalconyOffset(
  wx: number,
  wy: number
): [number, number, number] {
  const s1 = Math.sin(wx * 12.9898 + wy * 78.233) * 43758.5453;
  const fx = s1 - Math.floor(s1);
  const s2 = Math.sin(wx * 39.346 + wy * 11.135) * 23421.631;
  const fy = s2 - Math.floor(s2);
  const s3 = Math.sin(wx * 73.156 + wy * 52.719) * 19283.412;
  const fz = s3 - Math.floor(s3);

  const offX = (fx - 0.5) * 0.28;
  const offY = (fy - 0.5) * 0.26;
  const offZ = (fz - 0.5) * 0.1;
  return [offX, offY, offZ];
}

/**
 * Returns true if the piece is completely inside the Central Building Zone
 * (x in [-3..3] and z in [-2..2]).
 * If the piece is touching the ground (`y === 0`), all of its floor cells must belong to `allowedFloorSet`.
 * If the piece is stacked or cantilevered on top of another block (`y > 0`), it is not touching the ground
 * and is allowed to overhang non-buildable grass cells!
 */
export function isPieceInCentralZone(
  piece: Pick<WallPiece, 'position' | 'dims'>,
  allowedFloorSet?: Set<string>
): boolean {
  const [x, y, z] = piece.position;
  const [w, , d] = piece.dims;
  const insideBounds =
    x >= GRID_MIN &&
    x + w - 1 <= GRID_MAX &&
    z >= GRID_Z_MIN &&
    z + d - 1 <= GRID_Z_MAX;
  if (!insideBounds) return false;

  if (y === 0 && allowedFloorSet && allowedFloorSet.size > 0) {
    for (let dx = 0; dx < w; dx++) {
      for (let dz = 0; dz < d; dz++) {
        if (!allowedFloorSet.has(`${x + dx},${z + dz}`)) {
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * Computes the world center offset of a piece given its integer anchor [x, y, z] and dimensions [w, h, d].
 * Uses uniform isotropic `spacing` across X, Y, and Z so every block rotates rigidly with exact proportions
 * and y = 0 rests flush on `FLOOR_WORLD_Y`.
 */
export function getPieceWorldCenter(
  pos: [number, number, number],
  dims: [number, number, number],
  spacing = BLOCK_SPACING
): [number, number, number] {
  const unitH = spacing * BLOCK_HEIGHT_SCALE;
  return [
    (pos[0] + (dims[0] - 1) * 0.5) * spacing,
    FLOOR_WORLD_Y + (pos[1] + dims[1] * 0.5) * unitH,
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
 * coordinates (`y = 0`) under the 40-degree directional sun light at `[lightX, lightY, lightZ]`:
 *   shadowX = x - (lightX / lightY) * (y + 1)
 *   shadowZ = z - (lightZ / lightY) * (y + 1)
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
    if (!block.visible || !doesShapeBlockSun(block.shape)) continue;
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
 * (X: -3..3, Y: 0..8, Z: -2..4 including the Central Building Zone [-2..2] and Staging Area [3..4]),
 * respects `allowedFloorSet` when touching the ground (`candidatePos[1] === 0`) inside the Central Building Zone,
 * allows cantilever positions (`candidatePos[1] > 0`) overhanging non-buildable grass cells since they do not touch the ground,
 * and does not collide with any other piece.
 */
export function isValidPiecePosition(
  pieces: WallPiece[],
  movingPieceId: string,
  candidatePos: [number, number, number],
  dims: [number, number, number],
  allowedFloorSet?: Set<string>
): boolean {
  if (
    candidatePos[0] < GRID_MIN ||
    candidatePos[0] + dims[0] - 1 > GRID_MAX ||
    candidatePos[1] < GRID_Y_MIN ||
    candidatePos[1] + dims[1] - 1 > GRID_Y_MAX ||
    candidatePos[2] < GRID_Z_MIN ||
    candidatePos[2] + dims[2] - 1 > ALL_Z_MAX
  ) {
    return false;
  }

  // Prevent a single block from straddling across the Central Zone (z <= 2) and Staging Area (z >= 3).
  const minZ = candidatePos[2];
  const maxZ = candidatePos[2] + dims[2] - 1;
  if (minZ <= GRID_Z_MAX && maxZ > GRID_Z_MAX) {
    return false;
  }

  // Enforce limited buildable floor spaces ONLY when the block is touching the ground (candidatePos[1] === 0).
  // When candidatePos[1] > 0, the block is supported on top of another block (including cantilever positions
  // overhanging the grass) and is NOT touching the ground, so it is allowed!
  if (
    candidatePos[1] === 0 &&
    allowedFloorSet &&
    allowedFloorSet.size > 0 &&
    maxZ <= GRID_Z_MAX
  ) {
    for (let dx = 0; dx < dims[0]; dx++) {
      for (let dz = 0; dz < dims[2]; dz++) {
        const cx = candidatePos[0] + dx;
        const cz = candidatePos[2] + dz;
        if (!allowedFloorSet.has(`${cx},${cz}`)) {
          return false;
        }
      }
    }
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
 * Counts how many cells of a piece's bottom footprint `[cx..cx+w-1, cz..cz+d-1]`
 * are directly supported at `y = dropY - 1` (or by the ground when `dropY === 0`).
 */
export function countSupportedBottomCells(
  cx: number,
  dropY: number,
  cz: number,
  dims: [number, number, number],
  settledOtherBlocks: BlockState[],
  excludePieceId?: string | null
): { supportedCells: number; supportingPieceIds: Set<string> } {
  const [w, , d] = dims;
  const supportingPieceIds = new Set<string>();

  if (dropY <= 0) {
    return { supportedCells: w * d, supportingPieceIds };
  }

  let supportedCells = 0;
  const supportY = dropY - 1;

  for (let dx = 0; dx < w; dx++) {
    for (let dz = 0; dz < d; dz++) {
      const bx = cx + dx;
      const bz = cz + dz;
      const supporter = settledOtherBlocks.find(
        (b) =>
          b.visible &&
          (!excludePieceId || b.pieceId !== excludePieceId) &&
          b.x === bx &&
          b.y === supportY &&
          b.z === bz
      );
      if (supporter) {
        supportedCells++;
        supportingPieceIds.add(supporter.pieceId);
      }
    }
  }

  return { supportedCells, supportingPieceIds };
}

/**
 * Resolves the best valid `[x, y, z]` landing position when a user clicks or hovers `(targetX, targetZ)`.
 * - Decides placement using the lower supporting block's top surface:
 *   1. Lands directly on the clicked lower block's top elevation (`dropY === targetCellTopY`) instead of
 *      jumping up onto an adjacent taller block and hanging over the clicked block.
 *   2. Maximizes bottom-face support coverage (`supportedCells`) so multi-cell blocks snap flush onto
 *      matching lower blocks instead of hanging half off the edge.
 *   3. On narrow vertical support blocks (where left & right cantilever anchors have equal support),
 *      uses `preferLeftX` / `preferBackZ` sub-cell aiming and click-toggling to pick either side.
 */
export function resolveBestPlacementAnchor(
  targetPiece: WallPiece,
  targetX: number,
  targetZ: number,
  pieces: WallPiece[],
  allowedFloorSet?: Set<string>,
  preferLeftX = false,
  preferBackZ = false,
  avoidCurrentPosition = false
): {
  gridPos: [number, number, number];
  settledOthers: WallPiece[];
  isValid: boolean;
} {
  const otherPieces = pieces.filter((p) => p.id !== targetPiece.id);
  const settledOthers = settlePiecesWithGravity(otherPieces);
  const settledOtherBlocks = deriveBlocksFromPieces(settledOthers);

  const isTargetingStaging = targetZ >= STAGING_Z_MIN;
  const minZ = isTargetingStaging ? STAGING_Z_MIN : GRID_Z_MIN;
  const maxZ = isTargetingStaging
    ? ALL_Z_MAX - targetPiece.dims[2] + 1
    : GRID_Z_MAX - targetPiece.dims[2] + 1;

  const clampAnchor = (ax: number, az: number): [number, number] => [
    Math.max(GRID_MIN, Math.min(GRID_MAX - targetPiece.dims[0] + 1, ax)),
    Math.max(minZ, Math.min(maxZ, az)),
  ];

  // Build dx and dz search orders based on whether the user aimed at the left/right or back/front side
  const dxOrder: number[] = [];
  for (let dx = 0; dx < targetPiece.dims[0]; dx++) {
    dxOrder.push(preferLeftX ? targetPiece.dims[0] - 1 - dx : dx);
  }
  const dzOrder: number[] = [];
  for (let dz = 0; dz < targetPiece.dims[2]; dz++) {
    dzOrder.push(preferBackZ ? targetPiece.dims[2] - 1 - dz : dz);
  }

  // Candidate anchor offsets that cover (targetX, targetZ)
  const seenAnchors = new Set<string>();
  const candidateAnchors: Array<[number, number]> = [];
  for (const dx of dxOrder) {
    for (const dz of dzOrder) {
      const [cx, cz] = clampAnchor(targetX - dx, targetZ - dz);
      const key = `${cx},${cz}`;
      if (!seenAnchors.has(key)) {
        seenAnchors.add(key);
        candidateAnchors.push([cx, cz]);
      }
    }
  }

  // Exact top elevation of the clicked/hovered lower block at (targetX, targetZ)
  const targetCellTopY = calculateGravityDrop(
    targetX,
    targetZ,
    settledOtherBlocks,
    targetPiece.id,
    [1, 1, 1]
  );
  const hasSupportAtTargetCell = targetCellTopY > 0;

  interface EvaluatedCandidate {
    pos: [number, number, number];
    isValid: boolean;
    isCurrentPos: boolean;
    isElevated: boolean;
    restsOnTargetCell: boolean;
    supportedCells: number;
    orderIndex: number;
  }

  const evaluated: EvaluatedCandidate[] = candidateAnchors.map(([cx, cz], orderIndex) => {
    const dropY = calculateGravityDrop(
      cx,
      cz,
      settledOtherBlocks,
      targetPiece.id,
      targetPiece.dims
    );
    const pos: [number, number, number] = [cx, dropY, cz];

    const testPieces = pieces.map((p) =>
      p.id === targetPiece.id
        ? { ...p, position: pos }
        : settledOthers.find((s) => s.id === p.id) ?? p
    );

    const isValid = isValidPiecePosition(
      testPieces,
      targetPiece.id,
      pos,
      targetPiece.dims,
      allowedFloorSet
    );

    const isCurrentPos =
      pos[0] === targetPiece.position[0] &&
      pos[1] === targetPiece.position[1] &&
      pos[2] === targetPiece.position[2];

    const { supportedCells } = countSupportedBottomCells(
      cx,
      dropY,
      cz,
      targetPiece.dims,
      settledOtherBlocks,
      targetPiece.id
    );

    const restsOnTargetCell = hasSupportAtTargetCell
      ? dropY === targetCellTopY
      : dropY === 0;

    return {
      pos,
      isValid,
      isCurrentPos,
      isElevated: dropY > 0,
      restsOnTargetCell,
      supportedCells,
      orderIndex,
    };
  });

  // 1. Filter to valid candidates
  const validCandidates = evaluated.filter((c) => c.isValid);

  if (validCandidates.length > 0) {
    const nonCurrentValid = avoidCurrentPosition
      ? validCandidates.filter((c) => !c.isCurrentPos)
      : validCandidates;

    const pool = nonCurrentValid.length > 0 ? nonCurrentValid : validCandidates;

    // If the user clicked an empty cell adjacent to a tower while the selected piece is already stacked,
    // allow shifting the elevated cantilever onto that adjacent side
    if (!hasSupportAtTargetCell && targetPiece.position[1] > 0) {
      const elevatedMatch = pool.find((c) => c.isElevated);
      if (elevatedMatch) {
        return { gridPos: elevatedMatch.pos, settledOthers, isValid: true };
      }
    }

    // Sort valid candidates so placement is decided cleanly by the lower supporting block:
    // 1. Lands directly on the clicked cell's top surface (doesn't jump onto a taller neighbor and hang over it)
    // 2. Maximizes bottom-face support on the lower block(s) (prevents hanging half off when a flush fit exists)
    // 3. Preserves `preferLeftX` / `preferBackZ` aiming order on ties (e.g., left vs right cantilever on a 1x1 column)
    const ranked = [...pool].sort((a, b) => {
      if (a.restsOnTargetCell !== b.restsOnTargetCell) {
        return a.restsOnTargetCell ? -1 : 1;
      }
      if (a.supportedCells !== b.supportedCells) {
        return b.supportedCells - a.supportedCells;
      }
      return a.orderIndex - b.orderIndex;
    });

    return { gridPos: ranked[0].pos, settledOthers, isValid: true };
  }

  const fallbackPos =
    evaluated[0]?.pos ?? [
      targetPiece.position[0],
      targetPiece.position[1],
      targetPiece.position[2],
    ];

  return {
    gridPos: fallbackPos,
    settledOthers,
    isValid: false,
  };
}

/**
 * Checks if a Neighboring Building balcony at `[wx, wy]` (with irregular staggered offset `getBalconyOffset(wx, wy)`
 * and multiple residents standing on the terrace) is cast into shadow by any block in `centralZoneBlocks`
 * under the single 40-degree Sun at `lightPosition`.
 */
export function isBalconyShadedByBlocks(
  wx: number,
  wy: number,
  centralZoneBlocks: BlockState[],
  lightPosition: [number, number, number] = LIGHT_POSITION
): boolean {
  const [lx, ly, lz] = lightPosition;
  const [offX, offY, offZ] = getBalconyOffset(wx, wy);
  const bx = wx + offX;
  const by =
    BALCONY_BASE_BLOCK_Y +
    (wy + offY) * BUILDING_FLOOR_BLOCK_RATIO;
  const bz = BALCONY_GRID_Z + offZ;

  // Sample points across the balcony residents (left person, center, right person, upper & lower torso)
  const samplePoints: Array<[number, number, number]> = [
    [bx, by, bz],
    [bx - 0.2, by, bz],
    [bx + 0.2, by, bz],
    [bx, by + 0.34, bz - 0.06],
    [bx, by - 0.34, bz + 0.06],
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
    if (!block.visible || !doesShapeBlockSun(block.shape)) continue;
    const minX = block.x - 0.51;
    const maxX = block.x + 0.51;
    const minY = block.y * BLOCK_HEIGHT_SCALE - 0.02;
    const maxY = (block.y + 1) * BLOCK_HEIGHT_SCALE + 0.02;
    const minZ = block.z - 0.51;
    const maxZ = block.z + 0.51;

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
 * Phase 16: "Right to Light" Analytical Validator & Single 40° Sun Balcony Shadow Evaluator
 */
export function checkWinCondition(
  pieces: WallPiece[],
  windowCoordinates: Array<[number, number]> = [],
  allowedFloorSet?: Set<string>
): WinCheckResult {
  const blocks = deriveBlocksFromPieces(pieces);
  const visibleBlocks = blocks.filter((b) => b.visible === true);

  // Blocks placed inside the Central Building Zone (z in -2..2) can cast shadows onto the Neighboring Building balconies
  const centralZoneBlocks = visibleBlocks.filter(
    (b) => b.z >= GRID_Z_MIN && b.z <= GRID_Z_MAX
  );

  // 1. 2D Projected Shadow Coordinates on the Neighboring Buildings Wall
  const wallProjectionSet = new Set<string>(
    centralZoneBlocks.map((b) => `${b.x}-${b.y}`)
  );

  // 2. Ground Footprint in the Central Building Zone (XZ plane: "x-z")
  const floorProjectionSet = new Set<string>(
    centralZoneBlocks.map((b) => `${b.x}-${b.z}`)
  );

  // 3. Intersection check: Does the 40° Sun shadow from any block hit any balcony resident?
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

  // 4. Staging Area vs Central Building Zone placement check (respecting limited allowedFloorSet)
  let placedPiecesCount = 0;
  let unplacedPiecesCount = 0;
  for (const piece of pieces) {
    if (isPieceInCentralZone(piece, allowedFloorSet)) {
      placedPiecesCount++;
    } else {
      unplacedPiecesCount++;
    }
  }
  const allBlocksPlaced = unplacedPiecesCount === 0 && pieces.length > 0;

  // Angled Floor Shadow Projection under 40° Sun
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

  const wallGrid = Array.from({ length: 7 }, () =>
    Array.from({ length: 7 }, () => ({
      target: false,
      current: false,
      isWindow: false,
      isBlockedWindow: false,
      profile: undefined as SilhouetteProfile | undefined,
    }))
  );

  const floorGrid = Array.from({ length: 7 }, () =>
    Array.from({ length: 7 }, () => ({
      target: false,
      current: false,
      profile: undefined as SilhouetteProfile | undefined,
    }))
  );

  for (const [wx, wy] of windowCoordinates) {
    const gx = wx + 3;
    const gy = wy;
    if (gx >= 0 && gx < 7 && gy >= 0 && gy < 7) {
      const isBlocked = blockedWindowSet.has(`${wx}-${wy}`);
      wallGrid[gy][gx].target = true;
      wallGrid[gy][gx].isWindow = true;
      wallGrid[gy][gx].isBlockedWindow = isBlocked;
      wallGrid[gy][gx].profile = 'rect';
    }
  }

  let sunSafePiecesCount = 0;
  for (const piece of pieces) {
    const [w, h, d] = piece.dims;
    const [cx, cy, cz] = piece.position;
    const inCentral = isPieceInCentralZone(piece, allowedFloorSet);

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
          const gx = cx + dx + 3;
          const gy = cy + dy;
          if (gx >= 0 && gx < 7 && gy >= 0 && gy < 7) {
            wallGrid[gy][gx].current = true;
          }
        }
        for (let dz = 0; dz < d; dz++) {
          const gx = cx + dx + 3;
          const gz = cz + dz + 2;
          if (gx >= 0 && gx < 7 && gz >= 0 && gz < 7) {
            floorGrid[gz][gx].current = true;
            floorGrid[gz][gx].target = true;
            floorGrid[gz][gx].profile = piece.floorSilhouette;
          }
        }
      }
    }
  }

  const totalPieces = pieces.length;
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
  { id: 'iso-ne', label: 'Isometric NE', position: [12, 10.5, 13], zoom: 60 },
  { id: 'iso-nw', label: 'Isometric NW', position: [-12, 10.5, 13], zoom: 60 },
  { id: 'iso-se', label: 'Isometric SE', position: [12, 10.5, -12], zoom: 60 },
  { id: 'front', label: 'Neighbor Balconies (XY)', position: [0, 0, 16], zoom: 68 },
  { id: 'top', label: 'Site Plan (XZ)', position: [0.01, 16, 0.8], zoom: 62 },
  { id: 'side', label: 'Elevation (YZ)', position: [16, 0, 0.8], zoom: 64 },
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

const EXTRA_HALF_HEIGHT_POOL: Array<{
  suffix: string;
  name: string;
  shape: ShapeKind;
  dims: [number, number, number];
  startPos: [number, number, number];
  targetPos: [number, number, number];
  accentColor: string;
  wallSilhouette: SilhouetteProfile;
  floorSilhouette: SilhouetteProfile;
}> = [
  {
    suffix: 'half-mod-a',
    name: 'Half-Story Terrace Pod A (1×1×1)',
    shape: 'cube',
    dims: [1, 1, 1],
    startPos: [-3, 1, 3],
    targetPos: [-3, 2, 2],
    accentColor: '#38bdf8',
    wallSilhouette: 'rect',
    floorSilhouette: 'rect',
  },
  {
    suffix: 'half-mod-b',
    name: 'Half-Story Prism Louver (1×1×1)',
    shape: 'prism',
    dims: [1, 1, 1],
    startPos: [3, 1, 3],
    targetPos: [3, 2, 2],
    accentColor: '#34d399',
    wallSilhouette: 'triangle',
    floorSilhouette: 'rect',
  },
  {
    suffix: 'half-pipe-a',
    name: 'Half-Story Open Pipe Cube (1×1×1 — Sun Passes Through)',
    shape: 'pipe-frame',
    dims: [1, 1, 1],
    startPos: [0, 1, 4],
    targetPos: [0, 2, 2],
    accentColor: '#2dd4bf',
    wallSilhouette: 'rect',
    floorSilhouette: 'rect',
  },
  {
    suffix: 'half-mod-c',
    name: 'Half-Story Cantilever Span (2×1×1)',
    shape: 'beam-wide',
    dims: [2, 1, 1],
    startPos: [-2, 1, 4],
    targetPos: [-2, 3, 2],
    accentColor: '#fbbf24',
    wallSilhouette: 'rect',
    floorSilhouette: 'rect',
  },
  {
    suffix: 'half-mod-d',
    name: 'Half-Story East Span (2×1×1)',
    shape: 'beam-wide',
    dims: [2, 1, 1],
    startPos: [1, 1, 4],
    targetPos: [1, 3, 2],
    accentColor: '#f43f5e',
    wallSilhouette: 'rect',
    floorSilhouette: 'rect',
  },
  {
    suffix: 'half-pipe-b',
    name: 'Half-Story Pipe Truss Cube (1×1×1 — Sun Passes Through)',
    shape: 'pipe-frame',
    dims: [1, 1, 1],
    startPos: [-1, 1, 3],
    targetPos: [-1, 3, 2],
    accentColor: '#38bdf8',
    wallSilhouette: 'rect',
    floorSilhouette: 'rect',
  },
  {
    suffix: 'half-mod-e',
    name: 'Half-Story Crown Spire (1×1×1)',
    shape: 'pyramid',
    dims: [1, 1, 1],
    startPos: [1, 1, 3],
    targetPos: [2, 3, 2],
    accentColor: '#e879f9',
    wallSilhouette: 'triangle',
    floorSilhouette: 'rect',
  },
];

function enrichLevelsWithHalfHeightBlocks(baseLevels: PuzzleLevel[]): PuzzleLevel[] {
  return baseLevels.map((lvl, idx) => {
    // Levels 01-04 get +4 extra blocks (12-16 total); Levels 05-12 get +5 extra blocks (15-17 total); Levels 13-20 get +6 to +7 extra blocks (18-21 total)
    const extraCount = idx < 4 ? 4 : idx < 12 ? 5 : idx < 17 ? 6 : 7;
    const extraPieces: Omit<WallPiece, 'position'>[] = EXTRA_HALF_HEIGHT_POOL.slice(
      0,
      extraCount
    ).map((tpl) => ({
      id: `${lvl.id}-${tpl.suffix}`,
      name: tpl.name,
      shape: tpl.shape,
      dims: [...tpl.dims] as [number, number, number],
      baseDims: [...tpl.dims] as [number, number, number],
      rotation: [0, 0, 0],
      targetPosition: [...tpl.targetPos] as [number, number, number],
      initialPosition: [...tpl.startPos] as [number, number, number],
      accentColor: tpl.accentColor,
      wallSilhouette: tpl.wallSilhouette,
      floorSilhouette: tpl.floorSilhouette,
    }));

    const allPieces = [...lvl.pieces, ...extraPieces];

    return {
      ...lvl,
      subtitle: `${lvl.subtitle.replace(/\b\d+\s+(?:skyscraper\s+|modular\s+|structural\s+|arcology\s+)?(?:modules|blocks|units)\b/i, `${allPieces.length} half-story modules`)}`,
      pieces: allPieces,
    };
  });
}

const RAW_PUZZLE_LEVELS: PuzzleLevel[] = [
  {
    id: 'level-1-monument',
    number: '01',
    title: '01. Courtyard Garden Setbacks',
    subtitle:
      'Rotate blocks around X, Y, and Z to fit all 8 skyscraper modules onto the 14 limited concrete pads while keeping 12 irregular neighbor balconies in the 40° sun.',
    windowCoordinates: [
      [-3, 0],
      [-3, 3],
      [-2, 1],
      [-2, 4],
      [-1, 0],
      [-1, 2],
      [0, 3],
      [1, 1],
      [1, 4],
      [2, 0],
      [2, 2],
      [3, 1],
    ],
    // Only 14 buildable structural pads out of 35 cells (the other 21 cells are lush courtyard gardens!)
    allowedFloorCells: [
      // Rear row piers (initial shaded positions that must be relocated/rotated)
      [-3, -2],
      [-2, -2],
      [-1, -2],
      [2, -2],
      // Limited sun-safe structural islands surrounded by courtyard gardens
      [-3, 1],
      [-3, 2],
      [-2, 2],
      [0, 0],
      [0, 1],
      [0, 2],
      [2, 1],
      [2, 2],
      [3, 1],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p1-base-beam',
        name: 'Podium Retail Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-pillar',
        name: 'Glass Curtain Core (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-east-cube',
        name: 'Corner Habitat Unit (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [2, 0, -2],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-deep-span',
        name: 'Garden Bridge Span (2×1×1)',
        shape: 'beam-wide',
        // Starts wide [2,1,1] in staging; rotate around Y-axis to [1,1,2] to fit the narrow [0,0..1] pier!
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 1],
        initialPosition: [-3, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-prism',
        name: 'Skylight Prism Unit (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-1, 0, 3],
        accentColor: '#fb923c',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-cube-a',
        name: 'Pre-Cast Terrace Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-cube-b',
        name: 'Modular Loft Cube (1×1×1)',
        shape: 'cube-small',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 1],
        initialPosition: [3, 0, 3],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-wedge',
        name: 'Open Pipe Truss (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 0],
        initialPosition: [0, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p1-pipe-support',
        name: 'Hollow Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 2],
        initialPosition: [-2, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-2-temple',
    number: '02',
    title: '02. Botanical Pocket Piers',
    subtitle:
      'Use X, Y, and Z rotations to orient 9 asymmetric modules onto 15 scattered foundation piers without intruding on the garden courtyard or shading 13 balconies.',
    windowCoordinates: [
      [-3, 1],
      [-3, 4],
      [-2, 0],
      [-2, 2],
      [-1, 1],
      [-1, 3],
      [0, 2],
      [0, 4],
      [1, 0],
      [1, 3],
      [2, 1],
      [2, 4],
      [3, 0],
    ],
    // 15 buildable structural cells arranged in 3 tight islands separated by gardens
    allowedFloorCells: [
      [-2, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // West L-island
      [-3, 1],
      [-3, 2],
      [-2, 2],
      // Central 2x2 atrium pad
      [-1, 1],
      [0, 1],
      [-1, 2],
      [0, 2],
      // East narrow spine & corner pad
      [1, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p2-large-block',
        name: 'Double-Height Atrium (2×2×1)',
        shape: 'cube-large',
        dims: [2, 2, 1],
        baseDims: [2, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 2],
        initialPosition: [-2, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-east-pillar',
        name: 'Rotatable Tower Column (1×2×1)',
        shape: 'pillar-tall',
        // Can be rotated around X or Z to lie flat as [1,1,2] or [2,1,1] on the foundation pads!
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-west-cube',
        name: 'West Corner Module (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-prism',
        name: 'Solar Gable Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#a78bfa',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-deep-beam',
        name: 'Cantilever Annex (2×1×1)',
        shape: 'beam-wide',
        // Starts wide [2,1,1] in staging; rotate around Y to [1,1,2] to fit [1, 1..2]!
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 1],
        initialPosition: [-1, 0, 3],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-pyramid',
        name: 'Penthouse Crown (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-cube-b',
        name: 'Steel Frame Module (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 1],
        initialPosition: [3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-sphere',
        name: 'Geodesic Lounge Pod (1×1×1)',
        shape: 'sphere',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 1],
        initialPosition: [-2, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'circle',
        floorSilhouette: 'circle',
      },
      {
        id: 'p2-octa',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 2],
        initialPosition: [2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p2-pipe-b',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-3-citadel',
    number: '03',
    title: '03. Diagonal Greenway Zoning',
    subtitle:
      'Rotate beams and columns in 3D (X/Y/Z) to bridge 15 diagonal structural pads while keeping 14 neighbor balconies completely sunlit.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [-1, 4],
      [0, 3],
      [1, 0],
      [1, 2],
      [2, 1],
      [2, 3],
      [3, 0],
      [3, 2],
    ],
    // 15 buildable structural cells with a diagonal greenway park cutting across the plot
    allowedFloorCells: [
      [-3, -2],
      [-2, -2],
      [-1, -2],
      [1, -2],
      [2, -2],
      [3, -2],
      // Buildable forward & mid pads
      [-3, 1],
      [-3, 2],
      [-2, 2],
      [0, 0],
      [0, 1],
      [0, 2],
      [2, 1],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p3-wide-wall',
        name: 'Foundation Podium (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-tall-tower',
        name: 'Stepback Core Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-east-beam',
        name: 'East Plaza Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-corner-cube',
        name: 'Terrace Corner Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 1],
        initialPosition: [3, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-prism',
        name: 'Mechanical Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 1],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-pyramid',
        name: 'Beacon Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-deep',
        name: 'Deep Plaza Module (2×1×1)',
        shape: 'beam-wide',
        // Starts as [2, 1, 1] in staging; rotate around Y-axis to [1, 1, 2] to fit [0, 0..1]!
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-cube-a',
        name: 'Steel Frame Unit (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 0],
        initialPosition: [3, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-wedge',
        name: 'Cantilever Wedge (1×1×1)',
        shape: 'wedge',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-2, 0, 4],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-sphere',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p3-pipe-b',
        name: 'Hollow Pipe Truss Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-4-observatory',
    number: '04',
    title: '04. Metropolitan Eco-Tower',
    subtitle:
      'Master 3-axis block rotation (X, Y, Z) to interlock 11 skyscraper modules onto 16 tight foundation cells while preserving sunlight on all 15 neighbor balconies.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-3, 4],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [0, 2],
      [0, 4],
      [1, 1],
      [1, 3],
      [2, 0],
      [2, 2],
      [3, 1],
      [3, 3],
    ],
    // 16 buildable cells surrounded by 19 restricted garden sanctuary cells
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [2, -2],
      [3, -2],
      // West narrow pier (1x3 along Z)
      [-3, 0],
      [-3, 1],
      [-3, 2],
      // Central T-pad
      [-1, 2],
      [0, 1],
      [0, 2],
      [1, 2],
      // East stepped island
      [2, 1],
      [2, 2],
      [3, 1],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p4-core',
        name: 'Central Core Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-cyl',
        name: 'Cylindrical Atrium (1×2×1)',
        shape: 'cylinder',
        // Rotate around X or Z to place horizontally or stack carefully!
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'circle',
      },
      {
        id: 'p4-beam-w',
        name: 'Skywalk Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-east-cube',
        name: 'East Terrace Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-habitat',
        name: 'Pre-Cast Habitat (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-prism',
        name: 'Angled Louver Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#fb923c',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-deep',
        name: 'Promenade Bridge (2×1×1)',
        shape: 'beam-wide',
        // Starts wide [2,1,1] in staging; rotate around Y-axis to [1,1,2] to fit West pier [-3, 0..1]!
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 1],
        initialPosition: [1, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-pyramid',
        name: 'Lantern Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 0],
        initialPosition: [3, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-sphere',
        name: 'Observatory Dome (1×1×1)',
        shape: 'sphere',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-2, 0, 4],
        accentColor: '#f43f5e',
        wallSilhouette: 'circle',
        floorSilhouette: 'circle',
      },
      {
        id: 'p4-octa',
        name: 'Diamond Crown Spire (1×1×1)',
        shape: 'octahedron',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 1],
        initialPosition: [0, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'diamond',
        floorSilhouette: 'diamond',
      },
      {
        id: 'p4-wedge',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 1],
        initialPosition: [2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p4-pipe-b',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-1, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-5-cantilever-gate',
    number: '05',
    title: '05. Twin Pier Cantilever Gate',
    subtitle:
      'Use the two open pipe-frame cubes and 3-axis rotations to bridge 13 twin-pier foundation slots while keeping 14 neighbor balconies in direct sunlight.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 0],
      [-2, 2],
      [-1, 1],
      [-1, 3],
      [0, 0],
      [0, 2],
      [1, 1],
      [1, 3],
      [2, 0],
      [2, 2],
      [3, 0],
      [3, 2],
    ],
    // 13 buildable foundation cells (4 back row + 9 forward pier pads)
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // Twin West & East piers + central anchor
      [-3, 1],
      [-3, 2],
      [-2, 2],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 1],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p5-core-w',
        name: 'West Anchor Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-core-e',
        name: 'East Anchor Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-span-mid',
        name: 'Central Promenade Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-cantilever-top',
        name: 'Cantilever Skybridge (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [0, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-cube-a',
        name: 'Terrace Habitat Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-cube-b',
        name: 'East Corner Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-prism',
        name: 'Solar Louver Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 1],
        initialPosition: [2, 0, 3],
        accentColor: '#a78bfa',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-pyramid',
        name: 'Penthouse Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-pipe-a',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-1, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p5-pipe-b',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 1],
        initialPosition: [2, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-6-sunken-garden',
    number: '06',
    title: '06. Sunken Botanical Courtyard',
    subtitle:
      'A central botanical garden blocks the middle floor; stack and cantilever 10 modules across the outer perimeter piers without shading 15 balconies.',
    windowCoordinates: [
      [-3, 1],
      [-3, 3],
      [-2, 0],
      [-2, 2],
      [-2, 4],
      [-1, 1],
      [-1, 3],
      [0, 0],
      [0, 2],
      [1, 1],
      [1, 3],
      [2, 0],
      [2, 2],
      [3, 1],
      [3, 3],
    ],
    // 12 buildable cells forming an outer horseshoe around a central garden
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // Outer West pier
      [-3, 0],
      [-3, 1],
      [-3, 2],
      [-2, 2],
      // Outer East pier
      [2, 2],
      [3, 0],
      [3, 1],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p6-beam-w',
        name: 'West Promenade Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p6-beam-e',
        name: 'East Promenade Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p6-deep-w',
        name: 'West Deep Arcade (2×1×1)',
        shape: 'beam-wide',
        // Rotate around Y-axis to [1,1,2] to fit [-3, 0..1]
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p6-deep-e',
        name: 'East Deep Arcade (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 1, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p6-cube-1',
        name: 'West Corner Module (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 0],
        initialPosition: [-3, 0, -2],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p6-cube-2',
        name: 'East Corner Module (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 0],
        initialPosition: [-1, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p6-wedge',
        name: 'Solar Wedge Unit (1×1×1)',
        shape: 'wedge',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p6-octa',
        name: 'Diamond Beacon (1×1×1)',
        shape: 'octahedron',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 2, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'diamond',
        floorSilhouette: 'diamond',
      },
      {
        id: 'p6-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 1],
        initialPosition: [-1, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p6-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 1],
        initialPosition: [-1, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-7-skybridge-arch',
    number: '07',
    title: '07. Overhanging Skybridge Arch',
    subtitle:
      'Cantilever horizontal beams to the left and right on top of vertical columns to clear the lawn while keeping all 15 neighbor balconies sunlit.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [0, 1],
      [0, 3],
      [0, 4],
      [1, 0],
      [1, 2],
      [2, 1],
      [2, 3],
      [3, 0],
      [3, 2],
    ],
    // 11 tight buildable cells
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // Only 7 forward buildable pads!
      [-2, 1],
      [-2, 2],
      [0, 1],
      [0, 2],
      [2, 1],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p7-col-w',
        name: 'West Support Column (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-col-c',
        name: 'Center Support Column (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-col-e',
        name: 'East Support Column (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-cant-w',
        name: 'Left Cantilever Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-cant-e',
        name: 'Right Cantilever Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-cube-1',
        name: 'East Terrace Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-prism',
        name: 'Atrium Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 1],
        initialPosition: [-1, 0, 3],
        accentColor: '#fb923c',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-pyramid',
        name: 'Skyline Apex Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 2, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 1],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p7-pipe-3',
        name: 'Structural Pipe Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 1],
        initialPosition: [2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-8-checkerboard-plaza',
    number: '08',
    title: '08. Checkerboard Foundation',
    subtitle:
      'Every second concrete pad is replaced by courtyard grass; bridge the checkerboard slots using cantilevers and sun-transparent pipe cubes.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 0],
      [-2, 2],
      [-1, 1],
      [-1, 3],
      [0, 0],
      [0, 2],
      [1, 1],
      [1, 3],
      [2, 0],
      [2, 2],
      [3, 0],
      [3, 2],
    ],
    // 11 checkerboard foundation slots
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // Checkerboard forward cells (no two adjacent along X at z=2 except [2,2]-[3,2])
      [-3, 2],
      [-2, 1],
      [-1, 2],
      [0, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p8-col-1',
        name: 'West Checker Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-col-2',
        name: 'Mid-West Checker Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-beam-1',
        name: 'East Foundation Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-beam-2',
        name: 'Upper Checker Bridge (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-beam-3',
        name: 'Central Cantilever Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 2, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-cube-e',
        name: 'East Corner Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-prism',
        name: 'Checker Prism Unit (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 1, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-pyramid',
        name: 'Crown Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 1],
        initialPosition: [3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-1, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p8-pipe-3',
        name: 'Upper Pipe Truss Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 1, 2],
        initialPosition: [2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-9-solar-canyon',
    number: '09',
    title: '09. Narrow Solar Canyon',
    subtitle:
      'Channel the 40° sunlight through a narrow central canyon by stacking 11 modules onto two side ridges and open pipe supports.',
    windowCoordinates: [
      [-3, 1],
      [-3, 3],
      [-2, 0],
      [-2, 2],
      [-1, 0],
      [-1, 2],
      [-1, 4],
      [0, 0],
      [0, 1],
      [0, 3],
      [1, 0],
      [1, 2],
      [1, 4],
      [2, 0],
      [2, 2],
      [3, 1],
      [3, 3],
    ],
    // 11 buildable foundation slots
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // West & East ridges + single center-front pad
      [-3, 1],
      [-3, 2],
      [-2, 2],
      [0, 2],
      [2, 2],
      [3, 1],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p9-beam-w',
        name: 'West Ridge Podium (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-beam-e',
        name: 'East Ridge Podium (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-col-w',
        name: 'West Canyon Tower (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-col-e',
        name: 'East Canyon Tower (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-cube-1',
        name: 'West Mid-Ridge Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 1],
        initialPosition: [-1, 0, -2],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-cube-2',
        name: 'East Mid-Ridge Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 1],
        initialPosition: [3, 0, -2],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-prism',
        name: 'West Terrace Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 1, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#fb923c',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-wedge',
        name: 'East Terrace Wedge (1×1×1)',
        shape: 'wedge',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 1, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-pipe-1',
        name: 'Canyon Pipe Support A (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-pipe-2',
        name: 'Canyon Pipe Support B (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 2],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p9-pipe-3',
        name: 'Canyon Pipe Crown C (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 2, 2],
        initialPosition: [2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-10-triple-truss',
    number: '10',
    title: '10. Triple Truss Cantilever',
    subtitle:
      'Construct three multi-story cantilevered trusses over the courtyard park by rotating beams in 3D and utilizing sun-transparent pipe cubes.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [-1, 4],
      [0, 1],
      [0, 3],
      [1, 0],
      [1, 2],
      [1, 4],
      [2, 1],
      [2, 3],
      [3, 0],
      [3, 2],
    ],
    // 10 buildable foundation pads (4 back + 6 forward)
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // Only 6 forward foundation slots!
      [-3, 2],
      [-2, 2],
      [0, 1],
      [0, 2],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p10-beam-w',
        name: 'West Truss Base (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-beam-e',
        name: 'East Truss Base (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-beam-top-w',
        name: 'West Upper Cantilever (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-beam-top-e',
        name: 'East Upper Cantilever (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 1, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-col-c',
        name: 'Center Spine Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-cube-1',
        name: 'West Penthouse Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-cube-2',
        name: 'East Penthouse Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 2, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-pyramid',
        name: 'Central Apex Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 2, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-prism',
        name: 'Terrace Louver Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 2, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p10-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 1],
        initialPosition: [-1, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-11-ziggurat-terrace',
    number: '11',
    title: '11. Stepped Ziggurat Terrace',
    subtitle:
      'Interlock 12 modular blocks across a stepped ziggurat footprint where only the front edge and two mid-columns allow concrete foundations.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-3, 4],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [0, 0],
      [0, 2],
      [0, 4],
      [1, 0],
      [1, 2],
      [2, 1],
      [2, 3],
      [3, 0],
      [3, 2],
    ],
    // 11 buildable foundation pads
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // Stepped ziggurat pads
      [-3, 2],
      [-2, 1],
      [-2, 2],
      [0, 2],
      [2, 1],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p11-col-w',
        name: 'West Ziggurat Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-col-e',
        name: 'East Ziggurat Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-beam-w',
        name: 'West Cantilever Wing (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-beam-e',
        name: 'East Cantilever Wing (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-cube-w',
        name: 'West Base Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-cube-e',
        name: 'East Base Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-prism-w',
        name: 'West Step Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#a78bfa',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-prism-e',
        name: 'East Step Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-pyramid',
        name: 'Ziggurat Pinnacle (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 1],
        initialPosition: [-3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-1, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p11-pipe-3',
        name: 'East Pipe Truss Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 1],
        initialPosition: [3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-12-wind-corridor',
    number: '12',
    title: '12. Urban Wind & Light Corridor',
    subtitle:
      'Rotate tall cylinders and wide beams across 10 isolated foundation pads to preserve full sunlight across 16 dense neighbor balconies.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 0],
      [-2, 2],
      [-2, 4],
      [-1, 1],
      [-1, 3],
      [0, 0],
      [0, 2],
      [1, 1],
      [1, 3],
      [2, 0],
      [2, 2],
      [2, 4],
      [3, 0],
      [3, 2],
    ],
    // 10 buildable pads
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // 6 forward pads in 3 pairs
      [-3, 2],
      [-2, 2],
      [-1, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p12-beam-1',
        name: 'West Podium Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p12-beam-2',
        name: 'East Podium Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p12-cyl-1',
        name: 'West Cylindrical Silo (1×2×1)',
        shape: 'cylinder',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'circle',
      },
      {
        id: 'p12-cyl-2',
        name: 'East Cylindrical Silo (1×2×1)',
        shape: 'cylinder',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'circle',
      },
      {
        id: 'p12-beam-3',
        name: 'Center Cantilever Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 1, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p12-beam-4',
        name: 'East Cantilever Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 1, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p12-cube-1',
        name: 'Mid-West Terrace Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 2, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p12-cube-2',
        name: 'Mid-East Terrace Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#e879f9',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p12-sphere',
        name: 'Observatory Sphere (1×1×1)',
        shape: 'sphere',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 2, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'circle',
        floorSilhouette: 'circle',
      },
      {
        id: 'p12-pyramid',
        name: 'East Beacon Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 2, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p12-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 2],
        initialPosition: [-1, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p12-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 2],
        initialPosition: [3, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-13-suspended-atrium',
    number: '13',
    title: '13. Suspended Pipe Atrium',
    subtitle:
      'Use three sun-transparent pipe-frame cubes at the ground level to elevate opaque upper modules above low-floor balcony sightlines.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 0],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 3],
      [3, 0],
      [3, 2],
    ],
    // 10 buildable pads
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // 6 forward pads
      [-3, 2],
      [-1, 1],
      [0, 2],
      [1, 1],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p13-pipe-1',
        name: 'West Pipe Foundation (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 1],
        initialPosition: [-3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-pipe-2',
        name: 'Center Pipe Foundation (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-pipe-3',
        name: 'East Pipe Foundation (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 1],
        initialPosition: [2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-col-w',
        name: 'West Corner Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-beam-e',
        name: 'East Foundation Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-beam-cant-1',
        name: 'Center Suspended Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-beam-cant-2',
        name: 'East Upper Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 1, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-beam-cant-3',
        name: 'West Cantilever Wing (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [-1, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-cube-1',
        name: 'East Rooftop Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-prism',
        name: 'East Louver Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 2, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#e879f9',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-pyramid',
        name: 'Central Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 2, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p13-octa',
        name: 'Diamond Beacon (1×1×1)',
        shape: 'octahedron',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 2, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'diamond',
        floorSilhouette: 'diamond',
      },
    ],
  },
  {
    id: 'level-14-asymmetric-spires',
    number: '14',
    title: '14. Asymmetric Cantilever Spires',
    subtitle:
      'Balance 12 structural modules on an asymmetric 9-pad foundation without casting a single shadow onto 16 irregular balconies.',
    windowCoordinates: [
      [-3, 1],
      [-3, 3],
      [-2, 0],
      [-2, 2],
      [-1, 0],
      [-1, 1],
      [-1, 3],
      [0, 0],
      [0, 2],
      [0, 4],
      [1, 1],
      [1, 3],
      [2, 0],
      [2, 2],
      [3, 0],
      [3, 2],
    ],
    // 9 buildable foundation pads (3 back + 6 forward)
    allowedFloorCells: [
      [-3, -2],
      [0, -2],
      [3, -2],
      // 6 forward pads
      [-3, 1],
      [-3, 2],
      [-1, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p14-col-1',
        name: 'West Spire Core (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-col-2',
        name: 'Mid-West Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 2],
        initialPosition: [0, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-beam-1',
        name: 'East Podium Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-beam-2',
        name: 'West Skybridge Cantilever (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-beam-3',
        name: 'Mid Skybridge Cantilever (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 2, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-beam-4',
        name: 'East Upper Span (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 1, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-cube-1',
        name: 'West Mid-Terrace Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 1],
        initialPosition: [3, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-cube-2',
        name: 'East Corner Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-prism',
        name: 'East Terrace Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-pyramid',
        name: 'East Crown Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [-1, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 2, 2],
        initialPosition: [0, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p14-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 2, 2],
        initialPosition: [3, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-15-sky-viaduct',
    number: '15',
    title: '15. Elevated Sky Viaduct',
    subtitle:
      'Construct an elevated multi-span viaduct across 13 modular units using left and right cantilevers over the protected park.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [-1, 4],
      [0, 1],
      [0, 3],
      [1, 0],
      [1, 2],
      [1, 4],
      [2, 1],
      [2, 3],
      [3, 0],
      [3, 2],
    ],
    // 10 buildable pads
    allowedFloorCells: [
      [-3, -2],
      [-1, -2],
      [1, -2],
      [3, -2],
      // 6 forward viaduct pier pads
      [-3, 2],
      [-2, 2],
      [0, 1],
      [0, 2],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p15-col-w',
        name: 'West Viaduct Pier (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-col-c',
        name: 'Center Viaduct Pier (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-1, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-col-e',
        name: 'East Viaduct Pier (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, -2],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-beam-1',
        name: 'West Viaduct Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-beam-2',
        name: 'Center Viaduct Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 2, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-beam-3',
        name: 'East Viaduct Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-cube-w',
        name: 'West Abutment Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-cube-e',
        name: 'East Abutment Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-prism-w',
        name: 'West Upper Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-prism-e',
        name: 'East Upper Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [0, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-1, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 1],
        initialPosition: [1, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p15-pipe-3',
        name: 'Viaduct Crown Pipe Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 2, 2],
        initialPosition: [3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-16-glass-monolith',
    number: '16',
    title: '16. Solarium Arches & Spires',
    subtitle:
      'Arrange 13 modules across 9 compact buildable pads by rotating horizontal beams into vertical columns and interlocking cantilevers.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-3, 4],
      [-2, 0],
      [-2, 2],
      [-1, 1],
      [-1, 3],
      [0, 0],
      [0, 2],
      [0, 4],
      [1, 1],
      [1, 3],
      [2, 0],
      [2, 2],
      [3, 0],
      [3, 2],
      [3, 4],
    ],
    // 9 buildable foundation slots
    allowedFloorCells: [
      [-3, -2],
      [0, -2],
      [3, -2],
      // Only 6 forward buildable slots
      [-3, 2],
      [-1, 2],
      [0, 1],
      [0, 2],
      [1, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p16-col-w',
        name: 'West Corner Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-col-e',
        name: 'East Corner Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-beam-c1',
        name: 'Central Plaza Base (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-beam-c2',
        name: 'Central Second Story (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-beam-w-top',
        name: 'West Cantilever Arch (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-beam-e-top',
        name: 'East Cantilever Arch (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-cube-1',
        name: 'East Plaza Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 2],
        initialPosition: [0, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-cube-2',
        name: 'Mid-West Terrace Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 1, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-prism',
        name: 'Central Solarium Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 2, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-pyramid',
        name: 'Solarium Pinnacle (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 2, 2],
        initialPosition: [0, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-1, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 1],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p16-pipe-3',
        name: 'Crown Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 2, 2],
        initialPosition: [3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-17-stepped-citadel',
    number: '17',
    title: '17. Sanctuary Island Piers',
    subtitle:
      'Only three disconnected 2-cell concrete islands exist in the garden; stack and cantilever 13 units without shading 17 neighbor balconies.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-2, 1],
      [-2, 3],
      [-2, 4],
      [-1, 0],
      [-1, 2],
      [0, 1],
      [0, 3],
      [0, 4],
      [1, 0],
      [1, 2],
      [2, 1],
      [2, 3],
      [2, 4],
      [3, 0],
      [3, 2],
    ],
    // 9 buildable foundation slots (3 back + three 2-cell islands)
    allowedFloorCells: [
      [-3, -2],
      [0, -2],
      [3, -2],
      // Island 1 (West)
      [-3, 2],
      [-2, 2],
      // Island 2 (Center depth)
      [0, 1],
      [0, 2],
      // Island 3 (East)
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p17-beam-w1',
        name: 'West Island Base (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-beam-e1',
        name: 'East Island Base (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-beam-w2',
        name: 'West Second Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-beam-e2',
        name: 'East Second Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 1, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-col-c',
        name: 'Center Island Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-beam-c-top',
        name: 'Center Cantilever Crown (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 2, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-cube-w',
        name: 'West Rooftop Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [0, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-cube-e',
        name: 'East Rooftop Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 2, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#e879f9',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-prism-w',
        name: 'West Penthouse Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 2, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-pyramid-e',
        name: 'East Penthouse Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 1],
        initialPosition: [-1, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 1],
        initialPosition: [3, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p17-pipe-3',
        name: 'Upper Pipe Truss Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 2, 1],
        initialPosition: [-2, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-18-helix-cantilever',
    number: '18',
    title: '18. Double Helix Cantilever',
    subtitle:
      'Interlock 14 modular blocks across two spiral cantilever stacks while keeping 17 balconies in uninterrupted 40° sunlight.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-3, 4],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [-1, 4],
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [1, 4],
      [2, 1],
      [2, 3],
      [3, 0],
      [3, 2],
    ],
    // 9 buildable foundation slots
    allowedFloorCells: [
      [-3, -2],
      [0, -2],
      [3, -2],
      // 6 forward foundation slots
      [-3, 2],
      [-2, 2],
      [-1, 1],
      [1, 1],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p18-col-w',
        name: 'West Helix Core (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-col-e',
        name: 'East Helix Core (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-beam-w1',
        name: 'West Cantilever Arm A (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-beam-e1',
        name: 'East Cantilever Arm A (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-beam-w2',
        name: 'West Upper Helix Arm (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 3, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-beam-e2',
        name: 'East Upper Helix Arm (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 3, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-cube-w1',
        name: 'West Base Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [0, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-cube-e1',
        name: 'East Base Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-prism-w',
        name: 'West Step Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-prism-e',
        name: 'East Step Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [0, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 1],
        initialPosition: [-1, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 1],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-pipe-3',
        name: 'West Upper Pipe Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 1, 1],
        initialPosition: [3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p18-pipe-4',
        name: 'East Upper Pipe Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 1, 1],
        initialPosition: [-2, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-19-highrise-crown',
    number: '19',
    title: '19. High-Rise Solar Crown',
    subtitle:
      'With only 8 buildable foundation slots in the entire plot, engineer a high-rise cantilevered crown from 14 modules without shading 18 balconies.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-3, 4],
      [-2, 0],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [-1, 4],
      [0, 1],
      [0, 3],
      [1, 0],
      [1, 2],
      [1, 4],
      [2, 0],
      [2, 1],
      [2, 3],
      [3, 0],
    ],
    // Only 8 buildable foundation slots (3 back + 5 forward)
    allowedFloorCells: [
      [-3, -2],
      [0, -2],
      [3, -2],
      // Only 5 forward concrete slots!
      [-3, 2],
      [-1, 2],
      [0, 2],
      [1, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p19-col-w',
        name: 'West Anchor Column (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-col-e',
        name: 'East Anchor Column (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-beam-c1',
        name: 'Center Foundation Beam (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-beam-c2',
        name: 'Center Second Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-beam-w-cant',
        name: 'West Cantilever Bridge (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 2, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-beam-e-cant',
        name: 'East Cantilever Bridge (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 2, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-beam-c3',
        name: 'Center Third Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 2, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-cube-1',
        name: 'Center East Base Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 2],
        initialPosition: [0, 0, -2],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-cube-2',
        name: 'Center West Mid Cube (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-1, 1, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#e879f9',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-prism',
        name: 'West Crown Prism (1×1×1)',
        shape: 'prism',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 3, 2],
        initialPosition: [-1, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-pyramid',
        name: 'East Crown Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 3, 2],
        initialPosition: [0, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-pipe-1',
        name: 'Open Pipe Frame Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 2, 2],
        initialPosition: [3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-pipe-2',
        name: 'Hollow Pipe Support Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 3, 2],
        initialPosition: [-2, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p19-pipe-3',
        name: 'Sky Pipe Truss Cube (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 3, 2],
        initialPosition: [2, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
  {
    id: 'level-20-grand-arcology',
    number: '20',
    title: '20. Grand Solar Arcology Finale',
    subtitle:
      'The ultimate architectural test: stack, rotate in 3D, and cantilever all 14 arcology modules onto 8 foundation pads while keeping all 18 balconies 100% sunlit.',
    windowCoordinates: [
      [-3, 0],
      [-3, 2],
      [-3, 4],
      [-2, 0],
      [-2, 1],
      [-2, 3],
      [-1, 0],
      [-1, 2],
      [-1, 4],
      [0, 0],
      [0, 2],
      [0, 4],
      [1, 0],
      [1, 2],
      [1, 4],
      [2, 1],
      [2, 3],
      [3, 0],
    ],
    // 8 buildable foundation slots (3 back + 5 forward)
    allowedFloorCells: [
      [-3, -2],
      [0, -2],
      [3, -2],
      // 5 forward structural slots
      [-3, 2],
      [-2, 2],
      [0, 2],
      [2, 2],
      [3, 2],
    ],
    pieces: [
      {
        id: 'p20-beam-w1',
        name: 'West Arcology Podium (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 0, 2],
        initialPosition: [-3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-beam-e1',
        name: 'East Arcology Podium (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [2, 0, 2],
        initialPosition: [1, 0, 3],
        accentColor: '#f43f5e',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-col-w',
        name: 'West Sky Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 1, 2],
        initialPosition: [-3, 0, -2],
        accentColor: '#818cf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-col-e',
        name: 'East Sky Pillar (1×2×1)',
        shape: 'pillar-tall',
        dims: [1, 2, 1],
        baseDims: [1, 2, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [3, 0, -2],
        accentColor: '#a78bfa',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-beam-w-cant',
        name: 'West Cantilever Skybridge (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 1, 2],
        initialPosition: [-3, 0, 4],
        accentColor: '#34d399',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-beam-e-cant',
        name: 'East Cantilever Skybridge (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 1, 2],
        initialPosition: [1, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-beam-top-w',
        name: 'West Upper Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-2, 2, 2],
        initialPosition: [-1, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-beam-top-e',
        name: 'East Upper Deck (2×1×1)',
        shape: 'beam-wide',
        dims: [2, 1, 1],
        baseDims: [2, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 2, 2],
        initialPosition: [-1, 0, 4],
        accentColor: '#fb923c',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-cube-w',
        name: 'West Pinnacle Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [-3, 3, 2],
        initialPosition: [0, 0, -2],
        accentColor: '#e879f9',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-cube-e',
        name: 'East Pinnacle Pod (1×1×1)',
        shape: 'cube',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 3, 2],
        initialPosition: [3, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-pyramid',
        name: 'Arcology Sovereign Spire (1×1×1)',
        shape: 'pyramid',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 3, 2],
        initialPosition: [0, 0, 4],
        accentColor: '#fbbf24',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-pipe-1',
        name: 'Center Pipe Core Base (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 2],
        initialPosition: [3, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-pipe-2',
        name: 'Center Pipe Core Mid (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 1, 2],
        initialPosition: [-2, 0, 3],
        accentColor: '#2dd4bf',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
      {
        id: 'p20-pipe-3',
        name: 'Center Pipe Core Upper (1×1×1 — Sun Passes Through)',
        shape: 'pipe-frame',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 2, 2],
        initialPosition: [2, 0, 3],
        accentColor: '#38bdf8',
        wallSilhouette: 'rect',
        floorSilhouette: 'rect',
      },
    ],
  },
];

export const PUZZLE_LEVELS: PuzzleLevel[] =
  enrichLevelsWithHalfHeightBlocks(RAW_PUZZLE_LEVELS);



