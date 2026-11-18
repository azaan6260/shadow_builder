import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Edges, OrbitControls, SoftShadows } from '@react-three/drei';
import { a } from '@react-spring/three';
import { SpringValue, to, useSpring } from '@react-spring/core';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  BALCONY_GRID_Z,
  BlockState,
  CAMERA_PRESETS,
  CameraPresetId,
  GLASS_THEMES,
  GlassTheme,
  GlassThemeId,
  GRID_COORDS,
  GRID_Z_COORDS,
  GRID_Z_MAX,
  GRID_Z_MIN,
  LIGHT_POSITION,
  STAGING_Z_COORDS,
  ShapeKind,
  StencilElement,
  WallPiece,
  deriveBlocksFromPieces,
  getBalconyOffset,
  getPieceWorldCenter,
  isBalconyShadedByBlocks,
  resolveBestPlacementAnchor,
} from '../types/puzzle';
import type { CraneTransferOp } from '../store/usePuzzleStore';
import { soundFX } from '../utils/sound';

// Detect software WebGL once
export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

// World coordinates calibrated for compact blocks (spacing = 0.82) across a 7-column (-3..+3) urban plot
const WALL_Z = -2.56;
const BALCONY_Z = -2.18;
const FLOOR_Y = -2.08;
const CRANE_JIB_Y = 5.65;
const CRANE_REST_Y = 4.65;
const CRANE_PIVOT_X = -3.35;
const CRANE_PIVOT_Z = 0.2;

// Custom depth material so skyscraper modules cast solid real-time shadows onto Neighboring Buildings and Ground
const SHARED_CUSTOM_DEPTH_MAT = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
});

// Pre-built 3D Shape Geometries & their Edge Geometries
const SHAPE_GEOMETRIES: Record<
  ShapeKind,
  { geo: THREE.BufferGeometry; edges: THREE.EdgesGeometry }
> = (() => {
  const build = (geo: THREE.BufferGeometry, thresholdAngle = 15) => ({
    geo,
    edges: new THREE.EdgesGeometry(geo, thresholdAngle),
  });

  // 'cube': standard <boxGeometry args={[1, 1, 1]}>
  const cube = new THREE.BoxGeometry(1, 1, 1);

  // 'prism': triangular prism <cylinderGeometry args={[0.7, 0.7, 1, 3]} /> rotated 90 degrees on the X-axis so it sits flat
  const prism = new THREE.CylinderGeometry(0.7, 0.7, 1, 3);
  prism.rotateX(Math.PI / 2);

  // 'pyramid': <cylinderGeometry args={[0, 0.7, 1, 4]} />
  const pyramid = new THREE.CylinderGeometry(0, 0.7, 1, 4);
  pyramid.rotateY(Math.PI / 4);

  // 1x1x1 Small Cube
  const cubeSmall = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  // 2x2x1 Large Block
  const cubeLarge = new THREE.BoxGeometry(1.92, 1.92, 0.92);
  // 2x1x1 Wide Horizontal Beam
  const beamWide = new THREE.BoxGeometry(1.92, 0.92, 0.92);
  // 1x2x1 Tall Vertical Pillar
  const pillarTall = new THREE.BoxGeometry(0.92, 1.92, 0.92);
  // 1x1x2 Deep Beam
  const beamDeep = new THREE.BoxGeometry(0.92, 0.92, 1.92);
  // 1x2x1 Cylinder Column
  const cylinder = new THREE.CylinderGeometry(0.45, 0.45, 1.92, 28);
  // 1x1x1 Right-Triangle Wedge
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-0.45, -0.45);
  wedgeShape.lineTo(0.45, -0.45);
  wedgeShape.lineTo(-0.45, 0.45);
  wedgeShape.closePath();
  const wedge = new THREE.ExtrudeGeometry(wedgeShape, {
    depth: 0.92,
    bevelEnabled: false,
  });
  wedge.center();
  // 1x1x1 Sphere
  const sphere = new THREE.SphereGeometry(0.46, 28, 28);
  // 1x1x1 Octahedron
  const octahedron = new THREE.OctahedronGeometry(0.48, 0);

  return {
    cube: build(cube),
    prism: build(prism, 10),
    pyramid: build(pyramid, 10),
    'cube-small': build(cubeSmall),
    'cube-large': build(cubeLarge),
    'beam-wide': build(beamWide),
    'pillar-tall': build(pillarTall),
    'beam-deep': build(beamDeep),
    cylinder: build(cylinder, 25),
    wedge: build(wedge, 10),
    sphere: build(sphere, 35),
    octahedron: build(octahedron, 10),
  };
})();

const SHARED_CORE_NODE_GEO = new THREE.OctahedronGeometry(0.14, 0);
const SHARED_CELL_GUIDE_GEO = new THREE.PlaneGeometry(0.96, 0.96);
const SHARED_CELL_GUIDE_EDGES = new THREE.EdgesGeometry(SHARED_CELL_GUIDE_GEO);
const SHARED_UNIT_PLANE_GEO = new THREE.PlaneGeometry(1, 1);

/**
 * Builds a reusable unit [1x1] subdivided XZ wireframe grid geometry centered at [0, 0, 0]
 * for rendering projected shadow mesh grids ('target zones') on the floor area.
 */
function buildSubdividedGridLines(cols: number, rows: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i <= cols; i++) {
    const x = -0.5 + i / cols;
    positions.push(x, 0, -0.5, x, 0, 0.5);
  }
  for (let j = 0; j <= rows; j++) {
    const z = -0.5 + j / rows;
    positions.push(-0.5, 0, z, 0.5, 0, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

const SHARED_PROJECTED_MESH_GRID_GEO = buildSubdividedGridLines(4, 6);
const SHARED_SUBCELL_GRID_GEO = buildSubdividedGridLines(3, 3);

function StudioEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    return () => {
      envTexture.dispose();
    };
  }, [gl, scene]);

  return null;
}

interface CameraControllerProps {
  activePreset: CameraPresetId | null;
  onUserOrbitStart: () => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

/**
 * Computes an aspect- and orientation-aware orthographic zoom so the 3D cityscape
 * fills the viewport prominently across desktop, tablet, and mobile screens.
 */
function computeResponsiveZoom(
  baseZoom: number,
  width: number,
  height: number
): number {
  const safeW = Math.max(240, width - 16);
  const safeH = Math.max(200, height - 48);
  const maxZoomByWidth = safeW / 11.4;
  const maxZoomByHeight = safeH / 10.2;
  const scale = Math.min(1.22, maxZoomByWidth / 60, maxZoomByHeight / 60);
  return Math.max(18, baseZoom * scale);
}

function CameraController({
  activePreset,
  onUserOrbitStart,
  controlsRef,
}: CameraControllerProps) {
  const { camera, size } = useThree();
  const isTransitioningPosRef = useRef(true);
  const isTransitioningZoomRef = useRef(true);
  const baseZoomRef = useRef(60);
  const targetPosRef = useRef(new THREE.Vector3(12, 10.5, 13));
  const targetZoomRef = useRef(
    computeResponsiveZoom(60, size.width, size.height)
  );

  // When a camera preset is selected, transition both camera position and zoom
  useEffect(() => {
    if (!activePreset) return;
    const found = CAMERA_PRESETS.find((p) => p.id === activePreset);
    if (found) {
      baseZoomRef.current = found.zoom;
      targetPosRef.current.set(...found.position);
      targetZoomRef.current = computeResponsiveZoom(
        found.zoom,
        size.width,
        size.height
      );
      isTransitioningPosRef.current = true;
      isTransitioningZoomRef.current = true;
    }
  }, [activePreset, size.width, size.height]);

  // When viewport size or device orientation (portrait <-> landscape) changes,
  // smoothly re-fit the orthographic zoom even if the user has custom-orbited
  useEffect(() => {
    targetZoomRef.current = computeResponsiveZoom(
      baseZoomRef.current,
      size.width,
      size.height
    );
    isTransitioningZoomRef.current = true;
  }, [size.width, size.height]);

  useFrame((_, delta) => {
    if (!isTransitioningPosRef.current && !isTransitioningZoomRef.current) {
      return;
    }
    const dt = Math.min(delta, 0.1);

    if (isTransitioningPosRef.current) {
      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        targetPosRef.current.x,
        7,
        dt
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        targetPosRef.current.y,
        7,
        dt
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        targetPosRef.current.z,
        7,
        dt
      );

      if (controlsRef.current) {
        controlsRef.current.target.x = THREE.MathUtils.damp(
          controlsRef.current.target.x,
          0,
          8,
          dt
        );
        controlsRef.current.target.y = THREE.MathUtils.damp(
          controlsRef.current.target.y,
          0.3,
          8,
          dt
        );
        controlsRef.current.target.z = THREE.MathUtils.damp(
          controlsRef.current.target.z,
          0.3,
          8,
          dt
        );
        controlsRef.current.update();
      }

      if (camera.position.distanceTo(targetPosRef.current) < 0.04) {
        isTransitioningPosRef.current = false;
      }
    }

    if (
      isTransitioningZoomRef.current &&
      camera instanceof THREE.OrthographicCamera
    ) {
      camera.zoom = THREE.MathUtils.damp(
        camera.zoom,
        targetZoomRef.current,
        8,
        dt
      );
      camera.updateProjectionMatrix();

      if (Math.abs(camera.zoom - targetZoomRef.current) < 0.2) {
        isTransitioningZoomRef.current = false;
      }
    }
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const handleStart = () => {
      isTransitioningPosRef.current = false;
      isTransitioningZoomRef.current = false;
      onUserOrbitStart();
    };
    controls.addEventListener('start', handleStart);
    return () => {
      controls.removeEventListener('start', handleStart);
    };
  }, [controlsRef, onUserOrbitStart]);

  return null;
}

/**
 * Phase 17: Unified Tower Crane + Block Lockstep Animation Controller
 * Drives BOTH the rotating Tower Crane (slewing jib + radial trolley + hoist hook)
 * AND the moved block from a SINGLE shared `useSpring` instance so:
 * - Step A: The block stays 100% stationary at `fromCenter` while the Tower Crane slews & trolleys to hover over it.
 * - Step B: The block stays 100% stationary at `fromCenter` while the crane hook lowers onto the block's top surface.
 * - Step C: The crane hook and the block lift UP together in the exact same spring step.
 * - Step D: The Tower Crane slews its jib and moves its trolley horizontally WITH the block suspended directly below the hook.
 * - Step E: The crane hook lowers the block into its gravity-settled position (`{ mass: 2, tension: 300, friction: 20 }`),
 *           detaches, and retracts back up to `CRANE_REST_Y`.
 */
interface CraneBlockSpringValues {
  hookX: SpringValue<number>;
  hookZ: SpringValue<number>;
  hookY: SpringValue<number>;
  blockPos: SpringValue<[number, number, number]>;
}

/**
 * Physical 3D Hammerhead Tower Crane (Under-Construction Skyscraper Crane)
 * - Anchored beside the central building core at `[CRANE_PIVOT_X, FLOOR_Y, CRANE_PIVOT_Z]`.
 * - Features a reinforced concrete foundation pier, yellow steel lattice mast with X-bracing tiers,
 *   slewing ring, operator cab with panoramic glass, A-frame cathead apex with pendant suspension cables,
 *   counter-jib with stacked concrete counterweights, rotating horizontal lattice jib boom,
 *   radially sliding trolley carriage, twin hoist cables, and hazard-striped hook block.
 */
interface TowerCraneProps {
  craneSpring: CraneBlockSpringValues;
}

