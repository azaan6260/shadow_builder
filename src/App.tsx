/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Grid,
  Rotate3d,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  CameraPresetId,
  GlassThemeId,
  LIGHT_POSITION,
  PUZZLE_LEVELS,
  checkWinCondition,
  isBalconyShadedByBlocks,
  isPieceInCentralZone,
  projectAngledShadow,
} from './types/puzzle';
import { CubeClusterScene } from './components/CubeClusterScene';
import { usePuzzleStore } from './store/usePuzzleStore';
import { mobileBridge } from './utils/capacitorBridge';
import { soundFX } from './utils/sound';

export default function App() {
  const activeLevelId = usePuzzleStore((s) => s.activeLevelId);
  const pieces = usePuzzleStore((s) => s.pieces);
  const blocks = usePuzzleStore((s) => s.blocks);
  const windowCoordinates = usePuzzleStore((s) => s.windowCoordinates);
  const allowedFloorSet = usePuzzleStore((s) => s.allowedFloorSet);
  const targetShadow = usePuzzleStore((s) => s.targetShadow);
  const targetWallShape = usePuzzleStore((s) => s.targetWallShape);
  const targetFloorShape = usePuzzleStore((s) => s.targetFloorShape);
  const hasWon = usePuzzleStore((s) => s.hasWon);
  const setHasWon = usePuzzleStore((s) => s.setHasWon);
  const selectedBlockId = usePuzzleStore((s) => s.selectedBlockId);
  const selectedPieceId = usePuzzleStore((s) => s.selectedPieceId);
  const history = usePuzzleStore((s) => s.history);
  const movesCount = usePuzzleStore((s) => s.movesCount);
  const lastCraneTransfer = usePuzzleStore((s) => s.lastCraneTransfer);
  const isCraneAnimating = usePuzzleStore((s) => s.isCraneAnimating);
  const setCraneAnimating = usePuzzleStore((s) => s.setCraneAnimating);
  const selectPiece = usePuzzleStore((s) => s.selectPiece);
  const cycleSelectedPiece = usePuzzleStore((s) => s.cycleSelectedPiece);
  const rotateSelectedPiece = usePuzzleStore((s) => s.rotateSelectedPiece);
  const moveSelectedWithGravity = usePuzzleStore((s) => s.moveSelectedWithGravity);
  const nudgePiece = usePuzzleStore((s) => s.nudgePiece);
  const movePieceTo = usePuzzleStore((s) => s.movePieceTo);
  const resetLevel = usePuzzleStore((s) => s.resetLevel);
  const setLevel = usePuzzleStore((s) => s.setLevel);
  const undo = usePuzzleStore((s) => s.undo);

  const [modalDismissedForView, setModalDismissedForView] = useState<boolean>(false);
  const [levelDrawerOpen, setLevelDrawerOpen] = useState<boolean>(false);
  const [themeId] = useState<GlassThemeId>('cyan');
  const [dragPlaneMode] = useState<'XY' | 'XZ'>('XY');
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPresetId | null>('iso-ne');
  const [isMuted, setIsMuted] = useState<boolean>(soundFX.isMuted);

  const solvedCelebratedRef = useRef<string | null>(null);

  // Safety fallback timer so isCraneAnimating never stays true if a spring animation is interrupted
  useEffect(() => {
    if (!isCraneAnimating || !lastCraneTransfer) return;
    const timer = window.setTimeout(() => {
      setCraneAnimating(false);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [isCraneAnimating, lastCraneTransfer, setCraneAnimating]);

  // Subscribe to CityAudioManager mute state, initialize Capacitor native shell, & unlock ambient cityscape audio
  useEffect(() => {
    void mobileBridge.initNativeShell({
      onPauseAudio: () => soundFX.pauseForBackground(),
      onResumeAudio: () => soundFX.resumeFromBackground(),
    });

    const unsub = soundFX.subscribe(setIsMuted);
    const unlockAudio = () => {
      soundFX.ensureAmbientStarted();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    return () => {
      unsub();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const activeLevel = useMemo(
    () => PUZZLE_LEVELS.find((l) => l.id === activeLevelId) ?? PUZZLE_LEVELS[0],
    [activeLevelId]
  );

  const activeSelectedId = selectedBlockId ?? selectedPieceId;

  // Evaluate Right to Light balcony status, limited foundation placement, and 40° sun shadow projections
  const winStatus = useMemo(
    () => checkWinCondition(pieces, windowCoordinates, allowedFloorSet),
    [pieces, windowCoordinates, allowedFloorSet]
  );

  // Phase 16: The "Right to Light" Analytical Win Condition (40° Single Sun + Balcony Residents + Limited Foundation Pads)
  useEffect(() => {
    const visibleBlocks = blocks.filter((block) => block.visible === true);
    const centralZoneBlocks = visibleBlocks.filter(
      (block) => block.z >= -2 && block.z <= 2
    );

    // 1. Check if the 40° Sun shadow from any central zone block hits any balcony resident
    const shadedBalconies = windowCoordinates.filter(([wx, wy]) =>
      isBalconyShadedByBlocks(wx, wy, centralZoneBlocks, LIGHT_POSITION)
    );
    const zeroBalconiesShaded = shadedBalconies.length === 0;

    // 2. Staging Area & Limited Buildable Pads Check: Have all modular blocks been placed on valid foundation pads?
    const allBlocksStackedInCentralZone =
      pieces.length > 0 &&
      pieces.every((piece) => isPieceInCentralZone(piece, allowedFloorSet));

    // Also compute 40° angled floor projection
    projectAngledShadow(centralZoneBlocks, LIGHT_POSITION);

    const matchedRightToLightWin =
      allBlocksStackedInCentralZone && zeroBalconiesShaded && winStatus.isWin;

    setHasWon(matchedRightToLightWin);
  }, [
    blocks,
    pieces,
    windowCoordinates,
    allowedFloorSet,
    targetShadow,
    targetWallShape,
    targetFloorShape,
    winStatus.isWin,
    setHasWon,
  ]);

  // Trigger celebration and score modal ONLY after the final block finishes moving to its selected position
  useEffect(() => {
    if (hasWon && !isCraneAnimating && solvedCelebratedRef.current !== activeLevel.id) {
      solvedCelebratedRef.current = activeLevel.id;
      setModalDismissedForView(false);
      soundFX.playPuzzleSolved();
      try {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.55 },
        });
      } catch {
        // Ignore confetti errors in headless environments
      }
    } else if (!hasWon) {
      solvedCelebratedRef.current = null;
      setModalDismissedForView(false);
    }
  }, [hasWon, isCraneAnimating, activeLevel.id]);

  const handleSelectLevel = useCallback(
    (levelId: string) => {
      setLevel(levelId);
      solvedCelebratedRef.current = null;
      setModalDismissedForView(false);
      setLevelDrawerOpen(false);
    },
    [setLevel]
  );

  const handlePrevLevel = useCallback(() => {
    const idx = PUZZLE_LEVELS.findIndex((l) => l.id === activeLevelId);
    const prev = PUZZLE_LEVELS[(idx - 1 + PUZZLE_LEVELS.length) % PUZZLE_LEVELS.length];
    handleSelectLevel(prev.id);
  }, [activeLevelId, handleSelectLevel]);

  const handleNextLevel = useCallback(() => {
    const idx = PUZZLE_LEVELS.findIndex((l) => l.id === activeLevelId);
    const next = PUZZLE_LEVELS[(idx + 1) % PUZZLE_LEVELS.length];
    handleSelectLevel(next.id);
  }, [activeLevelId, handleSelectLevel]);

  const handleNudgeSelected = useCallback(
    (delta: [number, number, number]) => {
      const targetId = selectedPieceId ?? pieces[0]?.id;
      if (targetId) {
        nudgePiece(targetId, delta);
      }
    },
    [selectedPieceId, pieces, nudgePiece]
  );

  const handleRotateAxis = useCallback(
    (axis: 'x' | 'y' | 'z') => {
      if (!activeSelectedId && pieces.length > 0) {
        selectPiece(pieces[0].id);
      }
      rotateSelectedPiece(axis);
    },
    [activeSelectedId, pieces, selectPiece, rotateSelectedPiece]
  );

  // Keyboard shortcuts for desktop users (including X, Y, C / 1, 2, 3 for 3-axis rotation)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        cycleSelectedPiece();
        return;
      }

      if (e.key === 'x' || e.key === 'X' || e.key === '1') {
        e.preventDefault();
        handleRotateAxis('x');
      } else if (e.key === 'y' || e.key === 'Y' || e.key === '2') {
        e.preventDefault();
        handleRotateAxis('y');
      } else if (e.key === 'c' || e.key === 'C' || e.key === '3') {
        e.preventDefault();
        handleRotateAxis('z');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleNudgeSelected([-1, 0, 0]);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleNudgeSelected([1, 0, 0]);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        handleNudgeSelected([0, 1, 0]);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleNudgeSelected([0, -1, 0]);
      } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        handleNudgeSelected([0, 0, -1]);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        handleNudgeSelected([0, 0, 1]);
      } else if (e.key === 'z' || e.key === 'Z') {
        undo();
      } else if (e.key === 'r' || e.key === 'R') {
        resetLevel();
      } else if (e.key === 'm' || e.key === 'M') {
        soundFX.toggleMute();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycleSelectedPiece, handleRotateAxis, handleNudgeSelected, undo, resetLevel]);

  const sunlitWindows = windowCoordinates.length - winStatus.blockedWindows.length;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#bae6fd] select-none">
      {/* Top Bar — Large, high-visibility touch buttons on mobile + full controls on desktop */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 sm:gap-4 px-2.5 sm:px-5 h-13 sm:h-14 bg-[#090d16]/95 border-b border-slate-800/90 shadow-lg pointer-events-auto">
        {/* Zone 1: Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleSelectLevel(PUZZLE_LEVELS[0].id);
          }}
          className="font-display text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          PrismGrid 3D
        </a>

        {/* Zone 2: High-Visibility 20-Level Navigation + Right-to-Light Telemetry */}
        <nav className="flex items-center gap-1.5 sm:gap-3 text-xs sm:text-sm font-medium text-slate-300 min-w-0">
          <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-700 p-1">
            <button
              type="button"
              data-testid="prev-level-button"
              onClick={handlePrevLevel}
              className="p-1.5 sm:p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white transition-all cursor-pointer"
              title="Previous Level"
            >
              <ChevronLeft className="w-4 h-4 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              data-testid="level-selector-button"
              onClick={() => setLevelDrawerOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-300 font-semibold transition-all cursor-pointer whitespace-nowrap"
              title="Browse all 20 architectural Right-to-Light levels"
            >
              <Grid className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="font-mono-tabular text-xs sm:text-sm font-bold">
                Lvl {activeLevel.number}/{PUZZLE_LEVELS.length}
              </span>
              <span className="hidden lg:inline text-slate-200 font-normal text-xs max-w-[175px] truncate">
                — {activeLevel.title.replace(/^\d+\.\s*/, '')}
              </span>
            </button>

            <button
              type="button"
              data-testid="next-level-nav-button"
              onClick={handleNextLevel}
              className="p-1.5 sm:p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white transition-all cursor-pointer"
              title="Next Level"
            >
              <ChevronRight className="w-4 h-4 sm:w-4 sm:h-4" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 font-mono-tabular text-xs whitespace-nowrap shrink-0 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-slate-200 font-semibold">
              {winStatus.placedPiecesCount}/{winStatus.totalPieces} Stacked
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span
              className={
                winStatus.blockedWindows.length === 0
                  ? 'text-amber-300 font-semibold'
                  : 'text-rose-400 font-bold'
              }
            >
              {winStatus.blockedWindows.length === 0
                ? `${sunlitWindows}/${windowCoordinates.length} Happy`
                : `${winStatus.blockedWindows.length} Angry`}
            </span>
          </div>
        </nav>

        {/* Zone 3: Desktop Shift & 3-Axis Rotation + Always-Visible Audio, Undo & Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Desktop Left / Right / Back / Forward Shift Controls (Shown on sm+ screens; on mobile, large dock at bottom) */}
          <div
            className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded-xl bg-slate-900 border border-slate-700"
            title="Slide selected block Left (-X), Right (+X), Back (-Z), or Forward (+Z) on top of support blocks"
          >
            <button
              type="button"
              data-testid="nudge-left-button"
              onClick={() => handleNudgeSelected([-1, 0, 0])}
              disabled={!activeSelectedId}
              className={`p-1.5 rounded-lg transition-colors ${
                activeSelectedId
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-600 border border-transparent cursor-not-allowed'
              }`}
              title="Slide selected block Left (-X)"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-testid="nudge-right-button"
              onClick={() => handleNudgeSelected([1, 0, 0])}
              disabled={!activeSelectedId}
              className={`p-1.5 rounded-lg transition-colors ${
                activeSelectedId
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-600 border border-transparent cursor-not-allowed'
              }`}
              title="Slide selected block Right (+X)"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-testid="nudge-back-button"
              onClick={() => handleNudgeSelected([0, 0, -1])}
              disabled={!activeSelectedId}
              className={`p-1.5 rounded-lg transition-colors ${
                activeSelectedId
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-600 border border-transparent cursor-not-allowed'
              }`}
              title="Slide selected block Back (-Z)"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-testid="nudge-forward-button"
              onClick={() => handleNudgeSelected([0, 0, 1])}
              disabled={!activeSelectedId}
              className={`p-1.5 rounded-lg transition-colors ${
                activeSelectedId
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-600 border border-transparent cursor-not-allowed'
              }`}
              title="Slide selected block Forward (+Z)"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop 3-Axis Block Rotation Group (Shown on sm+ screens; on mobile, large dock at bottom) */}
          <div
            className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded-xl bg-slate-900 border border-slate-700"
            title="Select a block and rotate it 90° around the X, Y, or Z axis"
          >
            <Rotate3d className="w-4 h-4 text-sky-400 ml-1 mr-0.5" />
            {(['x', 'y', 'z'] as const).map((axis) => (
              <button
                key={`rotate-${axis}`}
                type="button"
                data-testid={`rotate-${axis}-button`}
                onClick={() => handleRotateAxis(axis)}
                disabled={!activeSelectedId}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-tabular font-bold transition-colors whitespace-nowrap ${
                  activeSelectedId
                    ? 'bg-sky-500/25 hover:bg-sky-500/40 text-sky-200 border border-sky-400/50 cursor-pointer'
                    : 'bg-slate-800/50 text-slate-500 border border-transparent cursor-not-allowed'
                }`}
                title={`Rotate selected block 90° around ${axis.toUpperCase()}-axis`}
              >
                Rot {axis.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            data-testid="mute-toggle-button"
            onClick={() => soundFX.toggleMute()}
            aria-label={isMuted ? 'Unmute City & Crane Audio' : 'Mute City & Crane Audio'}
            className={`flex items-center justify-center gap-1.5 min-w-[38px] min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isMuted
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
            }`}
            title={
              isMuted
                ? 'Unmute City Ambience & Crane Audio (Shortcut: M)'
                : 'Mute City Ambience & Crane Audio (Shortcut: M)'
            }
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden md:inline">
              {isMuted ? 'Muted' : 'Audio'}
            </span>
          </button>

          <button
            type="button"
            data-testid="undo-button"
            onClick={undo}
            disabled={history.length === 0}
            className={`flex items-center justify-center gap-1.5 min-w-[38px] min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              history.length > 0
                ? 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-600 cursor-pointer'
                : 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed'
            }`}
            title="Undo last step (Shortcut: Z)"
          >
            <Undo2 className="w-4 h-4" />
            <span className="hidden lg:inline">Undo</span>
          </button>

          <button
            type="button"
            onClick={resetLevel}
            className="flex items-center justify-center gap-1.5 min-w-[38px] min-h-[38px] px-3 py-2 text-xs font-bold text-slate-950 bg-sky-400 rounded-xl hover:bg-sky-300 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-md"
            title="Reset Level (Shortcut: R)"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden lg:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* Mobile Bottom Control Dock — Large, Clear, High-Contrast Touch Buttons for 3-Axis Rotation & Directional Shift */}
      <div className="sm:hidden fixed bottom-2.5 left-2 right-2 z-20 flex flex-col gap-1.5 p-2 rounded-2xl bg-[#090d16]/95 border border-slate-700/90 shadow-2xl pointer-events-auto">
        {/* Top Row of Mobile Dock: Status Badge + Selected Block Hint */}
        <div className="flex items-center justify-between px-1 text-[11px] font-mono-tabular">
          <div className="flex items-center gap-2">
            <span className="text-slate-200 font-semibold">
              {winStatus.placedPiecesCount}/{winStatus.totalPieces} Stacked
            </span>
            <span className="text-slate-600">·</span>
            <span
              className={
                winStatus.blockedWindows.length === 0
                  ? 'text-amber-300 font-semibold'
                  : 'text-rose-400 font-bold'
              }
            >
              {winStatus.blockedWindows.length === 0
                ? `${sunlitWindows}/${windowCoordinates.length} Happy`
                : `${winStatus.blockedWindows.length} Angry`}
            </span>
          </div>
          <button
            type="button"
            onClick={cycleSelectedPiece}
            className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-600 text-sky-300 font-semibold active:scale-95 cursor-pointer"
          >
            {activeSelectedId ? 'Next Block ↻' : 'Select Block'}
          </button>
        </div>

        {/* Bottom Row of Mobile Dock: Large 3-Axis Rotation Buttons + 4-Way Directional Shift Buttons */}
        <div className="grid grid-cols-7 gap-1.5">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <button
              key={`mobile-rotate-${axis}`}
              type="button"
              onClick={() => handleRotateAxis(axis)}
              className={`flex flex-col items-center justify-center min-h-[44px] py-1.5 px-1 rounded-xl font-mono-tabular font-bold text-xs border transition-all active:scale-95 cursor-pointer ${
                activeSelectedId
                  ? 'bg-sky-500/25 text-sky-200 border-sky-400/60 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}
            >
              <span className="text-[10px] text-sky-400 uppercase leading-none mb-0.5">
                Rot
              </span>
              <span className="text-sm font-extrabold leading-none">
                {axis.toUpperCase()}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => handleNudgeSelected([-1, 0, 0])}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
              activeSelectedId
                ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
            aria-label="Slide Block Left"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-[9px] font-bold leading-none mt-0.5">Left</span>
          </button>

          <button
            type="button"
            onClick={() => handleNudgeSelected([1, 0, 0])}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
              activeSelectedId
                ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
            aria-label="Slide Block Right"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="text-[9px] font-bold leading-none mt-0.5">Right</span>
          </button>

          <button
            type="button"
            onClick={() => handleNudgeSelected([0, 0, -1])}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
              activeSelectedId
                ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
            aria-label="Slide Block Back"
          >
            <ArrowUp className="w-5 h-5" />
            <span className="text-[9px] font-bold leading-none mt-0.5">Back</span>
          </button>

          <button
            type="button"
            onClick={() => handleNudgeSelected([0, 0, 1])}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
              activeSelectedId
                ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/60'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
            aria-label="Slide Block Forward"
          >
            <ArrowDown className="w-5 h-5" />
            <span className="text-[9px] font-bold leading-none mt-0.5">Front</span>
          </button>
        </div>
      </div>

      {/* 20-Level Selection Modal Drawer */}
      {levelDrawerOpen && (
        <div
          data-testid="level-drawer-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Select Level"
          className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-black/75 pointer-events-auto"
          onClick={() => setLevelDrawerOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[85dvh] overflow-y-auto rounded-2xl bg-[#0f172a] border border-slate-700 shadow-2xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
              <div>
                <div className="text-[10px] sm:text-xs font-mono-tabular uppercase tracking-widest text-sky-400 font-semibold">
                  Right to Light Campaign
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                  Select Architectural Level (01 – {PUZZLE_LEVELS.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLevelDrawerOpen(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                aria-label="Close Level Selector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PUZZLE_LEVELS.map((lvl) => {
                const isCurrent = lvl.id === activeLevelId;
                const forwardSlotsCount = lvl.allowedFloorCells.filter(
                  ([, fz]) => fz >= -1
                ).length;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    data-testid={`select-level-${lvl.number}`}
                    onClick={() => handleSelectLevel(lvl.id)}
                    className={`flex flex-col items-start text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-sky-500/20 border-sky-400 text-white shadow-lg'
                        : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono-tabular text-xs font-bold text-sky-400">
                        LVL {lvl.number}
                      </span>
                      <span className="font-mono-tabular text-[10px] text-amber-300">
                        {lvl.pieces.length} Blocks
                      </span>
                    </div>
                    <div className="font-semibold text-xs text-white line-clamp-1">
                      {lvl.title.replace(/^\d+\.\s*/, '')}
                    </div>
                    <div className="mt-1 font-mono-tabular text-[10px] text-slate-400">
                      {forwardSlotsCount} Tower Slots · {lvl.windowCoordinates.length} Balconies
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Level Cleared Overlay Modal when Right to Light Validator Passes AND Block Has Finished Moving */}
      {hasWon && !isCraneAnimating && !modalDismissedForView && (
        <div
          data-testid="level-complete-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="level-complete-title"
          className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-black/75 pointer-events-auto"
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#0f172a] border border-slate-700 shadow-2xl p-4 sm:p-6 text-center">
            <div className="mx-auto mb-2.5 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>

            <div className="text-[10px] sm:text-[11px] font-mono-tabular font-semibold uppercase tracking-widest text-emerald-400 mb-1">
              Right to Light Certified
            </div>
            <h2
              id="level-complete-title"
              className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight"
            >
              Level {activeLevel.number} Cleared
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              {activeLevel.title} — All modular skyscraper units have been oriented and stacked onto the highlighted foundation slots without shading a single neighbor balcony!
            </p>

            {/* Right to Light Summary Metrics */}
            <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 p-2.5 sm:p-3 rounded-xl bg-[#090d16] border border-slate-800 font-mono-tabular">
              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-400">Units Stacked</div>
                <div className="text-xs sm:text-sm font-bold text-emerald-400">
                  {winStatus.placedPiecesCount}/{winStatus.totalPieces}
                </div>
              </div>
              <div className="border-x border-slate-800">
                <div className="text-[10px] sm:text-[11px] text-slate-400">Balconies Lit</div>
                <div className="text-xs sm:text-sm font-bold text-amber-300">
                  {sunlitWindows}/{windowCoordinates.length} Happy
                </div>
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-400">Crane Moves</div>
                <div className="text-xs sm:text-sm font-bold text-sky-400">{movesCount}</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 sm:mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setModalDismissedForView(true)}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-4 h-4" />
                <span>Inspect Tower</span>
              </button>

              <button
                type="button"
                data-testid="next-level-button"
                onClick={handleNextLevel}
                className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Next Level</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unobstructed Full-Viewport 3D Urban Cityscape with Tower Crane, Gardens, Roads, Cars, Clouds & Birds */}
      <main className="w-full h-full pt-13 sm:pt-14 pb-20 sm:pb-0">
        <CubeClusterScene
          pieces={pieces}
          blocks={blocks}
          selectedPieceId={activeSelectedId}
          windowCoordinates={windowCoordinates}
          allowedFloorSet={allowedFloorSet}
          blockedWindowSet={winStatus.blockedWindowSet}
          wallStencils={winStatus.wallStencils}
          floorStencils={winStatus.floorStencils}
          lastCraneTransfer={lastCraneTransfer}
          spacing={0.82}
          themeId={themeId}
          dragPlaneMode={dragPlaneMode}
          activeCameraPreset={activeCameraPreset}
          onUserOrbitStart={() => setActiveCameraPreset(null)}
          onSelectPiece={selectPiece}
          onNudgePiece={nudgePiece}
          onMovePieceTo={movePieceTo}
          onMoveSelectedWithGravity={moveSelectedWithGravity}
          onCraneTransferComplete={() => setCraneAnimating(false)}
        />
      </main>
    </div>
  );
}

