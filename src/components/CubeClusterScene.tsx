import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Edges, OrbitControls, SoftShadows } from '@react-three/drei';
import { a } from '@react-spring/three';
import { SpringValue, to, useSpring } from '@react-spring/core';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  ALL_Z_MAX,
  BALCONY_GRID_Z,
  BlockState,
  CAMERA_PRESETS,
  CameraPresetId,
  GLASS_THEMES,
  GlassTheme,
  GlassThemeId,
  GRID_COORDS,
  GRID_MAX,
  GRID_MIN,
  LIGHT_POSITION,
  STAGING_Z_COORDS,
  ShapeKind,
  StencilElement,
  WallPiece,
  calculateGravityDrop,
  deriveBlocksFromPieces,
  getPieceWorldCenter,
  isBalconyShadedByBlocks,
  settlePiecesWithGravity,
} from '../types/puzzle';
import type { CraneTransferOp } from '../store/usePuzzleStore';

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

// Neighboring Building front facade sits at WALL_Z = -3.12, with 3D Balconies jutting out to BALCONY_Z = -2.72
const WALL_Z = -3.12;
const BALCONY_Z = -2.72;
const FLOOR_Y = -2.65;
const CRANE_JIB_Y = 4.15;
const CRANE_REST_Y = 3.35;
const CRANE_PIVOT_X = -3.45;
const CRANE_PIVOT_Z = 0.25;

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
 * Computes an aspect- and orientation-aware orthographic zoom so the entire
 * 3D cityscape (Neighboring Buildings, Gantry Crane, Central Plot, and Staging Area)
 * fits comfortably in mobile portrait, mobile landscape, tablet, and desktop viewports.
 */
function computeResponsiveZoom(
  baseZoom: number,
  width: number,
  height: number
): number {
  const safeW = Math.max(240, width - 20);
  const safeH = Math.max(200, height - 56);
  const maxZoomByWidth = safeW / 16.0;
  const maxZoomByHeight = safeH / 14.4;
  const scale = Math.min(1.08, maxZoomByWidth / 46, maxZoomByHeight / 46);
  return Math.max(14, baseZoom * scale);
}