function TowerCrane({ craneSpring }: TowerCraneProps) {
  const mastHeight = CRANE_JIB_Y - FLOOR_Y;
  const mastCenterY = (CRANE_JIB_Y + FLOOR_Y) * 0.5;
  const jibLength = 8.8;
  const counterJibLength = 2.6;
  const apexHeight = 1.45;
  const mastTiers = 12;

  // Derive the slewing Y-rotation angle of the upper crane assembly so local +X points directly at (hookX, hookZ)
  const slewingRotation = to(
    [craneSpring.hookX, craneSpring.hookZ],
    (hx, hz) => [
      0,
      Math.atan2(-(hz - CRANE_PIVOT_Z), hx - CRANE_PIVOT_X),
      0,
    ]
  );

  // Derive the radial trolley distance along the rotating jib boom's local +X axis
  const trolleyPosition = to(
    [craneSpring.hookX, craneSpring.hookZ],
    (hx, hz) => [
      Math.hypot(hx - CRANE_PIVOT_X, hz - CRANE_PIVOT_Z),
      0,
      0,
    ]
  );

  return (
    <group name="tower-crane-system">
      {/* =================================================================== */}
      {/* 1. FIXED VERTICAL TOWER CRANE MAST & CONCRETE FOUNDATION            */}
      {/* =================================================================== */}
      <group position={[CRANE_PIVOT_X, 0, CRANE_PIVOT_Z]}>
        {/* Heavy Concrete Crane Footing Pad */}
        <mesh
          position={[0, FLOOR_Y + 0.14, 0]}
          castShadow={false}
          receiveShadow={true}
          raycast={() => null}
        >
          <boxGeometry args={[1.15, 0.28, 1.15]} />
          <meshStandardMaterial color="#64748b" roughness={0.85} metalness={0.1} />
          <Edges scale={1.0} threshold={15} color="#1e293b" />
        </mesh>

        {/* 4 Corner Vertical Yellow Lattice Mast Chords */}
        {[
          [-0.26, -0.26],
          [0.26, -0.26],
          [-0.26, 0.26],
          [0.26, 0.26],
        ].map(([cx, cz], idx) => (
          <mesh
            key={`mast-chord-${idx}`}
            position={[cx, mastCenterY, cz]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.08, mastHeight, 0.08]} />
            <meshStandardMaterial color="#eab308" roughness={0.45} metalness={0.35} />
          </mesh>
        ))}

        {/* Horizontal & Diagonal Lattice Mast Bracing Tiers */}
        {Array.from({ length: mastTiers }).map((_, i) => {
          const tierY = FLOOR_Y + 0.45 + (i * (mastHeight - 0.6)) / mastTiers;
          return (
            <group key={`mast-tier-${i}`} position={[0, tierY, 0]}>
              <mesh castShadow={false} receiveShadow={false} raycast={() => null}>
                <boxGeometry args={[0.58, 0.05, 0.58]} />
                <meshStandardMaterial color="#ca8a04" roughness={0.5} metalness={0.35} />
              </mesh>
              <mesh
                position={[0, 0.32, 0]}
                rotation={[0, (i * Math.PI) / 2, Math.PI / 4]}
                castShadow={false}
                receiveShadow={false}
                raycast={() => null}
              >
                <boxGeometry args={[0.72, 0.04, 0.04]} />
                <meshStandardMaterial color="#a16207" roughness={0.5} metalness={0.4} />
              </mesh>
            </group>
          );
        })}

        {/* Slewing Ring Turntable Bearing at Top of Mast */}
        <mesh
          position={[0, CRANE_JIB_Y - 0.14, 0]}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        >
          <cylinderGeometry args={[0.42, 0.42, 0.22, 20]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.75} />
        </mesh>

        {/* ================================================================= */}
        {/* 2. ROTATING UPPER SLEWING ASSEMBLY (Jib, Counter-Jib, Cab, Trolley)*/}
        {/* ================================================================= */}
        <a.group
          position={[0, CRANE_JIB_Y, 0]}
          rotation={slewingRotation as unknown as [number, number, number]}
        >
          {/* Operator Cab (Mounted on side of slewing mast head) */}
          <group position={[0.25, -0.05, 0.48]}>
            <mesh castShadow={false} receiveShadow={false} raycast={() => null}>
              <boxGeometry args={[0.62, 0.56, 0.46]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.2} />
              <Edges scale={1.0} threshold={15} color="#0f172a" />
            </mesh>
            {/* Cab Panoramic Tinted Windshield */}
            <mesh
              position={[0.08, 0.02, 0.02]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.5, 0.36, 0.48]} />
              <meshStandardMaterial color="#0284c7" roughness={0.15} metalness={0.6} />
            </mesh>
          </group>

          {/* A-Frame Tower Peak (Cathead Apex) */}
          <mesh
            position={[0, apexHeight * 0.5, 0]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.48, apexHeight, 0.48]} />
            <meshStandardMaterial color="#eab308" roughness={0.45} metalness={0.35} />
            <Edges scale={1.0} threshold={15} color="#1e293b" />
          </mesh>

          {/* Rear Counter-Jib Boom (-X direction) */}
          <mesh
            position={[-counterJibLength * 0.5, 0.08, 0]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[counterJibLength, 0.22, 0.46]} />
            <meshStandardMaterial color="#eab308" roughness={0.45} metalness={0.35} />
            <Edges scale={1.0} threshold={15} color="#1e293b" />
          </mesh>

          {/* Stacked Concrete Counterweight Slabs at Rear of Counter-Jib */}
          {[-2.25, -1.9, -1.55].map((cwX, idx) => (
            <mesh
              key={`counterweight-${idx}`}
              position={[cwX, 0.28, 0]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.28, 0.58, 0.62]} />
              <meshStandardMaterial color="#475569" roughness={0.85} metalness={0.15} />
              <Edges scale={1.0} threshold={15} color="#0f172a" />
            </mesh>
          ))}

          {/* Main Forward Horizontal Lattice Jib Boom (+X direction) */}
          <group position={[jibLength * 0.5, 0.14, 0]}>
            {/* Lower Twin Jib Chords */}
            {[-0.2, 0.2].map((jz, idx) => (
              <mesh
                key={`jib-lower-chord-${idx}`}
                position={[0, -0.1, jz]}
                castShadow={false}
                receiveShadow={false}
                raycast={() => null}
              >
                <boxGeometry args={[jibLength, 0.07, 0.07]} />
                <meshStandardMaterial color="#eab308" roughness={0.45} metalness={0.35} />
              </mesh>
            ))}
            {/* Upper Central Triangular Jib Chord */}
            <mesh
              position={[0, 0.22, 0]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[jibLength, 0.08, 0.08]} />
              <meshStandardMaterial color="#facc15" roughness={0.4} metalness={0.35} />
            </mesh>
            {/* Jib Cross-Webbing Struts */}
            {Array.from({ length: 14 }).map((_, i) => {
              const strutX = -jibLength * 0.46 + (i * jibLength * 0.92) / 13;
              return (
                <mesh
                  key={`jib-strut-${i}`}
                  position={[strutX, 0.06, 0]}
                  castShadow={false}
                  receiveShadow={false}
                  raycast={() => null}
                >
                  <boxGeometry args={[0.05, 0.32, 0.42]} />
                  <meshStandardMaterial color="#ca8a04" roughness={0.5} metalness={0.35} />
                </mesh>
              );
            })}
          </group>

          {/* Steel Pendant Suspension Cables from Cathead Apex to Jib & Counter-Jib */}
          <mesh
            position={[2.6, apexHeight * 0.55, 0]}
            rotation={[0, 0, -0.44]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <cylinderGeometry args={[0.02, 0.02, 5.7, 8]} />
            <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.85} />
          </mesh>
          <mesh
            position={[-1.1, apexHeight * 0.52, 0]}
            rotation={[0, 0, 0.72]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <cylinderGeometry args={[0.02, 0.02, 2.8, 8]} />
            <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.85} />
          </mesh>

          {/* =============================================================== */}
          {/* 3. RADIALLY SLIDING TROLLEY CARRIAGE & VERTICAL HOIST HOOK      */}
          {/* =============================================================== */}
          <a.group
            position={trolleyPosition as unknown as [number, number, number]}
          >
            {/* Trolley Carriage Rolling Under Jib Chords */}
            <mesh
              position={[0, -0.06, 0]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.58, 0.16, 0.52]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.75} />
              <Edges scale={1.0} threshold={15} color="#38bdf8" />
            </mesh>

            {/* Twin Vertical Steel Hoist Cables (Stretch from CRANE_JIB_Y down to hookY) */}
            {[-0.1, 0.1].map((cableOffset, idx) => (
              <a.mesh
                key={`hoist-cable-${idx}`}
                position={
                  craneSpring.hookY.to((hy) => [
                    cableOffset,
                    (hy - CRANE_JIB_Y) * 0.5,
                    0,
                  ]) as unknown as [number, number, number]
                }
                scale={
                  craneSpring.hookY.to((hy) => [
                    1,
                    Math.max(0.08, CRANE_JIB_Y - hy),
                    1,
                  ]) as unknown as [number, number, number]
                }
                castShadow={false}
                receiveShadow={false}
                raycast={() => null}
              >
                <cylinderGeometry args={[0.018, 0.018, 1, 10]} />
                <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.85} />
              </a.mesh>
            ))}

            {/* Animated Spreader Bar & Grapple Hook Assembly at (hookY - CRANE_JIB_Y) */}
            <a.group
              position-y={
                craneSpring.hookY.to((hy) => hy - CRANE_JIB_Y) as unknown as number
              }
            >
              {/* Yellow Industrial Sheave Hook Block */}
              <mesh
                position={[0, 0.1, 0]}
                castShadow={false}
                receiveShadow={false}
                raycast={() => null}
              >
                <boxGeometry args={[0.52, 0.18, 0.52]} />
                <meshStandardMaterial color="#eab308" roughness={0.4} metalness={0.4} />
                <Edges scale={1.0} threshold={15} color="#0f172a" />
              </mesh>
              {/* Heavy Steel Grapple Spreader Frame */}
              <mesh
                position={[0, -0.03, 0]}
                castShadow={false}
                receiveShadow={false}
                raycast={() => null}
              >
                <boxGeometry args={[0.74, 0.07, 0.74]} />
                <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.75} />
              </mesh>
            </a.group>
          </a.group>
        </a.group>
      </group>
    </group>
  );
}

/**
 * 3D Balcony with a Standing Person on the Neighboring Buildings
 * - When Sunlit (`!isBlocked`): Resident wears bright cheerful clothes, stands calmly enjoying the 60° sun.
 * - When Shaded (`isBlocked`): Resident turns visibly ANGRY — bright crimson outfit, slanted angry eyebrows,
 *   open shouting mouth, arms raised high waving/shaking their fists at the construction site, stomping up and down,
 *   with a glowing red `!` anger indicator above their head!
 */
interface BalconyWithPersonProps {
  wx: number;
  wy: number;
  isBlocked: boolean;
  spacing: number;
}

const HAPPY_SHIRT_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

interface BalconyResidentFigureProps {
  localX: number;
  localZ: number;
  baseRotY: number;
  scale: number;
  shirtColor: string;
  phaseSeed: number;
  isBlocked: boolean;
}

/**
 * Individual 3D resident standing on a Neighboring Building balcony.
 * Calm and smiling when in the 40° sunlight; stomping, scowling, and waving fists in anger when shaded!
 */
