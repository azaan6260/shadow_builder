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
export const BALCONY_GRID_Z = -2.65;

/** 7-Column X Grid (-3..+3) for smaller, denser modular skyscraper blocks */
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
export const GRID_Y_MAX = 8;
export const GRID_Y_COORDS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

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
 * X uses [-3..+3], Z uses [-2..+4], and Y uses [0..5] where y = 0 rests directly on the floor plane.
 */
export function getPieceWorldCenter(
  pos: [number, number, number],
  dims: [number, number, number],
  spacing = 0.82
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
 * Resolves the best valid `[x, y, z]` landing position when a user clicks or hovers `(targetX, targetZ)`.
 * Supports both direct anchor placement and cantilever placement (where shifting a multi-cell block by
 * `(-dx, -dz)` so it still covers `(targetX, targetZ)` catches a supporting block underneath at `y > 0`).
 */
export function resolveBestPlacementAnchor(
  targetPiece: WallPiece,
  targetX: number,
  targetZ: number,
  pieces: WallPiece[],
  allowedFloorSet?: Set<string>
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

  // Candidate anchor offsets that still cover (targetX, targetZ)
  const candidateAnchors: Array<[number, number]> = [];
  for (let dx = 0; dx < targetPiece.dims[0]; dx++) {
    for (let dz = 0; dz < targetPiece.dims[2]; dz++) {
      candidateAnchors.push(clampAnchor(targetX - dx, targetZ - dz));
    }
  }

  let fallbackPos: [number, number, number] | null = null;

  for (const [cx, cz] of candidateAnchors) {
    const dropY = calculateGravityDrop(
      cx,
      cz,
      settledOtherBlocks,
      targetPiece.id,
      targetPiece.dims
    );
    const pos: [number, number, number] = [cx, dropY, cz];
    if (!fallbackPos) {
      fallbackPos = pos;
    }

    const testPieces = pieces.map((p) =>
      p.id === targetPiece.id
        ? { ...p, position: pos }
        : settledOthers.find((s) => s.id === p.id) ?? p
    );

    if (
      isValidPiecePosition(
        testPieces,
        targetPiece.id,
        pos,
        targetPiece.dims,
        allowedFloorSet
      )
    ) {
      return { gridPos: pos, settledOthers, isValid: true };
    }
  }

  return {
    gridPos: fallbackPos ?? [targetPiece.position[0], targetPiece.position[1], targetPiece.position[2]],
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
  const by = wy + offY;
  const bz = BALCONY_GRID_Z + offZ;

  // Sample points across the balcony residents (left person, center, right person, torso & head)
  const samplePoints: Array<[number, number, number]> = [
    [bx, by, bz],
    [bx - 0.22, by, bz],
    [bx + 0.22, by, bz],
    [bx, by + 0.22, bz - 0.06],
    [bx, by - 0.16, bz + 0.06],
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
    const minX = block.x - 0.51;
    const maxX = block.x + 0.51;
    const minY = block.y - 0.51;
    const maxY = block.y + 0.51;
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

export const PUZZLE_LEVELS: PuzzleLevel[] = [
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
        name: 'Solar Stepback Wedge (1×1×1)',
        shape: 'wedge',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [0, 0, 0],
        initialPosition: [0, 0, 4],
        accentColor: '#2dd4bf',
        wallSilhouette: 'triangle',
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
        name: 'Faceted Atrium Node (1×1×1)',
        shape: 'octahedron',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [1, 0, 2],
        initialPosition: [2, 0, 4],
        accentColor: '#e879f9',
        wallSilhouette: 'diamond',
        floorSilhouette: 'diamond',
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
        name: 'Skyline Solarium (1×1×1)',
        shape: 'sphere',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 1, 2],
        initialPosition: [2, 0, 4],
        accentColor: '#38bdf8',
        wallSilhouette: 'circle',
        floorSilhouette: 'circle',
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
        name: 'East Stepback Wedge (1×1×1)',
        shape: 'wedge',
        dims: [1, 1, 1],
        baseDims: [1, 1, 1],
        rotation: [0, 0, 0],
        targetPosition: [3, 0, 1],
        initialPosition: [2, 0, 4],
        accentColor: '#818cf8',
        wallSilhouette: 'triangle',
        floorSilhouette: 'rect',
      },
    ],
  },
];