function CameraController({
  activePreset,
  onUserOrbitStart,
  controlsRef,
}: CameraControllerProps) {
  const { camera, size } = useThree();
  const isTransitioningPosRef = useRef(true);
  const isTransitioningZoomRef = useRef(true);
  const baseZoomRef = useRef(46);
  const targetPosRef = useRef(new THREE.Vector3(13, 12, 14));
  const targetZoomRef = useRef(
    computeResponsiveZoom(46, size.width, size.height)
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
  const mastTiers = 8;

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

const HAPPY_SHIRT_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];

function BalconyWithPerson({
  wx,
  wy,
  isBlocked,
  spacing,
}: BalconyWithPersonProps) {
  const personGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const angerBadgeRef = useRef<THREE.Group>(null);

  const worldX = wx * spacing;
  const worldY = (wy - 2) * spacing;
  const seed = Math.abs(wx * 7 + wy * 13);
  const happyShirtColor = HAPPY_SHIRT_COLORS[seed % HAPPY_SHIRT_COLORS.length];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (personGroupRef.current) {
      if (isBlocked) {
        // Angry stomping / jumping up and down and shaking side to side
        personGroupRef.current.position.y =
          -0.28 + Math.abs(Math.sin(t * 12 + seed)) * 0.08;
        personGroupRef.current.rotation.y = Math.sin(t * 10 + seed) * 0.28;
      } else {
        // Calm gentle breathing / swaying in the sunshine
        personGroupRef.current.position.y =
          -0.28 + Math.sin(t * 2 + seed) * 0.015;
        personGroupRef.current.rotation.y = Math.sin(t * 1.2 + seed) * 0.08;
      }
    }

    if (leftArmRef.current && rightArmRef.current) {
      if (isBlocked) {
        // Arms raised high shaking fists in anger!
        leftArmRef.current.rotation.z = 2.55 + Math.sin(t * 16 + seed) * 0.35;
        rightArmRef.current.rotation.z = -2.55 - Math.cos(t * 16 + seed) * 0.35;
      } else {
        // Arms resting calmly at sides
        leftArmRef.current.rotation.z = 0.22 + Math.sin(t * 2 + seed) * 0.05;
        rightArmRef.current.rotation.z = -0.22 - Math.sin(t * 2 + seed) * 0.05;
      }
    }

    if (angerBadgeRef.current && isBlocked) {
      angerBadgeRef.current.position.y = 0.64 + Math.sin(t * 10) * 0.05;
      angerBadgeRef.current.rotation.y = Math.sin(t * 6) * 0.25;
    }
  });

  return (
    <group position={[worldX, worldY, BALCONY_Z]}>
      {/* 1. Recessed Apartment Balcony Glass Doorway on Facade */}
      <mesh
        position={[0, 0.04, WALL_Z - BALCONY_Z + 0.02]}
        castShadow={false}
        receiveShadow={true}
        raycast={() => null}
      >
        <planeGeometry args={[0.68, 0.78]} />
        <meshStandardMaterial
          color={isBlocked ? '#450a0a' : '#fef08a'}
          emissive={isBlocked ? '#7f1d1d' : '#fde047'}
          emissiveIntensity={isBlocked ? 0.35 : 0.75}
          roughness={0.3}
        />
      </mesh>

      {/* 2. Cantilevered Concrete Balcony Floor Slab */}
      <mesh
        position={[0, -0.34, 0]}
        castShadow={true}
        receiveShadow={true}
        raycast={() => null}
      >
        <boxGeometry args={[0.88, 0.09, 0.72]} />
        <meshStandardMaterial
          color={isBlocked ? '#7f1d1d' : '#cbd5e1'}
          roughness={0.8}
          metalness={0.1}
        />
        <Edges scale={1.0} threshold={15} color={isBlocked ? '#ef4444' : '#334155'} />
      </mesh>

      {/* 3. Balcony Front & Side Safety Railing + Glass/Steel Guard */}
      <group position={[0, -0.16, 0]}>
        {/* Front Top Handrail */}
        <mesh
          position={[0, 0.14, 0.33]}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[0.88, 0.04, 0.04]} />
          <meshStandardMaterial
            color={isBlocked ? '#ef4444' : '#0f172a'}
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
        {/* Side Top Handrails */}
        {[-0.42, 0.42].map((rx, idx) => (
          <mesh
            key={`side-rail-${idx}`}
            position={[rx, 0.14, 0]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.04, 0.04, 0.7]} />
            <meshStandardMaterial
              color={isBlocked ? '#ef4444' : '#0f172a'}
              roughness={0.4}
              metalness={0.7}
            />
          </mesh>
        ))}
        {/* Vertical Railing Balusters */}
        {[-0.4, -0.2, 0, 0.2, 0.4].map((bx, idx) => (
          <mesh
            key={`baluster-${idx}`}
            position={[bx, 0, 0.33]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.025, 0.28, 0.025]} />
            <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
          </mesh>
        ))}
      </group>

      {/* 4. 3D Resident Person Standing on the Balcony */}
      <group ref={personGroupRef} position={[0, -0.28, 0.05]}>
        {/* Left & Right Legs */}
        {[-0.07, 0.07].map((lx, idx) => (
          <mesh
            key={`leg-${idx}`}
            position={[lx, 0.11, 0]}
            castShadow={true}
            receiveShadow={true}
            raycast={() => null}
          >
            <boxGeometry args={[0.08, 0.22, 0.08]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} />
          </mesh>
        ))}

        {/* Torso / Jacket (Cheerful color when sunlit, bright angry crimson when shaded) */}
        <mesh
          position={[0, 0.31, 0]}
          castShadow={true}
          receiveShadow={true}
          raycast={() => null}
        >
          <boxGeometry args={[0.22, 0.24, 0.13]} />
          <meshStandardMaterial
            color={isBlocked ? '#dc2626' : happyShirtColor}
            emissive={isBlocked ? '#991b1b' : '#000000'}
            emissiveIntensity={isBlocked ? 0.35 : 0}
            roughness={0.55}
          />
        </mesh>

        {/* Left Arm (Pivoted at shoulder) */}
        <group ref={leftArmRef} position={[-0.14, 0.4, 0]}>
          <mesh
            position={[-0.02, -0.1, 0]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.065, 0.2, 0.065]} />
            <meshStandardMaterial
              color={isBlocked ? '#ef4444' : happyShirtColor}
              roughness={0.5}
            />
          </mesh>
        </group>

        {/* Right Arm (Pivoted at shoulder) */}
        <group ref={rightArmRef} position={[0.14, 0.4, 0]}>
          <mesh
            position={[0.02, -0.1, 0]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[0.065, 0.2, 0.065]} />
            <meshStandardMaterial
              color={isBlocked ? '#ef4444' : happyShirtColor}
              roughness={0.5}
            />
          </mesh>
        </group>

        {/* Head (Flushed red when angry in shadow, warm skin tone when sunlit) */}
        <group position={[0, 0.52, 0]}>
          <mesh castShadow={true} receiveShadow={true} raycast={() => null}>
            <sphereGeometry args={[0.115, 16, 16]} />
            <meshStandardMaterial
              color={isBlocked ? '#fca5a5' : '#fde68a'}
              roughness={0.45}
            />
          </mesh>

          {/* Eyes */}
          {[-0.042, 0.042].map((ex, idx) => (
            <mesh
              key={`eye-${idx}`}
              position={[ex, 0.015, 0.105]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshBasicMaterial color="#0f172a" />
            </mesh>
          ))}

          {/* Facial Expression: Angry Slanted Eyebrows & Shouting Mouth vs Happy Smile */}
          {isBlocked ? (
            <>
              {/* Left Angry Slanted Eyebrow (\) */}
              <mesh
                position={[-0.045, 0.048, 0.11]}
                rotation={[0, 0, -0.48]}
                castShadow={false}
                receiveShadow={false}
                raycast={() => null}
              >
                <boxGeometry args={[0.055, 0.016, 0.015]} />
                <meshBasicMaterial color="#7f1d1d" />
              </mesh>
              {/* Right Angry Slanted Eyebrow (/) */}
              <mesh
                position={[0.045, 0.048, 0.11]}
                rotation={[0, 0, 0.48]}
                castShadow={false}
                receiveShadow={false}
                raycast={() => null}
              >
                <boxGeometry args={[0.055, 0.016, 0.015]} />
                <meshBasicMaterial color="#7f1d1d" />
              </mesh>
              {/* Angry Shouting Mouth */}
              <mesh
                position={[0, -0.038, 0.108]}
                castShadow={false}
                receiveShadow={false}
                raycast={() => null}
              >
                <boxGeometry args={[0.055, 0.036, 0.015]} />
                <meshBasicMaterial color="#7f1d1d" />
              </mesh>
            </>
          ) : (
            /* Calm Happy Smile */
            <mesh
              position={[0, -0.035, 0.108]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.05, 0.014, 0.012]} />
              <meshBasicMaterial color="#0f172a" />
            </mesh>
          )}
        </group>

        {/* 5. Floating Red "!" Anger Exclamation Indicator When in Shadow */}
        {isBlocked && (
          <group ref={angerBadgeRef} position={[0, 0.78, 0]}>
            {/* Exclamation Bar */}
            <mesh
              position={[0, 0.08, 0]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.055, 0.15, 0.055]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
            {/* Exclamation Dot */}
            <mesh
              position={[0, -0.04, 0]}
              castShadow={false}
              receiveShadow={false}
              raycast={() => null}
            >
              <boxGeometry args={[0.055, 0.055, 0.055]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

export interface ShapeMeshProps {
  shape: ShapeKind;
  animatedPosition: SpringValue<[number, number, number]> | [number, number, number];
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

  return (
    <a.mesh
      position={animatedPosition as unknown as [number, number, number]}
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
        roughness={0.55}
        clearcoat={0.25}
        clearcoatRoughness={0.25}
        metalness={0.18}
        reflectivity={0.45}
        emissive={isSelected ? '#0284c7' : '#000000'}
        emissiveIntensity={isSelected ? 0.18 : 0}
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
          opacity={isSelected || isHovered ? 1.0 : 0.75}
        />
      </lineSegments>
    </a.mesh>
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
  const isPlacedInCentral = piece.position[2] <= GRID_MAX;

  useFrame((state) => {
    if (coreRef.current) {
      coreRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    }
  });

  const outerEdgeColor = useMemo(() => {
    if (isSelected) return '#0284c7';
    if (isHovered) return theme.hoverEdgeColor;
    if (isPlacedInCentral) return '#1e293b';
    return '#475569';
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

    // If another block is currently selected, tapping/clicking this block stacks the selected block
    // on top of this block's (targetX, targetZ) column via calculateGravityDrop!
    if (selectedPieceId && selectedPieceId !== piece.id) {
      const [colX, colZ] = resolveClickedColumn(e.point);
      const moved = onMoveSelectedWithGravity(colX, colZ);
      if (moved) {
        onHoverColumn(null);
        return;
      }
    }

    // Toggle selection of this block
    if (isSelected) {
      onSelect(null);
    } else {
      onSelect(piece.id);
    }
  };

  return (
    <group name={piece.id}>
      {/* Render Modular Skyscraper Unit synchronized with the Tower Crane */}
      <ShapeMesh
        shape={piece.shape}
        animatedPosition={animatedPosition}
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
              piece.dims[0] * spacing + 0.08,
              piece.dims[1] * spacing + 0.08,
              piece.dims[2] * spacing + 0.08,
            ]}
            castShadow={false}
            receiveShadow={false}
            raycast={() => null}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.18}
              depthWrite={false}
            />
            <Edges scale={1.0} threshold={15} color="#0284c7" />
          </mesh>
        )}

        {/* Architectural Elevator Core Indicator */}
        <mesh
          ref={coreRef}
          geometry={SHARED_CORE_NODE_GEO}
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
 * Urban Cityscape Stage with Neighboring Buildings, 3D Balconies with People,
 * Central Building Zone (z: -2..2), and Foreground Staging Area (z: 3..4).
 */
interface DualShadowStageProps {
  windowCoordinates: Array<[number, number]>;
  blockedWindowSet: Set<string>;
  wallStencils: StencilElement[];
  floorStencils: StencilElement[];
  spacing: number;
  hasSelectedBlock: boolean;
  hoveredColumn: [number, number] | null;
  onHoverColumn: (col: [number, number] | null) => void;
  onClickFloorCell: (targetX: number, targetZ: number) => void;
}

function DualShadowStage({
  windowCoordinates,
  blockedWindowSet,
  spacing,
  hasSelectedBlock,
  hoveredColumn,
  onHoverColumn,
  onClickFloorCell,
}: DualShadowStageProps) {
  return (
    <group>
      {/* Expansive Urban Plaza Receiver Plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FLOOR_Y - 0.04, 0]}
        receiveShadow={true}
        castShadow={false}
        raycast={() => null}
      >
        <planeGeometry args={[52, 52]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* ===================================================================== */}
      {/* 1. TWO TALL NEIGHBORING BUILDINGS (Dark Slate Concrete) + BALCONIES   */}
      {/* ===================================================================== */}
      <group>
        {/* West Neighboring Building (Covers X = -2, -1; Y = 0..4; front face at WALL_Z) */}
        <mesh
          position={[-1.52 * spacing, 0.25 * spacing, WALL_Z - 0.85]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[2.35 * spacing, 6.2 * spacing, 1.7]} />
          <meshStandardMaterial color="#273244" roughness={0.88} metalness={0.08} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* East Neighboring Building (Covers X = 1, 2; Y = 0..4; front face at WALL_Z) */}
        <mesh
          position={[1.52 * spacing, 0.25 * spacing, WALL_Z - 0.85]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[2.35 * spacing, 6.2 * spacing, 1.7]} />
          <meshStandardMaterial color="#273244" roughness={0.88} metalness={0.08} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* Central Skyway / Courtyard Backdrop Wall (Recessed dark slate concrete) */}
        <mesh
          position={[0, 0.25 * spacing, WALL_Z - 1.1]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[1.15 * spacing, 6.2 * spacing, 1.2]} />
          <meshStandardMaterial color="#1e2230" roughness={0.92} metalness={0.05} />
          <Edges scale={1.0} threshold={15} color="#0f172a" />
        </mesh>

        {/* 3D Balconies with Standing Residents (Happy in 60° Sun, Angry when in Shadow) */}
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

        {/* Dynamic Shadow Overlay Receiver Plane across the Neighboring Building Facades */}
        <mesh
          position={[0, 0.25 * spacing, WALL_Z + 0.015]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <planeGeometry args={[6.4 * spacing, 6.2 * spacing]} />
          <shadowMaterial color="#090d16" transparent opacity={0.5} />
        </mesh>
      </group>

      {/* ===================================================================== */}
      {/* 2. CENTRAL BUILDING ZONE (5x5 Foundation Pad, z: -2..2)               */}
      {/* ===================================================================== */}
      <group position={[0, FLOOR_Y, 0]}>
        {/* Central Building Zone Concrete Foundation Pad */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <planeGeometry args={[5.5 * spacing, 5.5 * spacing]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.88} metalness={0.05} />
        </mesh>

        {/* Interactive 5x5 Central Building Zone Grid Cells */}
        {GRID_COORDS.map((x) =>
          GRID_COORDS.map((z) => {
            const isHoveredCell =
              hoveredColumn !== null &&
              hoveredColumn[0] === x &&
              hoveredColumn[1] === z;
            return (
              <group
                key={`floor-cell-${x}-${z}`}
                position={[x * spacing, 0.006, z * spacing]}
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
                    color={
                      isHoveredCell
                        ? '#38bdf8'
                        : hasSelectedBlock
                        ? '#bae6fd'
                        : '#cbd5e1'
                    }
                    transparent
                    opacity={
                      isHoveredCell && hasSelectedBlock
                        ? 0.38
                        : hasSelectedBlock
                        ? 0.14
                        : 0.01
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
                        : '#64748b'
                    }
                    transparent
                    opacity={
                      isHoveredCell && hasSelectedBlock
                        ? 0.95
                        : hasSelectedBlock
                        ? 0.8
                        : 0.65
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
          <planeGeometry args={[5.5 * spacing, 2.35 * spacing]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.9} metalness={0.08} />
        </mesh>

        {/* Staging Area Safety Border Trim */}
        <mesh
          position={[0, 0.01, 3.5 * spacing]}
          castShadow={false}
          receiveShadow={false}
          raycast={() => null}
        >
          <boxGeometry args={[5.52 * spacing, 0.02, 2.37 * spacing]} />
          <meshBasicMaterial color="#eab308" wireframe />
        </mesh>

        {/* Interactive Staging Area Cells (x: -2..2, z: 3..4) */}
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
                    opacity={isHoveredCell && hasSelectedBlock ? 0.32 : 0.01}
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

        {/* Dynamic Shadow Overlay Receiver Plane on the Ground */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.018, 0.8 * spacing]}
          receiveShadow={true}
          castShadow={false}
          raycast={() => null}
        >
          <planeGeometry args={[14.5, 12.5]} />
          <shadowMaterial color="#0f172a" transparent opacity={0.48} />
        </mesh>
      </group>
    </group>
  );
}

export interface CubeClusterSceneProps {
  pieces: WallPiece[];
  blocks: BlockState[];
  windowCoordinates: Array<[number, number]>;
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
            await next({
              hookX: fromCenter[0],
              hookZ: fromCenter[2],
              hookY: CRANE_REST_Y,
              blockPos: fromCenter,
              config: { mass: 1.1, tension: 320, friction: 26 },
            });

            // Step B: Tower Crane hook drops down to latch onto the top of the block at `fromCenter`
            // (The block still remains 100% stationary at `fromCenter`!)
            await next({
              hookX: fromCenter[0],
              hookZ: fromCenter[2],
              hookY: fromCenter[1] + halfH + 0.12,
              blockPos: fromCenter,
              config: { mass: 1.0, tension: 380, friction: 26 },
            });

            // Step C: Attach block and hoist BOTH the hook and the block UP together in lockstep
            await next({
              hookX: fromCenter[0],
              hookZ: fromCenter[2],
              hookY: liftY + halfH + 0.12,
              blockPos: [fromCenter[0], liftY, fromCenter[2]],
              config: { mass: 1.25, tension: 360, friction: 26 },
            });

            // Step D: Tower Crane slews & trolleys horizontally WITH the attached block in 100% lockstep
            await next({
              hookX: toCenter[0],
              hookZ: toCenter[2],
              hookY: liftY + halfH + 0.12,
              blockPos: [toCenter[0], liftY, toCenter[2]],
              config: { mass: 1.35, tension: 310, friction: 28 },
            });
          } else {
            // Vertical-only nudge: crane hovers over block, lowers hook, and adjusts height together
            await next({
              hookX: fromCenter[0],
              hookZ: fromCenter[2],
              hookY: fromCenter[1] + halfH + 0.12,
              blockPos: fromCenter,
              config: { mass: 1.0, tension: 360, friction: 26 },
            });
          }

          // Step E (Part 1): Lower hook + attached block together to gravity-settled `toCenter`
          await next({
            hookX: toCenter[0],
            hookZ: toCenter[2],
            hookY: toCenter[1] + halfH + 0.12,
            blockPos: toCenter,
            config: { mass: 2, tension: 300, friction: 20 },
          });

          // Step E (Part 2): Detach block at `toCenter` and retract hook up to CRANE_REST_Y
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

  // Calculate live ghost landing position & grid anchor when a block is selected
  const candidatePlacement = useMemo(() => {
    if (!selectedPiece) return null;
    const rawCol = hoveredColumn ?? [
      selectedPiece.position[0],
      selectedPiece.position[2],
    ];
    const clampedX = Math.max(
      GRID_MIN,
      Math.min(GRID_MAX - selectedPiece.dims[0] + 1, rawCol[0])
    );
    const clampedZ = Math.max(
      GRID_MIN,
      Math.min(ALL_Z_MAX - selectedPiece.dims[2] + 1, rawCol[1])
    );
    const otherPieces = pieces.filter((p) => p.id !== selectedPiece.id);
    const settledOthers = settlePiecesWithGravity(otherPieces);
    const settledOtherBlocks = deriveBlocksFromPieces(settledOthers);
    const dropY = calculateGravityDrop(
      clampedX,
      clampedZ,
      settledOtherBlocks,
      selectedPiece.id,
      selectedPiece.dims
    );
    const gridPos: [number, number, number] = [clampedX, dropY, clampedZ];
    const worldCenter = getPieceWorldCenter(gridPos, selectedPiece.dims, spacing);
    return {
      gridPos,
      worldCenter,
      isHoveringNewColumn: hoveredColumn !== null,
    };
  }, [selectedPiece, hoveredColumn, pieces, spacing]);

  // Compute projected floor shadow mesh grids for all placed blocks + pre-lock 60° ray trajectory preview
  const projectedShadowData = useMemo(() => {
    const cot60 = LIGHT_POSITION[2] / LIGHT_POSITION[1]; // cot(60°) ≈ 0.57735 (directed straight along -Z)

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

      // 60-degree shadow projection straight towards the Neighboring Buildings (-Z)
      const rawTipZ = minWorldZ - deltaTopY * cot60;
      const rawStartZ = maxWorldZ - deltaBottomY * cot60;

      const clampedTipZ = Math.max(WALL_Z + 0.04, rawTipZ);
      const clampedStartZ = Math.max(clampedTipZ + 0.16, rawStartZ);

      const centerX = (minWorldX + maxWorldX) * 0.5;
      const widthX = Math.max(0.2, maxWorldX - minWorldX);
      const centerZ = (clampedTipZ + clampedStartZ) * 0.5;
      const depthZ = Math.max(0.2, clampedStartZ - clampedTipZ);

      // Check if this piece alone shades any Neighboring Building balcony resident under the 60° Sun
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
      ]).filter((b) => b.z >= GRID_MIN && b.z <= GRID_MAX);

      const shadedBalconies: Array<[number, number]> = [];
      for (const [wx, wy] of windowCoordinates) {
        if (isBalconyShadedByBlocks(wx, wy, pieceBlocks, LIGHT_POSITION)) {
          shadedBalconies.push([wx, wy]);
        }
      }

      // Build 60-degree solar ray trajectory line segments from the block's top-back & top-front corners to the floor shadow
      const rayEndY =
        rawTipZ < WALL_Z + 0.04
          ? Math.max(
              FLOOR_Y,
              topWorldY - (minWorldZ - (WALL_Z + 0.04)) / cot60
            )
          : FLOOR_Y + 0.02;

      const rayPositions = new Float32Array([
        // Left top-back ray (60° angle to shadow tip)
        minWorldX,
        topWorldY,
        minWorldZ,
        minWorldX,
        rayEndY,
        clampedTipZ,
        // Right top-back ray (60° angle to shadow tip)
        maxWorldX,
        topWorldY,
        minWorldZ,
        maxWorldX,
        rayEndY,
        clampedTipZ,
        // Center 60° trajectory spine
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
        Math.max(WALL_Z + 0.06, maxWorldZ - deltaTopY * cot60),
        maxWorldX,
        topWorldY,
        maxWorldZ,
        maxWorldX,
        FLOOR_Y + 0.02,
        Math.max(WALL_Z + 0.06, maxWorldZ - deltaTopY * cot60),
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
    <div className="relative w-full h-full bg-[#e2e8f0] touch-none">
      <Canvas
        shadows
        orthographic
        dpr={isSoftwareGl ? 1 : [1, 2]}
        camera={{
          position: [13, 12, 14],
          zoom: 36,
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
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          scene.background = new THREE.Color('#e2e8f0');
          scene.fog = new THREE.FogExp2('#e2e8f0', 0.006);
        }}
      >
        <color attach="background" args={['#e2e8f0']} />
        <SoftShadows size={20} samples={16} focus={0.6} />
        <StudioEnvironment />

        {/* Urban Daylight Ambient & Sky/Ground Hemisphere Fill (Non-shadow-casting) */}
        <ambientLight intensity={0.78} color="#f8fafc" />
        <hemisphereLight
          args={['#f0f9ff', '#cbd5e1', 0.68]}
          position={[0, 20, 0]}
        />

        {/* SINGLE SHADOW-CASTING SUN AT TOP-BACK (60-DEGREE ANGLE DIRECTED TOWARDS NEIGHBORING BUILDINGS) */}
        <directionalLight
          position={LIGHT_POSITION}
          intensity={1.65}
          color="#fffbeb"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-camera-near={1}
          shadow-camera-far={45}
          shadow-bias={-0.0005}
        />

        {/* Visible Glowing 3D Sun Disc in the Sky Along the Top-Back 60-Degree Solar Direction */}
        <group
          position={[
            LIGHT_POSITION[0] * 0.42,
            LIGHT_POSITION[1] * 0.42,
            LIGHT_POSITION[2] * 0.42,
          ]}
        >
          <mesh castShadow={false} receiveShadow={false} raycast={() => null}>
            <sphereGeometry args={[0.62, 24, 24]} />
            <meshBasicMaterial color="#fde047" />
          </mesh>
          <mesh castShadow={false} receiveShadow={false} raycast={() => null}>
            <sphereGeometry args={[0.88, 24, 24]} />
            <meshBasicMaterial color="#fef08a" transparent opacity={0.32} />
          </mesh>
        </group>

        {/* OrbitControls for full 360-degree isometric rotation & touch gestures */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping={!isSoftwareGl}
          dampingFactor={0.07}
          rotateSpeed={0.85}
          zoomSpeed={0.95}
          enablePan={false}
          minZoom={14}
          maxZoom={140}
          target={[0, 0.3, 0.3]}
        />

        <CameraController
          activePreset={activeCameraPreset}
          onUserOrbitStart={onUserOrbitStart}
          controlsRef={controlsRef}
        />

        {/* Neighboring Buildings with 3D Balconies & Standing People, Central Pad & Staging Area */}
        <DualShadowStage
          windowCoordinates={windowCoordinates}
          blockedWindowSet={blockedWindowSet}
          wallStencils={wallStencils}
          floorStencils={floorStencils}
          spacing={spacing}
          hasSelectedBlock={selectedPieceId !== null}
          hoveredColumn={hoveredColumn}
          onHoverColumn={setHoveredColumn}
          onClickFloorCell={(targetX, targetZ) => {
            onMoveSelectedWithGravity(targetX, targetZ);
            setHoveredColumn(null);
          }}
        />

        {/* =========================================================================== */}
        {/* SUBTLE FLOOR 'TARGET ZONES' (PROJECTED MESH GRIDS) & 60° RAY TRAJECTORIES   */}
        {/* =========================================================================== */}
        <group>
          {/* 1. Balcony Shadow Apron Target-Zone Mesh Grids on the Floor (z = BALCONY_GRID_Z) */}
          {GRID_COORDS.map((x) => {
            const isCentralSafeCorridor = x === 0;
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
                    color={
                      isCentralSafeCorridor
                        ? '#10b981'
                        : hasBlockedBalconyInCol
                        ? '#ef4444'
                        : '#f59e0b'
                    }
                    transparent
                    opacity={
                      isCentralSafeCorridor
                        ? 0.12
                        : hasBlockedBalconyInCol
                        ? 0.22
                        : 0.1
                    }
                    depthWrite={false}
                  />
                </mesh>
                <lineSegments
                  geometry={SHARED_SUBCELL_GRID_GEO}
                  raycast={() => null}
                >
                  <lineBasicMaterial
                    color={
                      isCentralSafeCorridor
                        ? '#059669'
                        : hasBlockedBalconyInCol
                        ? '#dc2626'
                        : '#d97706'
                    }
                    transparent
                    opacity={hasBlockedBalconyInCol ? 0.75 : 0.42}
                  />
                </lineSegments>
              </group>
            );
          })}

          {/* 2. Subtle Floor Target-Zone Sub-Grids across the 5x5 Central Building Zone */}
          {GRID_COORDS.map((x) =>
            GRID_COORDS.map((z) => {
              const isSafeCorridor = x === 0 || z >= 0;
              return (
                <lineSegments
                  key={`floor-subgrid-${x}-${z}`}
                  position={[x * spacing, FLOOR_Y + 0.007, z * spacing]}
                  scale={[0.92 * spacing, 1, 0.92 * spacing]}
                  geometry={SHARED_SUBCELL_GRID_GEO}
                  raycast={() => null}
                >
                  <lineBasicMaterial
                    color={isSafeCorridor ? '#0284c7' : '#64748b'}
                    transparent
                    opacity={isSafeCorridor ? 0.22 : 0.16}
                  />
                </lineSegments>
              );
            })
          )}

          {/* 3. Live Projected Shadow Mesh Grids on the Floor for Every Placed Block */}
          {projectedShadowData.activePieceShadows.map((item) => {
            const isSelectedBlock = item.pieceId === selectedPieceId;
            return (
              <group key={`cast-shadow-grid-${item.pieceId}`}>
                {/* Projected Floor Shadow Mesh Grid */}
                <group
                  position={[item.centerX, FLOOR_Y + 0.015, item.centerZ]}
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
                      color={item.shadesBalcony ? '#ef4444' : '#0284c7'}
                      transparent
                      opacity={
                        item.shadesBalcony
                          ? 0.24
                          : isSelectedBlock
                          ? 0.2
                          : 0.12
                      }
                      depthWrite={false}
                    />
                  </mesh>
                  <lineSegments
                    geometry={SHARED_PROJECTED_MESH_GRID_GEO}
                    raycast={() => null}
                  >
                    <lineBasicMaterial
                      color={item.shadesBalcony ? '#dc2626' : '#0369a1'}
                      transparent
                      opacity={
                        item.shadesBalcony
                          ? 0.82
                          : isSelectedBlock
                          ? 0.72
                          : 0.48
                      }
                    />
                  </lineSegments>
                </group>

                {/* Subtle 60° Solar Ray Trajectory Lines for Placed Blocks */}
                <lineSegments geometry={item.rayGeo} raycast={() => null}>
                  <lineBasicMaterial
                    color={item.shadesBalcony ? '#ef4444' : '#38bdf8'}
                    transparent
                    opacity={
                      item.shadesBalcony
                        ? 0.55
                        : isSelectedBlock
                        ? 0.5
                        : 0.22
                    }
                  />
                </lineSegments>
              </group>
            );
          })}

          {/* 4. Pre-Lock 60° Ray Trajectory & Projected Floor Shadow Target-Zone Preview (Before Locking Block in Place) */}
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
                        projectedShadowData.previewShadow.shadesBalcony
                          ? '#b91c1c'
                          : '#047857'
                      }
                      transparent
                      opacity={0.95}
                    />
                  </lineSegments>
                </group>

                {/* 60-Degree Ray Trajectory Guide Lines from Candidate Block to Floor Target Zone */}
                <lineSegments
                  geometry={projectedShadowData.previewShadow.rayGeo}
                  raycast={() => null}
                >
                  <lineBasicMaterial
                    color={
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
                  projectedShadowData.previewShadow?.shadesBalcony
                    ? '#ef4444'
                    : '#10b981'
                }
                transparent
                opacity={0.22}
                depthWrite={false}
              />
              <Edges
                scale={1.0}
                threshold={15}
                color={
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