function BalconyResidentFigure({
  localX,
  localZ,
  baseRotY,
  scale,
  shirtColor,
  phaseSeed,
  isBlocked,
}: BalconyResidentFigureProps) {
  const personGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const angerBadgeRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (personGroupRef.current) {
      if (isBlocked) {
        // Angry stomping / jumping up and down and shaking side to side
        personGroupRef.current.position.y =
          -0.25 + Math.abs(Math.sin(t * 13 + phaseSeed)) * 0.075;
        personGroupRef.current.rotation.y =
          baseRotY + Math.sin(t * 11 + phaseSeed) * 0.32;
      } else {
        // Calm gentle breathing / chatting in the sunshine
        personGroupRef.current.position.y =
          -0.25 + Math.sin(t * 2.2 + phaseSeed) * 0.012;
        personGroupRef.current.rotation.y =
          baseRotY + Math.sin(t * 1.4 + phaseSeed) * 0.1;
      }
    }

    if (leftArmRef.current && rightArmRef.current) {
      if (isBlocked) {
        // Arms raised high shaking fists in anger!
        leftArmRef.current.rotation.z =
          2.55 + Math.sin(t * 17 + phaseSeed) * 0.38;
        rightArmRef.current.rotation.z =
          -2.55 - Math.cos(t * 17 + phaseSeed) * 0.38;
      } else {
        // Arms resting / gesturing calmly
        leftArmRef.current.rotation.z =
          0.22 + Math.sin(t * 2.1 + phaseSeed) * 0.06;
        rightArmRef.current.rotation.z =
          -0.22 - Math.sin(t * 2.1 + phaseSeed) * 0.06;
      }
    }

    if (angerBadgeRef.current && isBlocked) {
      angerBadgeRef.current.position.y =
        0.74 + Math.sin(t * 11 + phaseSeed) * 0.045;
      angerBadgeRef.current.rotation.y = Math.sin(t * 6 + phaseSeed) * 0.25;
    }
  });

  return (
    <group
      ref={personGroupRef}
      position={[localX, -0.25, localZ]}
      rotation={[0, baseRotY, 0]}
      scale={[scale, scale, scale]}
    >
      {/* Left & Right Legs */}
      {[-0.06, 0.06].map((lx, idx) => (
        <mesh
          key={`leg-${idx}`}
          position={[lx, 0.1, 0]}
          castShadow={true}
          receiveShadow={true}
          raycast={() => null}
        >
          <boxGeometry args={[0.07, 0.2, 0.07]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
      ))}

      {/* Torso / Jacket (Cheerful color when sunlit, bright angry crimson when shaded) */}
      <mesh
        position={[0, 0.29, 0]}
        castShadow={true}
        receiveShadow={true}
        raycast={() => null}
      >
        <boxGeometry args={[0.2, 0.22, 0.12]} />
        <meshStandardMaterial
          color={isBlocked ? '#dc2626' : shirtColor}
          emissive={isBlocked ? '#991b1b' : '#000000'}
          emissiveIntensity={isBlocked ? 0.4 : 0}
          roughness={0.55}
        />
      </mesh>

      {/* Left Arm (Pivoted at shoulder) */}
      <group ref={leftArmRef} position={[-0.125, 0.38, 0]}>
        <mesh
          position={[-0.015, -0.09, 0]}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[0.058, 0.18, 0.058]} />
          <meshStandardMaterial
            color={isBlocked ? '#ef4444' : shirtColor}
            roughness={0.5}
          />
        </mesh>
      </group>

      {/* Right Arm (Pivoted at shoulder) */}
      <group ref={rightArmRef} position={[0.125, 0.38, 0]}>
        <mesh
          position={[0.015, -0.09, 0]}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[0.058, 0.18, 0.058]} />
          <meshStandardMaterial
            color={isBlocked ? '#ef4444' : shirtColor}
            roughness={0.5}
          />
        </mesh>
      </group>

      {/* Head (Flushed red when angry in shadow, warm skin tone when sunlit) */}
      <group position={[0, 0.49, 0]}>
        <mesh castShadow={true} receiveShadow={true} raycast={() => null}>
          <sphereGeometry args={[0.105, 14, 14]} />
          <meshStandardMaterial
            color={isBlocked ? '#fca5a5' : '#fde68a'}
            roughness={0.45}
          />
        </mesh>

        {/* Eyes */}
        {[-0.038, 0.038].map((ex, idx) => (
          <mesh
            key={`eye-${idx}`}
            position={[ex, 0.014, 0.096]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <sphereGeometry args={[0.016, 8, 8]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
        ))}

        {/* Facial Expression: Angry Slanted Eyebrows & Shouting Mouth vs Happy Smile */}
        {isBlocked ? (
          <>
            {/* Left Angry Slanted Eyebrow (\) */}
            <mesh
              position={[-0.04, 0.044, 0.1]}
              rotation={[0, 0, -0.5]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.05, 0.015, 0.014]} />
              <meshBasicMaterial color="#7f1d1d" />
            </mesh>
            {/* Right Angry Slanted Eyebrow (/) */}
            <mesh
              position={[0.04, 0.044, 0.1]}
              rotation={[0, 0, 0.5]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.05, 0.015, 0.014]} />
              <meshBasicMaterial color="#7f1d1d" />
            </mesh>
            {/* Angry Shouting Mouth */}
            <mesh
              position={[0, -0.034, 0.098]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.05, 0.034, 0.014]} />
              <meshBasicMaterial color="#7f1d1d" />
            </mesh>
          </>
        ) : (
          /* Calm Happy Smile */
          <mesh
            position={[0, -0.032, 0.098]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.045, 0.013, 0.012]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
        )}
      </group>

      {/* Floating Red "!" Anger Exclamation Indicator Above Each Angry Resident */}
      {isBlocked && (
        <group ref={angerBadgeRef} position={[0, 0.74, 0]}>
          <mesh
            position={[0, 0.075, 0]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.05, 0.135, 0.05]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh
            position={[0, -0.035, 0]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * Irregularly positioned 3D Balcony with multiple standing residents (2 or 3 people on most balconies)
 * who enjoy the sun when lit and get visibly angry when a 40° block shadow lands on them.
 */
function BalconyWithPerson({
  wx,
  wy,
  isBlocked,
  spacing,
}: BalconyWithPersonProps) {
  const [offX, offY, offZ] = useMemo(() => getBalconyOffset(wx, wy), [wx, wy]);

  const worldX = (wx + offX) * spacing;
  const worldY = (wy - 2 + offY) * spacing;
  const worldZ = BALCONY_Z + offZ * spacing;

  const seed = Math.abs(wx * 17 + wy * 31);
  // Vary balcony width and number of people (2 or 3 people on most balconies, 1 on compact terraces)
  const peopleCount = seed % 4 === 0 ? 3 : seed % 4 === 3 ? 1 : 2;
  const slabWidth = peopleCount === 3 ? 0.86 : peopleCount === 2 ? 0.76 : 0.64;
  const slabDepth = 0.64;

  const residents = useMemo(() => {
    if (peopleCount === 3) {
      return [
        {
          localX: -0.22,
          localZ: 0.04,
          baseRotY: 0.22,
          scale: 0.86,
          shirtColor: HAPPY_SHIRT_COLORS[seed % HAPPY_SHIRT_COLORS.length],
          phaseSeed: seed * 1.1,
        },
        {
          localX: 0,
          localZ: -0.03,
          baseRotY: 0,
          scale: 0.92,
          shirtColor:
            HAPPY_SHIRT_COLORS[(seed + 2) % HAPPY_SHIRT_COLORS.length],
          phaseSeed: seed * 2.3 + 1.7,
        },
        {
          localX: 0.22,
          localZ: 0.05,
          baseRotY: -0.22,
          scale: 0.84,
          shirtColor:
            HAPPY_SHIRT_COLORS[(seed + 4) % HAPPY_SHIRT_COLORS.length],
          phaseSeed: seed * 3.1 + 3.4,
        },
      ];
    }
    if (peopleCount === 2) {
      return [
        {
          localX: -0.15,
          localZ: 0.03,
          baseRotY: 0.18,
          scale: 0.9,
          shirtColor: HAPPY_SHIRT_COLORS[seed % HAPPY_SHIRT_COLORS.length],
          phaseSeed: seed * 1.3,
        },
        {
          localX: 0.15,
          localZ: 0.02,
          baseRotY: -0.18,
          scale: 0.86,
          shirtColor:
            HAPPY_SHIRT_COLORS[(seed + 3) % HAPPY_SHIRT_COLORS.length],
          phaseSeed: seed * 2.7 + 2.1,
        },
      ];
    }
    return [
      {
        localX: 0,
        localZ: 0.04,
        baseRotY: 0,
        scale: 0.92,
        shirtColor: HAPPY_SHIRT_COLORS[seed % HAPPY_SHIRT_COLORS.length],
        phaseSeed: seed * 1.5,
      },
    ];
  }, [peopleCount, seed]);

  return (
    <group position={[worldX, worldY, worldZ]}>
      {/* 1. Recessed Apartment Balcony Glass Doorway on Facade */}
      <mesh
        position={[0, 0.02, WALL_Z - worldZ + 0.02]}
        castShadow={false}
        receiveShadow={true}
        raycast={() => null}
      >
        <planeGeometry args={[slabWidth * 0.78, 0.64]} />
        <meshStandardMaterial
          color={isBlocked ? '#450a0a' : '#fef08a'}
          emissive={isBlocked ? '#991b1b' : '#fde047'}
          emissiveIntensity={isBlocked ? 0.45 : 0.8}
          roughness={0.3}
        />
      </mesh>

      {/* 2. Cantilevered Concrete Balcony Floor Slab */}
      <mesh
        position={[0, -0.29, 0]}
        castShadow={true}
        receiveShadow={true}
        raycast={() => null}
      >
        <boxGeometry args={[slabWidth, 0.08, slabDepth]} />
        <meshStandardMaterial
          color={isBlocked ? '#7f1d1d' : '#cbd5e1'}
          roughness={0.8}
          metalness={0.1}
        />
        <Edges scale={1.0} threshold={15} color={isBlocked ? '#ef4444' : '#334155'} />
      </mesh>

      {/* 3. Balcony Front & Side Safety Railing + Glass/Steel Guard */}
      <group position={[0, -0.13, 0]}>
        {/* Front Top Handrail */}
        <mesh
          position={[0, 0.12, slabDepth * 0.5 - 0.02]}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[slabWidth, 0.035, 0.035]} />
          <meshStandardMaterial
            color={isBlocked ? '#ef4444' : '#0f172a'}
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
        {/* Side Top Handrails */}
        {[-slabWidth * 0.5 + 0.02, slabWidth * 0.5 - 0.02].map((rx, idx) => (
          <mesh
            key={`side-rail-${idx}`}
            position={[rx, 0.12, 0]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.035, 0.035, slabDepth]} />
            <meshStandardMaterial
              color={isBlocked ? '#ef4444' : '#0f172a'}
              roughness={0.4}
              metalness={0.7}
            />
          </mesh>
        ))}
        {/* Vertical Railing Balusters */}
        {[-0.36, -0.18, 0, 0.18, 0.36].map((frac, idx) => (
          <mesh
            key={`baluster-${idx}`}
            position={[frac * slabWidth, 0, slabDepth * 0.5 - 0.02]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.022, 0.24, 0.022]} />
            <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
          </mesh>
        ))}
      </group>

      {/* 4. Multiple 3D Residents Standing on the Balcony */}
      {residents.map((res, idx) => (
        <BalconyResidentFigure
          key={`resident-${idx}`}
          localX={res.localX}
          localZ={res.localZ}
          baseRotY={res.baseRotY}
          scale={res.scale}
          shirtColor={res.shirtColor}
          phaseSeed={res.phaseSeed}
          isBlocked={isBlocked}
        />
      ))}
    </group>
  );
}

export interface ShapeMeshProps {
  shape: ShapeKind;
  animatedPosition: SpringValue<[number, number, number]> | [number, number, number];
  rotation?: [number, number, number];
  spacing: number;
  isSelected: boolean;
  isHovered: boolean;
  theme: GlassTheme;
  outerEdgeColor: string;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
}

export function ShapeMesh({
  shape,
  animatedPosition,
  rotation = [0, 0, 0],
  spacing,
  isSelected,
  isHovered,
  theme,
  outerEdgeColor,
  onClick,
  onPointerOver,
  onPointerOut,
}: ShapeMeshProps) {
  const { geo, edges } = SHAPE_GEOMETRIES[shape];
  const meshRotation: [number, number, number] =
    shape === 'prism'
      ? [Math.PI / 2, 0, 0]
      : shape === 'pyramid'
      ? [0, Math.PI / 4, 0]
      : [0, 0, 0];

  const useDeclarativeGeometry =
    shape === 'cube' || shape === 'prism' || shape === 'pyramid';

  // Smoothly animate 3-axis (X, Y, Z) block rotation when the player rotates the block
  const rotSpring = useSpring({
    rot: rotation,
    config: { mass: 1.1, tension: 320, friction: 24 },
  });

  return (
    <a.group
      position={animatedPosition as unknown as [number, number, number]}
      rotation={rotSpring.rot as unknown as [number, number, number]}
    >
      <mesh
        scale={[spacing, spacing, spacing]}
        geometry={useDeclarativeGeometry ? undefined : geo}
        rotation={useDeclarativeGeometry ? meshRotation : [0, 0, 0]}
        customDepthMaterial={SHARED_CUSTOM_DEPTH_MAT}
        castShadow={true}
        receiveShadow={true}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        {shape === 'cube' && <boxGeometry args={[1, 1, 1]} />}
        {shape === 'prism' && <cylinderGeometry args={[0.7, 0.7, 1, 3]} />}
        {shape === 'pyramid' && <cylinderGeometry args={[0, 0.7, 1, 4]} />}

        {/* Modular Skyscraper Unit Material (Pre-Cast Concrete / Curtain Glass / Steel Framing) */}
        <meshPhysicalMaterial
          color={isSelected ? '#7dd3fc' : theme.glassColor}
          roughness={0.5}
          clearcoat={0.28}
          clearcoatRoughness={0.22}
          metalness={0.2}
          reflectivity={0.5}
          emissive={isSelected ? '#0284c7' : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />

        {/* Steel Framing Structural Edges */}
        <lineSegments
          geometry={edges}
          rotation={
            shape === 'prism'
              ? [-Math.PI / 2, 0, 0]
              : shape === 'pyramid'
              ? [0, -Math.PI / 4, 0]
              : [0, 0, 0]
          }
          raycast={() => null}
        >
          <lineBasicMaterial
            color={outerEdgeColor}
            transparent={true}
            opacity={isSelected || isHovered ? 1.0 : 0.8}
          />
        </lineSegments>
      </mesh>
    </a.group>
  );
}

interface MovableShapeMeshProps {
  piece: WallPiece;
  animatedPosition: SpringValue<[number, number, number]> | [number, number, number];
  selectedPieceId: string | null;
  isSelected: boolean;
  isHovered: boolean;
  spacing: number;
  theme: GlassTheme;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onHoverColumn: (col: [number, number] | null) => void;
  onMoveSelectedWithGravity: (targetX: number, targetZ: number) => boolean;
}

function MovableShapeMesh({
  piece,
  animatedPosition,
  selectedPieceId,
  isSelected,
  isHovered,
  spacing,
  theme,
  onSelect,
  onHover,
  onHoverColumn,
  onMoveSelectedWithGravity,
}: MovableShapeMeshProps) {
  const coreRef = useRef<THREE.Mesh>(null);
  const isPlacedInCentral = piece.position[2] <= GRID_Z_MAX;

  useFrame((state) => {
    if (coreRef.current) {
      coreRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    }
  });

  const outerEdgeColor = useMemo(() => {
    if (isSelected) return '#0284c7';
    if (isHovered) return theme.hoverEdgeColor;
    if (isPlacedInCentral) return '#0f172a';
    return '#334155';
  }, [isSelected, isHovered, isPlacedInCentral, theme]);

  const resolveClickedColumn = (
    point: THREE.Vector3
  ): [number, number] => {
    const rawX = Math.round(point.x / spacing);
    const rawZ = Math.round(point.z / spacing);
    const colX = Math.max(
      piece.position[0],
      Math.min(piece.position[0] + piece.dims[0] - 1, rawX)
    );
    const colZ = Math.max(
      piece.position[2],
      Math.min(piece.position[2] + piece.dims[2] - 1, rawZ)
    );
    return [colX, colZ];
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    // Ignore camera orbit drags on touch or mouse
    if (e.delta > 10) return;
    e.stopPropagation();

    if (selectedPieceId && selectedPieceId !== piece.id) {
      const [colX, colZ] = resolveClickedColumn(e.point);
      const moved = onMoveSelectedWithGravity(colX, colZ);
      if (moved) {
        onHoverColumn(null);
        return;
      }
    }

    if (isSelected) {
      onSelect(null);
    } else {
      onSelect(piece.id);
    }
  };

  return (
    <group name={piece.id}>
      {/* Render Compact Modular Skyscraper Unit synchronized with the Tower Crane & 3-Axis Rotation */}
      <ShapeMesh
        shape={piece.shape}
        animatedPosition={animatedPosition}
        rotation={piece.rotation ?? [0, 0, 0]}
        spacing={spacing}
        isSelected={isSelected}
        isHovered={isHovered}
        theme={theme}
        outerEdgeColor={outerEdgeColor}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(piece.id);
          if (selectedPieceId && selectedPieceId !== piece.id) {
            onHoverColumn(resolveClickedColumn(e.point));
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onHover(null);
          onHoverColumn(null);
        }}
      />

      {/* Animated Accessory Group (Selection Wireframe & Internal Core) */}
      <a.group position={animatedPosition as unknown as [number, number, number]}>
        {/* Transparent Glowing Wireframe Box (using Edges) around the Currently Selected Block */}
        {isSelected && (
          <mesh
            scale={[
              piece.dims[0] * spacing + 0.06,
              piece.dims[1] * spacing + 0.06,
              piece.dims[2] * spacing + 0.06,
            ]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.2}
              depthWrite={false}
            />
            <Edges scale={1.0} threshold={15} color="#0284c7" />
          </mesh>
        )}

        {/* Architectural Elevator Core Indicator */}
        <mesh
          ref={coreRef}
          geometry={SHARED_CORE_NODE_GEO}
          scale={[spacing, spacing, spacing]}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        >
          <meshStandardMaterial
            color={piece.accentColor}
            roughness={0.4}
            metalness={0.35}
          />
        </mesh>
      </a.group>
    </group>
  );
}

/**
 * Restricted Courtyard Garden Cell inside the Central Building Zone (Non-Buildable Ground Setback Cell)
 * - Uses a low, flush sunlit grass turf (`height: 0.006`, top at `FLOOR_Y + 0.008`) so real-time WebGL shadows
 *   and projected shadow silhouettes sit cleanly ON TOP of the grass and are never hidden!
 * - Clicking or hovering a garden cell while holding a multi-unit block supports cantilever placement
 *   when the block rests on an adjacent supporting block (`y > 0`, not touching the ground).
 */
function CourtyardGardenCell({
  x,
  z,
  spacing,
  isHoveredInvalid,
  isHoveredValidCantilever,
  hasSelectedBlock,
  onHover,
  onClickFloorCell,
}: {
  x: number;
  z: number;
  spacing: number;
  isHoveredInvalid: boolean;
  isHoveredValidCantilever: boolean;
  hasSelectedBlock: boolean;
  onHover: (col: [number, number] | null) => void;
  onClickFloorCell: (targetX: number, targetZ: number) => void;
}) {
  const seed = Math.abs(x * 19 + z * 37);
  const flowerColor =
    seed % 3 === 0 ? '#f43f5e' : seed % 3 === 1 ? '#fbbf24' : '#c084fc';

  const turfColor = isHoveredValidCantilever
    ? '#34d399'
    : isHoveredInvalid
    ? '#ef4444'
    : '#4ade80';

  const borderColor = isHoveredValidCantilever
    ? '#059669'
    : isHoveredInvalid
    ? '#b91c1c'
    : '#15803d';

  return (
    <group
      position={[x * spacing, 0.002, z * spacing]}
      scale={[spacing, 1, spacing]}
    >
      {/* Low Flush Sunlit Grass Lawn Turf (Shadows render directly on top of this surface) */}
      <mesh
        position={[0, 0.003, 0]}
        receiveShadow={true}
        castShadow={false}
        onClick={(e) => {
          if (!hasSelectedBlock || e.delta > 10) return;
          e.stopPropagation();
          onClickFloorCell(x, z);
        }}
        onPointerOver={(e) => {
          if (!hasSelectedBlock) return;
          e.stopPropagation();
          onHover([x, z]);
        }}
        onPointerOut={(e) => {
          if (!hasSelectedBlock) return;
          e.stopPropagation();
          onHover(null);
        }}
      >
        <boxGeometry args={[0.92, 0.006, 0.92]} />
        <meshStandardMaterial color={turfColor} roughness={0.92} />
        <Edges scale={1.0} threshold={15} color={borderColor} />
      </mesh>

      {/* Low Corner Boxwood Shrubs (kept at outer corners so the grass center clearly shows cast shadows) */}
      <mesh
        position={[-0.33, 0.028, -0.32]}
        castShadow={false}
        receiveShadow={true}
        raycast={() => null}
      >
        <sphereGeometry args={[0.075, 8, 8]} />
        <meshStandardMaterial color="#16a34a" roughness={0.85} />
      </mesh>
      <mesh
        position={[0.33, 0.025, 0.32]}
        castShadow={false}
        receiveShadow={true}
        raycast={() => null}
      >
        <sphereGeometry args={[0.068, 8, 8]} />
        <meshStandardMaterial color="#22c55e" roughness={0.85} />
      </mesh>

      {/* Corner Flower Accent */}
      <mesh
        position={[0.32, 0.024, -0.32]}
        castShadow={false}
        receiveShadow={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color={flowerColor} roughness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * Realistic Surrounding Urban Environment:
 * - Sky backdrop & 8 animated drifting 3D volumetric clouds
 * - Flock of 12 animated 3D flying birds with flapping wings
 * - Asphalt perimeter avenues with lane markings, zebra crosswalks, sidewalks & streetlamps
 * - 8 animated 3D cars/taxis/vans driving smoothly along the roads
 * - West Botanical Park & East Civic Garden Plaza with lawns, trees, flower beds, benches & fountain
 * - 8 tall surrounding high-rise and mid-rise city skyline buildings
 */
function RealisticCityEnvironment() {
  const cloudsRef = useRef<THREE.Group>(null);
  const birdsRef = useRef<THREE.Group>(null);
  const carsRef = useRef<THREE.Group>(null);

  const cloudConfigs = useMemo(
    () => [
      { x: -11, y: 9.8, z: -8.5, scale: 1.15, speed: 0.28 },
      { x: -4.5, y: 10.7, z: -10.2, scale: 1.35, speed: 0.22 },
      { x: 3.5, y: 10.1, z: -9.0, scale: 1.05, speed: 0.31 },
      { x: 10.5, y: 11.0, z: -7.8, scale: 1.25, speed: 0.25 },
      { x: -9.5, y: 10.3, z: -2.2, scale: 0.95, speed: 0.34 },
      { x: 9.8, y: 9.9, z: -1.5, scale: 1.1, speed: 0.29 },
      { x: -7.2, y: 11.2, z: 5.5, scale: 1.2, speed: 0.24 },
      { x: 6.8, y: 10.4, z: 6.2, scale: 1.0, speed: 0.32 },
    ],
    []
  );

  const birdConfigs = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        radiusX: 5.5 + (i % 4) * 1.4,
        radiusZ: 4.2 + (i % 3) * 1.3,
        baseY: 6.8 + (i % 5) * 0.45,
        speed: 0.42 + (i % 4) * 0.07,
        phase: (i * Math.PI) / 6,
        flapSpeed: 10 + (i % 3) * 2.5,
      })),
    []
  );

  const carConfigs = useMemo(
    () => [
      // South Boulevard (+X and -X lanes at z = 5.05 and z = 5.65)
      { axis: 'x' as const, laneZ: 5.05, dir: 1, speed: 2.3, offset: -10, color: '#ef4444', isTaxi: false },
      { axis: 'x' as const, laneZ: 5.05, dir: 1, speed: 2.3, offset: 2, color: '#eab308', isTaxi: true },
      { axis: 'x' as const, laneZ: 5.65, dir: -1, speed: 2.1, offset: -4, color: '#3b82f6', isTaxi: false },
      { axis: 'x' as const, laneZ: 5.65, dir: -1, speed: 2.1, offset: 8, color: '#10b981', isTaxi: false },
      // North Cross Street (+X and -X lanes at z = -4.55 and z = -5.1)
      { axis: 'x' as const, laneZ: -4.55, dir: 1, speed: 1.9, offset: -6, color: '#f97316', isTaxi: false },
      { axis: 'x' as const, laneZ: -5.1, dir: -1, speed: 2.0, offset: 5, color: '#eab308', isTaxi: true },
      // West Avenue (x = -4.55, moving along Z)
      { axis: 'z' as const, laneX: -4.55, dir: 1, speed: 1.85, offset: -7, color: '#8b5cf6', isTaxi: false },
      // East Avenue (x = 4.55, moving along -Z)
      { axis: 'z' as const, laneX: 4.55, dir: -1, speed: 1.95, offset: 4, color: '#f8fafc', isTaxi: false },
    ],
    []
  );

  const outerBuildings = useMemo(
    () => [
      // Northwest High-Rise Glass Skyscraper
      { x: -7.4, z: -6.8, w: 2.5, h: 11.4, d: 2.2, color: '#334155', accent: '#38bdf8' },
      // North-Central Civic Towers
      { x: -3.2, z: -6.9, w: 2.3, h: 10.2, d: 2.0, color: '#1e293b', accent: '#60a5fa' },
      { x: 3.2, z: -6.9, w: 2.3, h: 10.6, d: 2.0, color: '#334155', accent: '#38bdf8' },
      // Northeast Signature Skyscraper
      { x: 7.4, z: -6.8, w: 2.6, h: 11.8, d: 2.2, color: '#1e293b', accent: '#7dd3fc' },
      // Far West High-Rise Tower
      { x: -10.2, z: -1.8, w: 2.2, h: 9.2, d: 2.6, color: '#475569', accent: '#93c5fd' },
      // Far East High-Rise Office Tower
      { x: 10.2, z: -1.8, w: 2.2, h: 9.6, d: 2.6, color: '#475569', accent: '#38bdf8' },
      // Southwest Corner Commercial High-Rise
      { x: -8.6, z: 7.6, w: 2.5, h: 7.8, d: 2.1, color: '#334155', accent: '#fbbf24' },
      // Southeast Corner Commercial High-Rise
      { x: 8.6, z: 7.6, w: 2.5, h: 8.2, d: 2.1, color: '#334155', accent: '#34d399' },
    ],
    []
  );

  const parkTrees = useMemo(
    () => [
      // West Botanical Park Trees
      { x: -6.2, z: -2.2, scale: 1.05, pine: true },
      { x: -7.5, z: -2.6, scale: 1.15, pine: false },
      { x: -8.4, z: -1.2, scale: 0.95, pine: true },
      { x: -6.4, z: 0.4, scale: 1.1, pine: false },
      { x: -8.2, z: 1.5, scale: 1.2, pine: false },
      { x: -6.3, z: 2.8, scale: 0.95, pine: true },
      { x: -7.8, z: 3.2, scale: 1.05, pine: false },
      // East Civic Garden Plaza Trees
      { x: 6.2, z: -2.2, scale: 1.1, pine: false },
      { x: 7.6, z: -2.5, scale: 1.0, pine: true },
      { x: 8.4, z: -0.9, scale: 1.15, pine: false },
      { x: 6.3, z: 0.6, scale: 0.95, pine: true },
      { x: 8.1, z: 1.6, scale: 1.1, pine: false },
      { x: 6.4, z: 2.9, scale: 1.05, pine: false },
      { x: 7.7, z: 3.3, scale: 0.95, pine: true },
      // Boulevard Street Trees
      { x: -3.2, z: 4.35, scale: 0.78, pine: false },
      { x: 0.0, z: 4.35, scale: 0.78, pine: false },
      { x: 3.2, z: 4.35, scale: 0.78, pine: false },
    ],
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // 1. Animate drifting volumetric clouds
    if (cloudsRef.current) {
      cloudsRef.current.children.forEach((cloud, idx) => {
        const cfg = cloudConfigs[idx];
        if (!cfg) return;
        const span = 28;
        cloud.position.x =
          ((cfg.x + t * cfg.speed + span * 0.5) % span) - span * 0.5;
      });
    }

    // 2. Animate flying birds with flapping wings
    if (birdsRef.current) {
      birdsRef.current.children.forEach((bird, idx) => {
        const cfg = birdConfigs[idx];
        if (!cfg) return;
        const angle = t * cfg.speed + cfg.phase;
        const bx = Math.cos(angle) * cfg.radiusX;
        const bz = Math.sin(angle * 1.2) * cfg.radiusZ - 0.8;
        const by = cfg.baseY + Math.sin(t * 1.8 + cfg.phase) * 0.22;

        const dx = -Math.sin(angle) * cfg.radiusX * cfg.speed;
        const dz = Math.cos(angle * 1.2) * cfg.radiusZ * cfg.speed * 1.2;

        bird.position.set(bx, by, bz);
        bird.rotation.y = Math.atan2(dx, dz);

        const leftWing = bird.children[1];
        const rightWing = bird.children[2];
        const flap = Math.sin(t * cfg.flapSpeed + cfg.phase) * 0.55;
        if (leftWing) leftWing.rotation.z = flap;
        if (rightWing) rightWing.rotation.z = -flap;
      });
    }

    // 3. Animate 3D road vehicles
    if (carsRef.current) {
      carsRef.current.children.forEach((car, idx) => {
        const cfg = carConfigs[idx];
        if (!cfg) return;
        const range = 26;
        const posAlong =
          (((cfg.offset + t * cfg.speed * cfg.dir) % range) + range) % range -
          range * 0.5;

        if (cfg.axis === 'x') {
          car.position.set(posAlong, FLOOR_Y + 0.13, cfg.laneZ!);
          car.rotation.y = cfg.dir > 0 ? 0 : Math.PI;
        } else {
          car.position.set(cfg.laneX!, FLOOR_Y + 0.13, posAlong);
          car.rotation.y = cfg.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      });
    }
  });

  return (
    <group name="realistic-city-environment">
      {/* ================================================================= */}
      {/* 1. DRIFTING 3D VOLUMETRIC CLOUDS IN THE SKY                       */}
      {/* ================================================================= */}
      <group ref={cloudsRef}>
        {cloudConfigs.map((cfg, idx) => (
          <group
            key={`cloud-${idx}`}
            position={[cfg.x, cfg.y, cfg.z]}
            scale={[cfg.scale, cfg.scale, cfg.scale]}
          >
            <mesh position={[0, 0, 0]} castShadow={false} receiveShadow={false} raycast={() => null}>
              <sphereGeometry args={[0.62, 12, 12]} />
              <meshStandardMaterial color="#ffffff" roughness={0.95} />
            </mesh>
            <mesh position={[-0.52, -0.08, 0.12]} castShadow={false} receiveShadow={false} raycast={() => null}>
              <sphereGeometry args={[0.46, 10, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.95} />
            </mesh>
            <mesh position={[0.54, -0.06, -0.08]} castShadow={false} receiveShadow={false} raycast={() => null}>
              <sphereGeometry args={[0.48, 10, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.95} />
            </mesh>
            <mesh position={[0.18, 0.22, 0.18]} castShadow={false} receiveShadow={false} raycast={() => null}>
              <sphereGeometry args={[0.42, 10, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.95} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ================================================================= */}
      {/* 2. ANIMATED FLOCK OF 3D FLYING BIRDS WITH FLAPPING WINGS          */}
      {/* ================================================================= */}
      <group ref={birdsRef}>
        {birdConfigs.map((_, idx) => (
          <group key={`bird-${idx}`}>
            {/* Bird Body */}
            <mesh castShadow={false} receiveShadow={false} raycast={() => null}>
              <boxGeometry args={[0.06, 0.045, 0.18]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} />
            </mesh>
            {/* Left Flapping Wing */}
            <group position={[-0.03, 0.01, 0]}>
              <mesh position={[-0.09, 0, 0]} castShadow={false} receiveShadow={false} raycast={() => null}>
                <boxGeometry args={[0.18, 0.015, 0.08]} />
                <meshStandardMaterial color="#334155" roughness={0.6} />
              </mesh>
            </group>
            {/* Right Flapping Wing */}
            <group position={[0.03, 0.01, 0]}>
              <mesh position={[0.09, 0, 0]} castShadow={false} receiveShadow={false} raycast={() => null}>
                <boxGeometry args={[0.18, 0.015, 0.08]} />
                <meshStandardMaterial color="#334155" roughness={0.6} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* ================================================================= */}
      {/* 3. ASPHALT ROADS, LANE MARKINGS, CROSSWALKS & STREETLIGHTS        */}
      {/* ================================================================= */}
      <group position={[0, FLOOR_Y, 0]}>
        {/* South Boulevard (z = 5.35) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 5.35]}
          receiveShadow={true}
          raycast={() => null}
        >
          <planeGeometry args={[28, 1.45]} />
          <meshStandardMaterial color="#1e293b" roughness={0.92} />
        </mesh>
        {/* North Cross Street (z = -4.82) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, -4.82]}
          receiveShadow={true}
          raycast={() => null}
        >
          <planeGeometry args={[28, 1.35]} />
          <meshStandardMaterial color="#1e293b" roughness={0.92} />
        </mesh>
        {/* West Avenue (x = -4.55) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-4.55, -0.008, 0.3]}
          receiveShadow={true}
          raycast={() => null}
        >
          <planeGeometry args={[1.25, 22]} />
          <meshStandardMaterial color="#1e293b" roughness={0.92} />
        </mesh>
        {/* East Avenue (x = 4.55) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[4.55, -0.008, 0.3]}
          receiveShadow={true}
          raycast={() => null}
        >
          <planeGeometry args={[1.25, 22]} />
          <meshStandardMaterial color="#1e293b" roughness={0.92} />
        </mesh>

        {/* Dashed Center Road Markings on South Boulevard */}
        {Array.from({ length: 15 }).map((_, i) => (
          <mesh
            key={`south-dash-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[-11.2 + i * 1.6, 0.002, 5.35]}
            raycast={() => null}
          >
            <planeGeometry args={[0.75, 0.06]} />
            <meshBasicMaterial color="#f8fafc" />
          </mesh>
        ))}

        {/* Dashed Road Markings on West & East Avenues */}
        {Array.from({ length: 10 }).map((_, i) => (
          <React.Fragment key={`ave-dash-${i}`}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[-4.55, 0.002, -6.5 + i * 1.5]}
              raycast={() => null}
            >
              <planeGeometry args={[0.06, 0.68]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[4.55, 0.002, -6.5 + i * 1.5]}
              raycast={() => null}
            >
              <planeGeometry args={[0.06, 0.68]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
          </React.Fragment>
        ))}

        {/* Zebra Crosswalks at Intersections */}
        {[-3.6, 3.6].map((cx, cIdx) => (
          <group key={`crosswalk-${cIdx}`} position={[cx, 0.003, 5.35]}>
            {[-0.45, -0.22, 0, 0.22, 0.45].map((dz, sIdx) => (
              <mesh
                key={`stripe-${sIdx}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, dz]}
                raycast={() => null}
              >
                <planeGeometry args={[0.42, 0.11]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
            ))}
          </group>
        ))}

        {/* Streetlamps along the Boulevard & Parks */}
        {[
          [-3.7, 4.45],
          [-1.2, 4.45],
          [1.2, 4.45],
          [3.7, 4.45],
          [-5.35, -1.8],
          [-5.35, 1.8],
          [5.35, -1.8],
          [5.35, 1.8],
        ].map(([lx, lz], idx) => (
          <group key={`streetlamp-${idx}`} position={[lx, 0, lz]}>
            <mesh position={[0, 0.42, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.025, 0.035, 0.84, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.86, 0]} raycast={() => null}>
              <sphereGeometry args={[0.075, 10, 10]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#facc15"
                emissiveIntensity={0.85}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* ================================================================= */}
      {/* 4. MOVING 3D CARS, TAXIS & VANS ON THE ROADS                      */}
      {/* ================================================================= */}
      <group ref={carsRef}>
        {carConfigs.map((cfg, idx) => (
          <group key={`car-${idx}`}>
            {/* Lower Car Chassis */}
            <mesh castShadow={true} receiveShadow={true} raycast={() => null}>
              <boxGeometry args={[0.58, 0.15, 0.3]} />
              <meshStandardMaterial color={cfg.color} roughness={0.35} metalness={0.3} />
            </mesh>
            {/* Upper Cabin & Windshield */}
            <mesh position={[-0.03, 0.12, 0]} castShadow={true} raycast={() => null}>
              <boxGeometry args={[0.32, 0.12, 0.26]} />
              <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.6} />
            </mesh>
            {/* Taxi Roof Sign */}
            {cfg.isTaxi && (
              <mesh position={[-0.02, 0.2, 0]} raycast={() => null}>
                <boxGeometry args={[0.1, 0.04, 0.08]} />
                <meshBasicMaterial color="#fef08a" />
              </mesh>
            )}
            {/* 4 Wheels */}
            {[
              [-0.18, -0.07, 0.15],
              [0.18, -0.07, 0.15],
              [-0.18, -0.07, -0.15],
              [0.18, -0.07, -0.15],
            ].map(([wx, wy, wz], wIdx) => (
              <mesh
                key={`wheel-${wIdx}`}
                position={[wx, wy, wz]}
                rotation={[Math.PI / 2, 0, 0]}
                raycast={() => null}
              >
                <cylinderGeometry args={[0.06, 0.06, 0.04, 10]} />
                <meshStandardMaterial color="#090d16" roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* ================================================================= */}
      {/* 5. URBAN GARDENS, BOTANICAL PARKS, FOUNTAIN & LUSH TREES          */}
      {/* ================================================================= */}
      <group position={[0, FLOOR_Y, 0]}>
        {/* West Botanical Park Lawn (x = -7.3, z = 0.3) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[-7.3, 0.002, 0.3]}
          receiveShadow={true}
          raycast={() => null}
        >
          <planeGeometry args={[3.9, 8.2]} />
          <meshStandardMaterial color="#22c55e" roughness={0.92} />
        </mesh>

        {/* East Civic Garden Plaza Lawn (x = 7.3, z = 0.3) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[7.3, 0.002, 0.3]}
          receiveShadow={true}
          raycast={() => null}
        >
          <planeGeometry args={[3.9, 8.2]} />
          <meshStandardMaterial color="#22c55e" roughness={0.92} />
        </mesh>

        {/* Circular Park Fountain & Reflecting Pond in West Park */}
        <group position={[-7.2, 0.02, 0.2]}>
          <mesh receiveShadow={true} raycast={() => null}>
            <cylinderGeometry args={[0.85, 0.92, 0.12, 24]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.05, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.74, 0.74, 0.04, 24]} />
            <meshStandardMaterial color="#0284c7" roughness={0.15} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.18, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.12, 0.18, 0.28, 16]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.5} />
          </mesh>
        </group>

        {/* Circular Rose Garden Pavilion in East Park */}
        <group position={[7.2, 0.02, 0.2]}>
          <mesh receiveShadow={true} raycast={() => null}>
            <cylinderGeometry args={[0.82, 0.88, 0.08, 24]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.06, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.55, 0.6, 0.06, 20]} />
            <meshStandardMaterial color="#16a34a" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.12, 0]} raycast={() => null}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color="#f43f5e" roughness={0.7} />
          </mesh>
        </group>

        {/* 3D Deciduous & Pine Trees Across the Urban Parks & Boulevards */}
        {parkTrees.map((tree, idx) => (
          <group
            key={`park-tree-${idx}`}
            position={[tree.x, 0, tree.z]}
            scale={[tree.scale, tree.scale, tree.scale]}
          >
            {/* Tree Trunk */}
            <mesh position={[0, 0.22, 0]} castShadow={true} receiveShadow={true} raycast={() => null}>
              <cylinderGeometry args={[0.06, 0.09, 0.44, 8]} />
              <meshStandardMaterial color="#78350f" roughness={0.9} />
            </mesh>
            {tree.pine ? (
              <>
                <mesh position={[0, 0.56, 0]} castShadow={true} receiveShadow={true} raycast={() => null}>
                  <coneGeometry args={[0.38, 0.58, 10]} />
                  <meshStandardMaterial color="#166534" roughness={0.85} />
                </mesh>
                <mesh position={[0, 0.86, 0]} castShadow={true} receiveShadow={true} raycast={() => null}>
                  <coneGeometry args={[0.28, 0.48, 10]} />
                  <meshStandardMaterial color="#15803d" roughness={0.85} />
                </mesh>
              </>
            ) : (
              <>
                <mesh position={[0, 0.62, 0]} castShadow={true} receiveShadow={true} raycast={() => null}>
                  <sphereGeometry args={[0.34, 12, 12]} />
                  <meshStandardMaterial color="#16a34a" roughness={0.82} />
                </mesh>
                <mesh position={[0.16, 0.54, 0.12]} castShadow={true} receiveShadow={true} raycast={() => null}>
                  <sphereGeometry args={[0.24, 10, 10]} />
                  <meshStandardMaterial color="#22c55e" roughness={0.82} />
                </mesh>
                <mesh position={[-0.15, 0.52, -0.1]} castShadow={true} receiveShadow={true} raycast={() => null}>
                  <sphereGeometry args={[0.25, 10, 10]} />
                  <meshStandardMaterial color="#15803d" roughness={0.82} />
                </mesh>
              </>
            )}
          </group>
        ))}
      </group>

      {/* ================================================================= */}
      {/* 6. SURROUNDING OUTER SKYLINE BUILDINGS                            */}
      {/* ================================================================= */}
      <group position={[0, FLOOR_Y, 0]}>
        {outerBuildings.map((b, idx) => (
          <group key={`outer-bldg-${idx}`} position={[b.x, b.h * 0.5, b.z]}>
            <mesh castShadow={false} receiveShadow={true} raycast={() => null}>
              <boxGeometry args={[b.w, b.h, b.d]} />
              <meshStandardMaterial color={b.color} roughness={0.75} metalness={0.18} />
              <Edges scale={1.0} threshold={15} color="#0f172a" />
            </mesh>
            {/* Horizontal Illuminated Glass Curtain Bands */}
            {Array.from({ length: Math.floor(b.h * 1.2) }).map((_, fIdx) => {
              const fy = -b.h * 0.4 + fIdx * 0.72;
              if (fy > b.h * 0.42) return null;
              return (
                <mesh
                  key={`band-${fIdx}`}
                  position={[0, fy, 0]}
                  raycast={() => null}
                >
                  <boxGeometry args={[b.w + 0.03, 0.14, b.d + 0.03]} />
                  <meshStandardMaterial
                    color={b.accent}
                    emissive={b.accent}
                    emissiveIntensity={0.18}
                    roughness={0.25}
                    metalness={0.6}
                  />
                </mesh>
              );
            })}
            {/* Rooftop Mechanical Penthouse */}
            <mesh position={[0, b.h * 0.5 + 0.22, 0]} raycast={() => null}>
              <boxGeometry args={[b.w * 0.55, 0.44, b.d * 0.55]} />
              <meshStandardMaterial color="#475569" roughness={0.8} />
              <Edges scale={1.0} threshold={15} color="#1e293b" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Urban Cityscape Stage with Asymmetric Neighboring Buildings, Irregular 3D Balconies with People,
 * 7x5 Central Building Zone with Limited Buildable Concrete Pads & Restricted Courtyard Gardens,
 * and 7x2 Foreground Staging Area (x: -3..3, z: 3..4).
 */
interface DualShadowStageProps {
  windowCoordinates: Array<[number, number]>;
  allowedFloorSet: Set<string>;
  blockedWindowSet: Set<string>;
  wallStencils: StencilElement[];
  floorStencils: StencilElement[];
  spacing: number;
  hasSelectedBlock: boolean;
  hoveredColumn: [number, number] | null;
  isCandidateValidCantilever: boolean;
  onHoverColumn: (col: [number, number] | null) => void;
  onClickFloorCell: (targetX: number, targetZ: number) => void;
}

function DualShadowStage({
  windowCoordinates,
  allowedFloorSet,
  blockedWindowSet,
  spacing,
  hasSelectedBlock,
  hoveredColumn,
  isCandidateValidCantilever,
  onHoverColumn,
  onClickFloorCell,
}: DualShadowStageProps) {
  return (
    <group>
      {/* Expansive Urban Ground Receiver Plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FLOOR_Y - 0.04, 0]}
        receiveShadow={true}
        castShadow={false}
        raycast={() => null}
      >
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.94} metalness={0.02} />
      </mesh>

      {/* ===================================================================== */}
      {/* 1. TALL ASYMMETRIC NEIGHBORING BUILDINGS (Dark Slate) + BALCONIES     */}
      {/* ===================================================================== */}
      <group>
        {/* West Residential High-Rise Tower (Covers X = -3, -2, -1; height = 10.8 * spacing) */}
        <mesh
          position={[-2.05 * spacing, 2.35 * spacing, WALL_Z - 0.85]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[3.35 * spacing, 10.8 * spacing, 1.7]} />
          <meshStandardMaterial color="#334155" roughness={0.86} metalness={0.08} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* West Tower Upper Penthouse Crown & Illuminated Sky-Loft Window Bands */}
        <mesh
          position={[-2.05 * spacing, 8.05 * spacing, WALL_Z - 0.85]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[2.55 * spacing, 0.65 * spacing, 1.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.15} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* Central Stepped Loft High-Rise (Covers X = 0; height = 9.6 * spacing) */}
        <mesh
          position={[0, 1.75 * spacing, WALL_Z - 0.88]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[1.18 * spacing, 9.6 * spacing, 1.76]} />
          <meshStandardMaterial color="#273244" roughness={0.88} metalness={0.06} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* Central Tower Crown */}
        <mesh
          position={[0, 6.85 * spacing, WALL_Z - 0.88]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[0.88 * spacing, 0.55 * spacing, 1.35]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.15} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* East Terrace High-Rise Tower (Covers X = 1, 2, 3; height = 10.4 * spacing) */}
        <mesh
          position={[2.05 * spacing, 2.15 * spacing, WALL_Z - 0.85]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[3.35 * spacing, 10.4 * spacing, 1.7]} />
          <meshStandardMaterial color="#334155" roughness={0.86} metalness={0.08} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* East Tower Upper Penthouse Crown */}
        <mesh
          position={[2.05 * spacing, 7.65 * spacing, WALL_Z - 0.85]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[2.55 * spacing, 0.65 * spacing, 1.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.15} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* Upper-Story Architectural Glass Clerestory Bands on the Taller Neighboring Towers */}
        {[4.2, 5.1, 6.0, 6.9].map((bandY, bIdx) => (
          <React.Fragment key={`upper-band-${bIdx}`}>
            <mesh
              position={[-2.05 * spacing, bandY * spacing, WALL_Z + 0.008]}
              raycast={() => null}
            >
              <planeGeometry args={[2.95 * spacing, 0.22 * spacing]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.28}
                roughness={0.2}
                metalness={0.7}
              />
            </mesh>
            <mesh
              position={[2.05 * spacing, (bandY - 0.15) * spacing, WALL_Z + 0.008]}
              raycast={() => null}
            >
              <planeGeometry args={[2.95 * spacing, 0.22 * spacing]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={0.28}
                roughness={0.2}
                metalness={0.7}
              />
            </mesh>
          </React.Fragment>
        ))}

        {/* Irregularly Arranged 3D Balconies with Multiple Standing Residents */}
        {windowCoordinates.map(([wx, wy]) => {
          const key = `${wx}-${wy}`;
          const isBlocked = blockedWindowSet.has(key);
          return (
            <BalconyWithPerson
              key={`neighbor-balcony-${key}`}
              wx={wx}
              wy={wy}
              isBlocked={isBlocked}
              spacing={spacing}
            />
          );
        })}

        {/* Prominent Shadow Overlay Receiver Plane across the Full Height of the Neighboring Building Facades */}
        <mesh
          position={[0, 2.35 * spacing, WALL_Z + 0.015]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <planeGeometry args={[8.2 * spacing, 10.8 * spacing]} />
          <shadowMaterial color="#020617" transparent opacity={0.82} />
        </mesh>
      </group>

      {/* ===================================================================== */}
      {/* 2. CENTRAL BUILDING ZONE (Limited Buildable Pads vs Courtyard Gardens)*/}
      {/* ===================================================================== */}
      <group position={[0, FLOOR_Y, 0]}>
        {/* Central Building Zone Base Sub-Slab */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <planeGeometry args={[7.45 * spacing, 5.45 * spacing]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.9} metalness={0.04} />
        </mesh>

        {/* 7x5 Central Building Zone Cells: Buildable Concrete Pads vs Restricted Courtyard Gardens */}
        {GRID_COORDS.map((x) =>
          GRID_Z_COORDS.map((z) => {
            const isAllowedPad =
              allowedFloorSet.size === 0 || allowedFloorSet.has(`${x},${z}`);
            const isHoveredCell =
              hoveredColumn !== null &&
              hoveredColumn[0] === x &&
              hoveredColumn[1] === z;

            if (!isAllowedPad) {
              return (
                <CourtyardGardenCell
                  key={`garden-cell-${x}-${z}`}
                  x={x}
                  z={z}
                  spacing={spacing}
                  isHoveredInvalid={
                    isHoveredCell &&
                    hasSelectedBlock &&
                    !isCandidateValidCantilever
                  }
                  isHoveredValidCantilever={
                    isHoveredCell &&
                    hasSelectedBlock &&
                    isCandidateValidCantilever
                  }
                  hasSelectedBlock={hasSelectedBlock}
                  onHover={onHoverColumn}
                  onClickFloorCell={onClickFloorCell}
                />
              );
            }

            return (
              <group
                key={`floor-cell-${x}-${z}`}
                position={[x * spacing, 0.006, z * spacing]}
                scale={[spacing, 1, spacing]}
              >
                {/* Raised Reinforced Concrete Foundation Pad */}
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  geometry={SHARED_CELL_GUIDE_GEO}
                  castShadow={false}
                  receiveShadow={true}
                  onClick={(e) => {
                    if (!hasSelectedBlock || e.delta > 10) return;
                    e.stopPropagation();
                    onClickFloorCell(x, z);
                  }}
                  onPointerOver={(e) => {
                    if (!hasSelectedBlock) return;
                    e.stopPropagation();
                    onHoverColumn([x, z]);
                  }}
                  onPointerOut={(e) => {
                    if (!hasSelectedBlock) return;
                    e.stopPropagation();
                    onHoverColumn(null);
                  }}
                >
                  <meshBasicMaterial
                    color={
                      isHoveredCell
                        ? '#38bdf8'
                        : hasSelectedBlock
                        ? '#bae6fd'
                        : '#e2e8f0'
                    }
                    transparent
                    opacity={
                      isHoveredCell && hasSelectedBlock
                        ? 0.55
                        : hasSelectedBlock
                        ? 0.36
                        : 0.92
                    }
                    depthWrite={false}
                  />
                </mesh>
                <lineSegments
                  geometry={SHARED_CELL_GUIDE_EDGES}
                  rotation={[-Math.PI / 2, 0, 0]}
                  raycast={() => null}
                >
                  <lineBasicMaterial
                    color={
                      isHoveredCell && hasSelectedBlock
                        ? '#0284c7'
                        : hasSelectedBlock
                        ? '#0369a1'
                        : '#334155'
                    }
                    transparent
                    opacity={
                      isHoveredCell && hasSelectedBlock
                        ? 1.0
                        : hasSelectedBlock
                        ? 0.9
                        : 0.85
                    }
                  />
                </lineSegments>
              </group>
            );
          })
        )}

        {/* =================================================================== */}
        {/* 3. FOREGROUND STAGING AREA (Unplaced Skyscraper Modules, z: 3..4)   */}
        {/* =================================================================== */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.002, 3.5 * spacing]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <planeGeometry args={[7.45 * spacing, 2.35 * spacing]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.9} metalness={0.08} />
        </mesh>

        {/* Staging Area Safety Border Trim */}
        <mesh
          position={[0, 0.01, 3.5 * spacing]}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[7.48 * spacing, 0.02, 2.37 * spacing]} />
          <meshBasicMaterial color="#eab308" wireframe />
        </mesh>

        {/* Interactive Staging Area Cells (x: -3..3, z: 3..4) */}
        {GRID_COORDS.map((x) =>
          STAGING_Z_COORDS.map((z) => {
            const isHoveredCell =
              hoveredColumn !== null &&
              hoveredColumn[0] === x &&
              hoveredColumn[1] === z;
            return (
              <group
                key={`staging-cell-${x}-${z}`}
                position={[x * spacing, 0.008, z * spacing]}
                scale={[spacing, 1, spacing]}
              >
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  geometry={SHARED_CELL_GUIDE_GEO}
                  castShadow={false}
                  receiveShadow={false}
                  onClick={(e) => {
                    if (!hasSelectedBlock || e.delta > 10) return;
                    e.stopPropagation();
                    onClickFloorCell(x, z);
                  }}
                  onPointerOver={(e) => {
                    if (!hasSelectedBlock) return;
                    e.stopPropagation();
                    onHoverColumn([x, z]);
                  }}
                  onPointerOut={(e) => {
                    if (!hasSelectedBlock) return;
                    e.stopPropagation();
                    onHoverColumn(null);
                  }}
                >
                  <meshBasicMaterial
                    color={isHoveredCell ? '#fde047' : '#94a3b8'}
                    transparent
                    opacity={isHoveredCell && hasSelectedBlock ? 0.34 : 0.01}
                    depthWrite={false}
                  />
                </mesh>
                <lineSegments
                  geometry={SHARED_CELL_GUIDE_EDGES}
                  rotation={[-Math.PI / 2, 0, 0]}
                  raycast={() => null}
                >
                  <lineBasicMaterial
                    color={
                      isHoveredCell && hasSelectedBlock ? '#eab308' : '#475569'
                    }
                    transparent
                    opacity={isHoveredCell && hasSelectedBlock ? 0.95 : 0.65}
                  />
                </lineSegments>
              </group>
            );
          })
        )}

        {/* Prominent Real-Time Shadow Receiver Plane on Top of Both Concrete Pads AND Courtyard Grass */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.019, 0.4 * spacing]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <planeGeometry args={[24, 20]} />
          <shadowMaterial color="#020617" transparent opacity={0.82} />
        </mesh>
      </group>
    </group>
  );
}

export interface CubeClusterSceneProps {
  pieces: WallPiece[];
  blocks: BlockState[];
  windowCoordinates: Array<[number, number]>;
  allowedFloorSet: Set<string>;
  blockedWindowSet: Set<string>;
  lastCraneTransfer: CraneTransferOp | null;
  selectedPieceId: string | null;
  wallStencils: StencilElement[];
  floorStencils: StencilElement[];
  spacing: number;
  themeId: GlassThemeId;
  dragPlaneMode: 'XY' | 'XZ';
  activeCameraPreset: CameraPresetId | null;
  onUserOrbitStart: () => void;
  onSelectPiece: (id: string | null) => void;
  onNudgePiece: (id: string, delta: [number, number, number]) => void;
  onMovePieceTo: (id: string, newPos: [number, number, number]) => void;
  onMoveSelectedWithGravity: (targetX: number, targetZ: number) => boolean;
}

export const CubeClusterScene: React.FC<CubeClusterSceneProps> = ({
  pieces,
  windowCoordinates,
  allowedFloorSet,
  blockedWindowSet,
  lastCraneTransfer,
  selectedPieceId,
  wallStencils,
  floorStencils,
  spacing,
  themeId,
  activeCameraPreset,
  onUserOrbitStart,
  onSelectPiece,
  onMoveSelectedWithGravity,
}) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [hoveredPieceId, setHoveredPieceId] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<[number, number] | null>(null);

  const theme = GLASS_THEMES[themeId];
  const selectedPiece = useMemo(
    () => pieces.find((p) => p.id === selectedPieceId) ?? null,
    [pieces, selectedPieceId]
  );

  // Track the crane hook's resting world coordinates between moves
  const prevHookRef = useRef<{ x: number; z: number }>({
    x: 0,
    z: 1.5,
  });

  // Compute the active transfer centers if a crane move was triggered
  const activeTransferCenters = useMemo(() => {
    if (!lastCraneTransfer) return null;
    const fromCenter = getPieceWorldCenter(
      lastCraneTransfer.fromPos,
      lastCraneTransfer.dims,
      spacing
    );
    const toCenter = getPieceWorldCenter(
      lastCraneTransfer.toPos,
      lastCraneTransfer.dims,
      spacing
    );
    return {
      opId: lastCraneTransfer.seq,
      pieceId: lastCraneTransfer.pieceId,
      dims: lastCraneTransfer.dims,
      fromCenter,
      toCenter,
    };
  }, [lastCraneTransfer, spacing]);

  // Single Unified Spring Controller driving BOTH the Tower Crane and the active moving block
  const [craneSpring, craneApi] = useSpring(
    () => {
      const startX = prevHookRef.current.x;
      const startZ = prevHookRef.current.z;
      const initialBlockPos: [number, number, number] = activeTransferCenters
        ? activeTransferCenters.fromCenter
        : [0, 0, 0];

      return {
        from: {
          hookX: startX,
          hookZ: startZ,
          hookY: CRANE_REST_Y,
          blockPos: initialBlockPos,
        },
        to: async (next) => {
          if (!activeTransferCenters) return;
          const { fromCenter, toCenter, dims } = activeTransferCenters;
          const halfH = dims[1] * spacing * 0.5;
          const liftY = Math.max(fromCenter[1], toCenter[1]) + 2.1;
          const movedHorizontally =
            fromCenter[0] !== toCenter[0] || fromCenter[2] !== toCenter[2];

          // Pin block at fromCenter while crane travels to pick it up
          await next({
            hookX: prevHookRef.current.x,
            hookZ: prevHookRef.current.z,
            hookY: CRANE_REST_Y,
            blockPos: fromCenter,
            immediate: true,
          });

          if (movedHorizontally) {
            // Step A: Tower Crane rotates its jib & slides its trolley to hover over the block at `fromCenter`
            // (The block remains 100% stationary at `fromCenter`!)
            soundFX.playCraneSlew(0.32);
            await next({
              hookX: fromCenter[0],
              hookZ: fromCenter[2],
              hookY: CRANE_REST_Y,
              blockPos: fromCenter,
              config: { mass: 1.1, tension: 320, friction: 26 },
            });

            // Step B: Tower Crane hook drops down to latch onto the top of the block at `fromCenter`
            // (The block still remains 100% stationary at `fromCenter`!)
            soundFX.playCraneWinch('down', 0.26);
            await next({
              hookX: fromCenter[0],
              hookZ: fromCenter[2],
              hookY: fromCenter[1] + halfH + 0.12,
              blockPos: fromCenter,
              config: { mass: 1.0, tension: 380, friction: 26 },
            });

            // Step C: Attach block and hoist BOTH the hook and the block UP together in lockstep
            soundFX.playCraneWinch('up', 0.3);
            await next({
              hookX: fromCenter[0],
              hookZ: fromCenter[2],
              hookY: liftY + halfH + 0.12,
              blockPos: [fromCenter[0], liftY, fromCenter[2]],
              config: { mass: 1.25, tension: 360, friction: 26 },
            });

            // Step D: Tower Crane slews & trolleys horizontally WITH the attached block in 100% lockstep
            soundFX.playCraneSlew(0.38);
            await next({
              hookX: toCenter[0],
              hookZ: toCenter[2],
              hookY: liftY + halfH + 0.12,
              blockPos: [toCenter[0], liftY, toCenter[2]],
              config: { mass: 1.35, tension: 310, friction: 28 },
            });
          } else {
            // Vertical-only nudge: crane hovers over block, lowers hook, and adjusts height together
            soundFX.playCraneWinch('down', 0.24);
            await next({
              hookX: fromCenter[0],
              hookZ: fromCenter[2],
              hookY: fromCenter[1] + halfH + 0.12,
              blockPos: fromCenter,
              config: { mass: 1.0, tension: 360, friction: 26 },
            });
          }

          // Step E (Part 1): Lower hook + attached block together to gravity-settled `toCenter`
          soundFX.playCraneWinch('down', 0.28);
          await next({
            hookX: toCenter[0],
            hookZ: toCenter[2],
            hookY: toCenter[1] + halfH + 0.12,
            blockPos: toCenter,
            config: { mass: 2, tension: 300, friction: 20 },
          });

          // Heavy structural landing thud & grapple release when block settles into place
          soundFX.playCraneDropThud();

          // Step E (Part 2): Detach block at `toCenter` and retract hook up to CRANE_REST_Y
          soundFX.playCraneWinch('up', 0.24);
          await next({
            hookX: toCenter[0],
            hookZ: toCenter[2],
            hookY: CRANE_REST_Y,
            blockPos: toCenter,
            config: { mass: 1.1, tension: 340, friction: 26 },
          });

          prevHookRef.current = {
            x: toCenter[0],
            z: toCenter[2],
          };
        },
      };
    },
    [activeTransferCenters?.opId]
  );

  // When the user selects a block (before clicking a destination cell), smoothly slew the Tower Crane to hover above it
  useEffect(() => {
    if (!selectedPiece) return;
    const center = getPieceWorldCenter(
      selectedPiece.position,
      selectedPiece.dims,
      spacing
    );
    soundFX.playCraneSlew(0.24);
    craneApi.start({
      hookX: center[0],
      hookZ: center[2],
      hookY: CRANE_REST_Y,
      config: { mass: 1.15, tension: 300, friction: 26 },
      onRest: () => {
        prevHookRef.current = { x: center[0], z: center[2] };
      },
    });
  }, [selectedPiece, spacing, craneApi]);

  // Calculate live ghost landing position, validity on allowedFloorSet (including cantilever support at y > 0), & grid anchor
  const candidatePlacement = useMemo(() => {
    if (!selectedPiece) return null;
    const rawCol = hoveredColumn ?? [
      selectedPiece.position[0],
      selectedPiece.position[2],
    ];

    const { gridPos, isValid: isValidPad } =
      resolveBestPlacementAnchor(
        selectedPiece,
        rawCol[0],
        rawCol[1],
        pieces,
        allowedFloorSet
      );

    const worldCenter = getPieceWorldCenter(gridPos, selectedPiece.dims, spacing);

    return {
      gridPos,
      worldCenter,
      isValidPad,
      isCantilevered: isValidPad && gridPos[1] > 0,
      isHoveringNewColumn: hoveredColumn !== null,
    };
  }, [selectedPiece, hoveredColumn, pieces, allowedFloorSet, spacing]);

  // Compute projected floor shadow mesh grids for all placed blocks + pre-lock 40° ray trajectory preview
  const projectedShadowData = useMemo(() => {
    const cotSun = LIGHT_POSITION[2] / LIGHT_POSITION[1]; // cot(40°) ≈ 1.19175 (directed straight along -Z)

    const computePieceShadowFootprint = (
      pos: [number, number, number],
      dims: [number, number, number],
      pieceId: string,
      shape: ShapeKind
    ) => {
      const [px, py, pz] = pos;
      const [w, h, d] = dims;
      const minWorldX = (px - 0.46) * spacing;
      const maxWorldX = (px + w - 0.54) * spacing;
      const minWorldZ = (pz - 0.46) * spacing;
      const maxWorldZ = (pz + d - 0.54) * spacing;
      const bottomWorldY = Math.max(FLOOR_Y, (py - 2.5) * spacing);
      const topWorldY = (py - 2.5 + h) * spacing;

      const deltaTopY = Math.max(0.1, topWorldY - FLOOR_Y);
      const deltaBottomY = Math.max(0, bottomWorldY - FLOOR_Y);

      // 40-degree shadow projection straight towards the Neighboring Buildings (-Z)
      const rawTipZ = minWorldZ - deltaTopY * cotSun;
      const rawStartZ = maxWorldZ - deltaBottomY * cotSun;

      const clampedTipZ = Math.max(WALL_Z + 0.04, rawTipZ);
      const clampedStartZ = Math.max(clampedTipZ + 0.16, rawStartZ);

      const centerX = (minWorldX + maxWorldX) * 0.5;
      const widthX = Math.max(0.18, maxWorldX - minWorldX);
      const centerZ = (clampedTipZ + clampedStartZ) * 0.5;
      const depthZ = Math.max(0.18, clampedStartZ - clampedTipZ);

      // Check if this piece alone shades any Neighboring Building balcony resident under the 40° Sun
      const pieceBlocks = deriveBlocksFromPieces([
        {
          id: pieceId,
          name: pieceId,
          shape,
          dims,
          position: pos,
          targetPosition: pos,
          initialPosition: pos,
          accentColor: '#38bdf8',
          wallSilhouette: 'rect',
          floorSilhouette: 'rect',
        },
      ]).filter((b) => b.z >= GRID_Z_MIN && b.z <= GRID_Z_MAX);

      const shadedBalconies: Array<[number, number]> = [];
      for (const [wx, wy] of windowCoordinates) {
        if (isBalconyShadedByBlocks(wx, wy, pieceBlocks, LIGHT_POSITION)) {
          shadedBalconies.push([wx, wy]);
        }
      }

      // Build 40-degree solar ray trajectory line segments from the block's top corners to the floor shadow
      const rayEndY =
        rawTipZ < WALL_Z + 0.04
          ? Math.max(
              FLOOR_Y,
              topWorldY - (minWorldZ - (WALL_Z + 0.04)) / cotSun
            )
          : FLOOR_Y + 0.02;

      const rayPositions = new Float32Array([
        // Left top-back ray (40° angle to shadow tip)
        minWorldX,
        topWorldY,
        minWorldZ,
        minWorldX,
        rayEndY,
        clampedTipZ,
        // Right top-back ray (40° angle to shadow tip)
        maxWorldX,
        topWorldY,
        minWorldZ,
        maxWorldX,
        rayEndY,
        clampedTipZ,
        // Center 40° trajectory spine
        centerX,
        topWorldY,
        minWorldZ,
        centerX,
        rayEndY,
        clampedTipZ,
        // Front top edge to shadow rear boundary
        minWorldX,
        topWorldY,
        maxWorldZ,
        minWorldX,
        FLOOR_Y + 0.02,
        Math.max(WALL_Z + 0.06, maxWorldZ - deltaTopY * cotSun),
        maxWorldX,
        topWorldY,
        maxWorldZ,
        maxWorldX,
        FLOOR_Y + 0.02,
        Math.max(WALL_Z + 0.06, maxWorldZ - deltaTopY * cotSun),
      ]);
      const rayGeo = new THREE.BufferGeometry();
      rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));

      return {
        pieceId,
        centerX,
        widthX,
        centerZ,
        depthZ,
        clampedTipZ,
        clampedStartZ,
        minWorldX,
        maxWorldX,
        minWorldZ,
        maxWorldZ,
        topWorldY,
        rayEndY,
        shadedBalconies,
        shadesBalcony: shadedBalconies.length > 0,
        rayGeo,
      };
    };

    const activePieceShadows = pieces.map((p) =>
      computePieceShadowFootprint(p.position, p.dims, p.id, p.shape)
    );

    const previewShadow =
      selectedPiece && candidatePlacement
        ? computePieceShadowFootprint(
            candidatePlacement.gridPos,
            selectedPiece.dims,
            selectedPiece.id,
            selectedPiece.shape
          )
        : null;

    return {
      activePieceShadows,
      previewShadow,
    };
  }, [pieces, selectedPiece, candidatePlacement, windowCoordinates, spacing]);

  useEffect(() => {
    if (hoveredPieceId || (selectedPieceId && hoveredColumn)) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [hoveredPieceId, selectedPieceId, hoveredColumn]);

  return (
    <div className="relative w-full h-full bg-[#bae6fd] touch-none">
      <Canvas
        shadows
        orthographic
        dpr={isSoftwareGl ? 1 : [1, 2]}
        camera={{
          position: [12, 10.5, 13],
          zoom: 60,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: !isSoftwareGl,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        onCreated={({ gl, scene }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          scene.background = new THREE.Color('#bae6fd');
          scene.fog = new THREE.FogExp2('#bae6fd', 0.0045);
        }}
      >
        <color attach="background" args={['#bae6fd']} />
        <SoftShadows size={12} samples={16} focus={0.85} />
        <StudioEnvironment />

        {/* High-Contrast Architectural Daylight (Lower ambient so the 40° Sun shadow is bold and prominent) */}
        <ambientLight intensity={0.48} color="#f8fafc" />
        <hemisphereLight
          args={['#e0f2fe', '#cbd5e1', 0.48]}
          position={[0, 20, 0]}
        />

        {/* SINGLE SHADOW-CASTING SUN AT TOP-BACK AT A 40-DEGREE ANGLE (NO VISIBLE SUN ORB IN SCENE) */}
        <directionalLight
          position={LIGHT_POSITION}
          intensity={2.35}
          color="#fffbeb"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-11}
          shadow-camera-right={11}
          shadow-camera-top={11}
          shadow-camera-bottom={-11}
          shadow-camera-near={1}
          shadow-camera-far={45}
          shadow-bias={-0.0005}
        />

        {/* OrbitControls for full 360-degree isometric rotation & touch gestures */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping={!isSoftwareGl}
          dampingFactor={0.07}
          rotateSpeed={0.85}
          zoomSpeed={0.95}
          enablePan={false}
          minZoom={18}
          maxZoom={150}
          target={[0, 0.1, 0.2]}
        />

        <CameraController
          activePreset={activeCameraPreset}
          onUserOrbitStart={onUserOrbitStart}
          controlsRef={controlsRef}
        />

        {/* Realistic Surrounding Environment: Gardens, Parks, Outer Buildings, Roads, Cars, Sky, Clouds & Birds */}
        <RealisticCityEnvironment />

        {/* Neighboring Buildings with Irregular 3D Balconies & Standing People, Limited Concrete Pads & Staging Area */}
        <DualShadowStage
          windowCoordinates={windowCoordinates}
          allowedFloorSet={allowedFloorSet}
          blockedWindowSet={blockedWindowSet}
          wallStencils={wallStencils}
          floorStencils={floorStencils}
          spacing={spacing}
          hasSelectedBlock={selectedPieceId !== null}
          hoveredColumn={hoveredColumn}
          isCandidateValidCantilever={Boolean(
            candidatePlacement?.isCantilevered
          )}
          onHoverColumn={setHoveredColumn}
          onClickFloorCell={(targetX, targetZ) => {
            onMoveSelectedWithGravity(targetX, targetZ);
            setHoveredColumn(null);
          }}
        />

        {/* =========================================================================== */}
        {/* SUBTLE FLOOR 'TARGET ZONES' (PROJECTED MESH GRIDS) & 40° RAY TRAJECTORIES   */}
        {/* =========================================================================== */}
        <group>
          {/* 1. Balcony Shadow Apron Target-Zone Mesh Grids on the Floor (z = BALCONY_GRID_Z) */}
          {GRID_COORDS.map((x) => {
            const hasBlockedBalconyInCol = Array.from(blockedWindowSet).some(
              (key) => Number(key.split('-')[0]) === x
            );
            return (
              <group
                key={`balcony-apron-target-zone-${x}`}
                position={[x * spacing, FLOOR_Y + 0.009, BALCONY_GRID_Z * spacing]}
                scale={[0.92 * spacing, 1, 0.72 * spacing]}
              >
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  geometry={SHARED_UNIT_PLANE_GEO}
                  castShadow={false}
                  receiveShadow={false}
                  raycast={() => null}
                >
                  <meshBasicMaterial
                    color={hasBlockedBalconyInCol ? '#ef4444' : '#f59e0b'}
                    transparent
                    opacity={hasBlockedBalconyInCol ? 0.26 : 0.12}
                    depthWrite={false}
                  />
                </mesh>
                <lineSegments
                  geometry={SHARED_SUBCELL_GRID_GEO}
                  raycast={() => null}
                >
                  <lineBasicMaterial
                    color={hasBlockedBalconyInCol ? '#dc2626' : '#d97706'}
                    transparent
                    opacity={hasBlockedBalconyInCol ? 0.8 : 0.45}
                  />
                </lineSegments>
              </group>
            );
          })}

          {/* 2. Subtle Floor Target-Zone Sub-Grids on Allowed Buildable Cells */}
          {GRID_COORDS.map((x) =>
            GRID_Z_COORDS.map((z) => {
              if (allowedFloorSet.size > 0 && !allowedFloorSet.has(`${x},${z}`)) {
                return null;
              }
              const isForwardSafeZone = z >= 1;
              return (
                <lineSegments
                  key={`floor-subgrid-${x}-${z}`}
                  position={[x * spacing, FLOOR_Y + 0.007, z * spacing]}
                  scale={[0.92 * spacing, 1, 0.92 * spacing]}
                  geometry={SHARED_SUBCELL_GRID_GEO}
                  raycast={() => null}
                >
                  <lineBasicMaterial
                    color={isForwardSafeZone ? '#0284c7' : '#64748b'}
                    transparent
                    opacity={isForwardSafeZone ? 0.28 : 0.18}
                  />
                </lineSegments>
              );
            })
          )}

          {/* 3. Realistic Dark Cast Shadows on the Floor & Grass for Every Placed Block */}
          {projectedShadowData.activePieceShadows.map((item) => {
            const isSelectedBlock = item.pieceId === selectedPieceId;
            return (
              <group key={`cast-shadow-grid-${item.pieceId}`}>
                {/* Realistic Dark Shadow Footprint (Rendered at FLOOR_Y + 0.021, clearly on top of grass & concrete) */}
                <group
                  position={[item.centerX, FLOOR_Y + 0.021, item.centerZ]}
                  scale={[item.widthX, 1, item.depthZ]}
                >
                  <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    geometry={SHARED_UNIT_PLANE_GEO}
                    castShadow={false}
                    receiveShadow={false}
                    raycast={() => null}
                  >
                    <meshBasicMaterial
                      color={item.shadesBalcony ? '#450a0a' : '#090d16'}
                      transparent
                      opacity={
                        item.shadesBalcony
                          ? 0.68
                          : isSelectedBlock
                          ? 0.62
                          : 0.54
                      }
                      depthWrite={false}
                    />
                  </mesh>
                  <lineSegments
                    geometry={SHARED_PROJECTED_MESH_GRID_GEO}
                    raycast={() => null}
                  >
                    <lineBasicMaterial
                      color={item.shadesBalcony ? '#ef4444' : '#020617'}
                      transparent
                      opacity={
                        item.shadesBalcony
                          ? 0.85
                          : isSelectedBlock
                          ? 0.68
                          : 0.45
                      }
                    />
                  </lineSegments>
                </group>

                {/* Subtle 40° Solar Ray Trajectory Lines for Placed Blocks */}
                <lineSegments geometry={item.rayGeo} raycast={() => null}>
                  <lineBasicMaterial
                    color={item.shadesBalcony ? '#ef4444' : '#334155'}
                    transparent
                    opacity={
                      item.shadesBalcony
                        ? 0.62
                        : isSelectedBlock
                        ? 0.5
                        : 0.22
                    }
                  />
                </lineSegments>
              </group>
            );
          })}

          {/* 4. Pre-Lock 40° Ray Trajectory & Projected Floor Shadow Target-Zone Preview */}
          {selectedPiece &&
            candidatePlacement &&
            projectedShadowData.previewShadow && (
              <group>
                {/* Highlighted Pre-Lock Projected Shadow Mesh Grid on the Floor */}
                <group
                  position={[
                    projectedShadowData.previewShadow.centerX,
                    FLOOR_Y + 0.024,
                    projectedShadowData.previewShadow.centerZ,
                  ]}
                  scale={[
                    projectedShadowData.previewShadow.widthX,
                    1,
                    projectedShadowData.previewShadow.depthZ,
                  ]}
                >
                  <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    geometry={SHARED_UNIT_PLANE_GEO}
                    castShadow={false}
                    receiveShadow={false}
                    raycast={() => null}
                  >
                    <meshBasicMaterial
                      color={
                        !candidatePlacement.isValidPad ||
                        projectedShadowData.previewShadow.shadesBalcony
                          ? '#ef4444'
                          : '#10b981'
                      }
                      transparent
                      opacity={0.32}
                      depthWrite={false}
                    />
                  </mesh>
                  <lineSegments
                    geometry={SHARED_PROJECTED_MESH_GRID_GEO}
                    raycast={() => null}
                  >
                    <lineBasicMaterial
                      color={
                        !candidatePlacement.isValidPad ||
                        projectedShadowData.previewShadow.shadesBalcony
                          ? '#b91c1c'
                          : '#047857'
                      }
                      transparent
                      opacity={0.95}
                    />
                  </lineSegments>
                </group>

                {/* 40-Degree Ray Trajectory Guide Lines from Candidate Block to Floor Target Zone */}
                <lineSegments
                  geometry={projectedShadowData.previewShadow.rayGeo}
                  raycast={() => null}
                >
                  <lineBasicMaterial
                    color={
                      !candidatePlacement.isValidPad ||
                      projectedShadowData.previewShadow.shadesBalcony
                        ? '#ef4444'
                        : '#10b981'
                    }
                    transparent
                    opacity={0.9}
                  />
                </lineSegments>
              </group>
            )}
        </group>

        {/* Under-Construction Building 3D Hammerhead Tower Crane */}
        <TowerCrane craneSpring={craneSpring} />

        {/* Live Gravity Drop Ghost Preview when a Block is Selected and Hovering a Floor/Stack Column */}
        {selectedPiece &&
          candidatePlacement &&
          candidatePlacement.isHoveringNewColumn && (
            <mesh
              position={candidatePlacement.worldCenter}
              scale={[
                selectedPiece.dims[0] * spacing,
                selectedPiece.dims[1] * spacing,
                selectedPiece.dims[2] * spacing,
              ]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.96, 0.96, 0.96]} />
              <meshBasicMaterial
                color={
                  !candidatePlacement.isValidPad ||
                  projectedShadowData.previewShadow?.shadesBalcony
                    ? '#ef4444'
                    : '#10b981'
                }
                transparent
                opacity={0.26}
                depthWrite={false}
              />
              <Edges
                scale={1.0}
                threshold={15}
                color={
                  !candidatePlacement.isValidPad ||
                  projectedShadowData.previewShadow?.shadesBalcony
                    ? '#dc2626'
                    : '#059669'
                }
              />
            </mesh>
          )}

        {/* Modular Skyscraper Units (Active moving block is driven in 100% lockstep by craneSpring.blockPos) */}
        <group>
          {pieces.map((piece) => {
            const staticWorldCenter = getPieceWorldCenter(
              piece.position,
              piece.dims,
              spacing
            );
            const isTransferredByCrane =
              activeTransferCenters?.pieceId === piece.id;

            return (
              <MovableShapeMesh
                key={piece.id}
                piece={piece}
                animatedPosition={
                  isTransferredByCrane ? craneSpring.blockPos : staticWorldCenter
                }
                selectedPieceId={selectedPieceId}
                isSelected={selectedPieceId === piece.id}
                isHovered={hoveredPieceId === piece.id}
                spacing={spacing}
                theme={theme}
                onSelect={onSelectPiece}
                onHover={setHoveredPieceId}
                onHoverColumn={setHoveredColumn}
                onMoveSelectedWithGravity={onMoveSelectedWithGravity}
              />
            );
          })}
        </group>
      </Canvas>
    </div>
  );
};

