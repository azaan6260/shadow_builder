/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
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
  Star,
  Sun,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  BLOCK_SPACING,
  CameraPresetId,
  GlassThemeId,
  PUZZLE_LEVELS,
  checkWinCondition,
} from './types/puzzle';
import { CubeClusterScene } from './components/CubeClusterScene';
import { MobileGameControls } from './components/MobileGameControls';
import { usePuzzleStore } from './store/usePuzzleStore';
import { mobileBridge } from './utils/capacitorBridge';
import {
  LevelProgressMap,
  calculateStarRating,
  getTotalEarnedStars,
  loadLevelProgress,
  saveLevelCompletion,
} from './utils/progressStorage';
import { soundFX } from './utils/sound';

export default function App() {
  const activeLevelId = usePuzzleStore((s) => s.activeLevelId);
  const pieces = usePuzzleStore((s) => s.pieces);
  const blocks = usePuzzleStore((s) => s.blocks);
  const windowCoordinates = usePuzzleStore((s) => s.windowCoordinates);
  const allowedFloorSet = usePuzzleStore((s) => s.allowedFloorSet);
  const maxHeight = usePuzzleStore((s) => s.maxHeight);
  const maxAllowedShaded = usePuzzleStore((s) => s.maxAllowedShaded);
  const vipBalconies = usePuzzleStore((s) => s.vipBalconies);
  const shadeSeekerBalconies = usePuzzleStore((s) => s.shadeSeekerBalconies);
  const parMoves = usePuzzleStore((s) => s.parMoves);
  const maxMoves = usePuzzleStore((s) => s.maxMoves);
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
  const [showSunRays, setShowSunRays] = useState<boolean>(false);
  const [levelProgress, setLevelProgress] = useState<LevelProgressMap>(() => loadLevelProgress());
  const [themeId] = useState<GlassThemeId>('cyan');
  const [dragPlaneMode] = useState<'XY' | 'XZ'>('XY');
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPresetId | null>('iso-ne');
  const [isMuted, setIsMuted] = useState<boolean>(soundFX.isMuted);

  const solvedCelebratedRef = useRef<string | null>(null);
  const outOfMovesNotifiedRef = useRef<boolean>(false);

  // Safety fallback timer so isCraneAnimating never stays true if a spring animation is interrupted
  useEffect(() => {
    if (!isCraneAnimating || !lastCraneTransfer) return;
    const timer = window.setTimeout(() => {
      setCraneAnimating(false);
    }, 5500);
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

  // Evaluate Right to Light balcony roles (VIP, Shade-Seeker, Ditch Permit), Zoning Height Cap & 40° shadows
  const winStatus = useMemo(
    () =>
      checkWinCondition(pieces, windowCoordinates, allowedFloorSet, {
        maxHeight,
        maxAllowedShaded,
        vipBalconies,
        shadeSeekerBalconies,
      }),
    [
      pieces,
      windowCoordinates,
      allowedFloorSet,
      maxHeight,
      maxAllowedShaded,
      vipBalconies,
      shadeSeekerBalconies,
    ]
  );

  // Synchronize store win flag directly with the unified Batch 1 analytical validator
  useEffect(() => {
    setHasWon(winStatus.isWin);
  }, [winStatus.isWin, setHasWon]);

  const earnedStars = useMemo(
    () =>
      calculateStarRating(
        movesCount,
        parMoves,
        winStatus.shadedRegularBalconies.length,
        maxAllowedShaded
      ),
    [movesCount, parMoves, winStatus.shadedRegularBalconies.length, maxAllowedShaded]
  );

  const totalEarnedStars = useMemo(
    () => getTotalEarnedStars(levelProgress),
    [levelProgress]
  );

  const movesRemaining = Math.max(0, maxMoves - movesCount);
  const isOutOfMoves = !hasWon && !isCraneAnimating && movesCount >= maxMoves;

  // Fire subtle warning haptic once when the player exhausts the level's crane move budget
  useEffect(() => {
    if (isOutOfMoves && !outOfMovesNotifiedRef.current) {
      outOfMovesNotifiedRef.current = true;
      void mobileBridge.notifyWarning();
    } else if (!isOutOfMoves) {
      outOfMovesNotifiedRef.current = false;
    }
  }, [isOutOfMoves]);

  // Trigger celebration, star persistence, haptics, and score modal ONLY after the final crane drop finishes
  useEffect(() => {
    if (hasWon && !isCraneAnimating && solvedCelebratedRef.current !== activeLevel.id) {
      solvedCelebratedRef.current = activeLevel.id;
      setModalDismissedForView(false);
      const updatedProgress = saveLevelCompletion(activeLevel.id, earnedStars, movesCount);
      setLevelProgress(updatedProgress);
      soundFX.playPuzzleSolved();
      void mobileBridge.notifySuccess();
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
  }, [hasWon, isCraneAnimating, activeLevel.id, earnedStars, movesCount]);

  const handleSelectLevel = useCallback(
    (levelId: string) => {
      setLevel(levelId);
      solvedCelebratedRef.current = null;
      outOfMovesNotifiedRef.current = false;
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

  const handleToggleSunRays = useCallback(() => {
    setShowSunRays((prev) => !prev);
    void mobileBridge.impactLight();
  }, []);

  // Keyboard shortcuts for desktop users (including X, Y, C / 1, 2, 3 for 3-axis rotation and V for Sun Rays)
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
      } else if (e.key === 'v' || e.key === 'V') {
        handleToggleSunRays();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    cycleSelectedPiece,
    handleRotateAxis,
    handleNudgeSelected,
    handleToggleSunRays,
    undo,
    resetLevel,
  ]);

  const activeLevelRecord = levelProgress[activeLevel.id];

  // Build concise, high-signal balcony status string & tone for desktop header and mobile status strip
  const balconyRuleStatus = useMemo(() => {
    if (winStatus.shadedVipBalconies.length > 0) {
      return {
        label: `${winStatus.shadedVipBalconies.length} VIP Shaded`,
        shortLabel: `${winStatus.shadedVipBalconies.length} VIP!`,
        className: 'text-rose-400 font-bold',
      };
    }
    if (winStatus.shadedRegularBalconies.length > maxAllowedShaded) {
      const overBy = winStatus.shadedRegularBalconies.length - maxAllowedShaded;
      return {
        label:
          maxAllowedShaded > 0
            ? `Ditch ${winStatus.shadedRegularBalconies.length}/${maxAllowedShaded}`
            : `${overBy} Angry`,
        shortLabel:
          maxAllowedShaded > 0
            ? `Ditch ${winStatus.shadedRegularBalconies.length}/${maxAllowedShaded}`
            : `${overBy} Angry`,
        className: 'text-rose-400 font-bold',
      };
    }
    if (winStatus.unsatisfiedShadeSeekers.length > 0) {
      return {
        label: `Shade ${winStatus.satisfiedShadeSeekers.length}/${shadeSeekerBalconies.length}`,
        shortLabel: `Shade ${winStatus.satisfiedShadeSeekers.length}/${shadeSeekerBalconies.length}`,
        className: 'text-orange-300 font-semibold',
      };
    }
    return {
      label: `${winStatus.happyBalconiesCount}/${windowCoordinates.length} Happy`,
      shortLabel: `${winStatus.happyBalconiesCount}/${windowCoordinates.length} OK`,
      className: 'text-emerald-300 font-semibold',
    };
  }, [
    winStatus.shadedVipBalconies.length,
    winStatus.shadedRegularBalconies.length,
    winStatus.unsatisfiedShadeSeekers.length,
    winStatus.satisfiedShadeSeekers.length,
    winStatus.happyBalconiesCount,
    maxAllowedShaded,
    shadeSeekerBalconies.length,
    windowCoordinates.length,
  ]);

  const movesToneClass =
    movesRemaining === 0
      ? 'text-rose-400 font-bold'
      : movesRemaining <= 5
      ? 'text-amber-300 font-bold'
      : 'text-slate-200 font-semibold';

  const levelClearedSubtitle = useMemo(() => {
    const cleanTitle = activeLevel.title.replace(/^\d+\.\s*/, '');
    const details: string[] = [`under the ${maxHeight}F zoning cap`];
    if (shadeSeekerBalconies.length > 0) {
      details.push(
        `cooled ${shadeSeekerBalconies.length} Shade-Seeker${shadeSeekerBalconies.length > 1 ? 's' : ''}`
      );
    }
    if (vipBalconies.length > 0) {
      details.push(`protected all Gold VIP balconies`);
    }
    if (maxAllowedShaded > 0 && winStatus.shadedRegularBalconies.length > 0) {
      details.push(
        `used ${winStatus.shadedRegularBalconies.length}/${maxAllowedShaded} ditch permit`
      );
    }
    return `${cleanTitle} — Stacked every unit ${details.join(', ')}.`;
  }, [
    activeLevel.title,
    maxHeight,
    shadeSeekerBalconies.length,
    vipBalconies.length,
    maxAllowedShaded,
    winStatus.shadedRegularBalconies.length,
  ]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#bae6fd] select-none">
      {/* Top Bar — Large, high-visibility touch buttons on mobile + full controls on desktop */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-5 h-13 sm:h-14 bg-[#090d16]/95 border-b border-slate-800/90 shadow-lg pointer-events-auto">
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

        {/* Zone 2: High-Visibility 20-Level Navigation + Unboxed Right-to-Light Telemetry */}
        <nav className="flex items-center gap-1.5 sm:gap-3 text-xs sm:text-sm font-medium text-slate-300 min-w-0">
          <div className="flex items-center gap-1 rounded-xl bg-slate-900 border border-slate-700 p-1">
            <button
              type="button"
              data-testid="prev-level-button"
              onClick={handlePrevLevel}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white transition-all cursor-pointer"
              title="Previous Level"
            >
              <ChevronLeft className="w-4 h-4" />
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
              <span className="hidden xl:inline text-slate-200 font-normal text-xs max-w-[155px] truncate">
                — {activeLevel.title.replace(/^\d+\.\s*/, '')}
              </span>
            </button>

            <button
              type="button"
              data-testid="next-level-nav-button"
              onClick={handleNextLevel}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white transition-all cursor-pointer"
              title="Next Level"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div
            data-testid="desktop-hud-telemetry"
            className="hidden md:flex items-center gap-2 font-mono-tabular text-xs whitespace-nowrap shrink-0 text-slate-300"
          >
            <span className="text-slate-100 font-semibold">
              {winStatus.placedPiecesCount}/{winStatus.totalPieces} Blks
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className={movesToneClass} title={`Par ${parMoves} moves for 3 stars`}>
              Moves {movesCount}/{maxMoves}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span
              className={
                winStatus.isHeightValid ? 'text-cyan-300 font-semibold' : 'text-rose-400 font-bold'
              }
              title={`Zoning height cap: ${maxHeight} half-story levels`}
            >
              Cap {maxHeight}F
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className={balconyRuleStatus.className}>{balconyRuleStatus.label}</span>
            {maxAllowedShaded > 0 && winStatus.shadedRegularBalconies.length <= maxAllowedShaded && (
              <>
                <span aria-hidden="true" className="text-slate-600 hidden lg:inline">
                  ·
                </span>
                <span
                  className="hidden lg:inline text-amber-300/90 font-medium"
                  title="Permit allows ditching up to 1 regular non-VIP balcony"
                >
                  Ditch {winStatus.shadedRegularBalconies.length}/{maxAllowedShaded}
                </span>
              </>
            )}
          </div>
        </nav>

        {/* Zone 3: Desktop Shift & 3-Axis Rotation + Always-Visible Sun Rays, Audio, Undo & Reset */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Desktop Left / Right / Back / Forward Shift Controls */}
          <div
            className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded-xl bg-slate-900 border border-slate-700"
            title="Slide selected block Left (-X), Right (+X), Back (-Z), or Forward (+Z) on top of support blocks"
          >
            <button
              type="button"
              data-testid="nudge-left-button"
              onClick={() => handleNudgeSelected([-1, 0, 0])}
              disabled={!activeSelectedId || isOutOfMoves}
              className={`p-1.5 rounded-lg transition-colors ${
                activeSelectedId && !isOutOfMoves
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
              disabled={!activeSelectedId || isOutOfMoves}
              className={`p-1.5 rounded-lg transition-colors ${
                activeSelectedId && !isOutOfMoves
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
              disabled={!activeSelectedId || isOutOfMoves}
              className={`p-1.5 rounded-lg transition-colors ${
                activeSelectedId && !isOutOfMoves
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
              disabled={!activeSelectedId || isOutOfMoves}
              className={`p-1.5 rounded-lg transition-colors ${
                activeSelectedId && !isOutOfMoves
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 cursor-pointer'
                  : 'bg-slate-800/40 text-slate-600 border border-transparent cursor-not-allowed'
              }`}
              title="Slide selected block Forward (+Z)"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop 3-Axis Block Rotation Group */}
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
                disabled={!activeSelectedId || isOutOfMoves}
                className={`px-2 py-1 rounded-lg text-xs font-mono-tabular font-bold transition-colors whitespace-nowrap ${
                  activeSelectedId && !isOutOfMoves
                    ? 'bg-sky-500/25 hover:bg-sky-500/40 text-sky-200 border border-sky-400/50 cursor-pointer'
                    : 'bg-slate-800/50 text-slate-500 border border-transparent cursor-not-allowed'
                }`}
                title={`Rotate selected block 90° around ${axis.toUpperCase()}-axis`}
              >
                Rot {axis.toUpperCase()}
              </button>
            ))}
          </div>

          {/* 40° Sun Rays Vision Toggle */}
          <button
            type="button"
            data-testid="sun-rays-toggle-button"
            onClick={handleToggleSunRays}
            aria-pressed={showSunRays}
            aria-label={showSunRays ? 'Hide 40° Sun Rays' : 'Show 40° Sun Rays'}
            className={`flex items-center justify-center gap-1.5 min-w-[38px] min-h-[38px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showSunRays
                ? 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border-amber-400/60'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Toggle 40° Sun Ray Corridors (Shortcut: V)"
          >
            <Sun className={`w-4 h-4 ${showSunRays ? 'text-amber-300' : 'text-slate-400'}`} />
            <span className="hidden xl:inline">Rays</span>
          </button>

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
            <span className="hidden xl:inline">{isMuted ? 'Muted' : 'Audio'}</span>
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
            <span className="hidden xl:inline">Undo</span>
          </button>

          <button
            type="button"
            onClick={resetLevel}
            className="flex items-center justify-center gap-1.5 min-w-[38px] min-h-[38px] px-2.5 sm:px-3 py-2 text-xs font-bold text-slate-950 bg-sky-400 rounded-xl hover:bg-sky-300 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-md"
            title="Reset Level (Shortcut: R)"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden xl:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* Mobile Slim Status Strip directly under Header (Clean unboxed status + Next Block action) */}
      <div className="sm:hidden fixed top-13 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 py-1 bg-[#090d16]/85 backdrop-blur-sm border-b border-slate-800/80 text-[11px] font-mono-tabular pointer-events-auto">
        <div className="flex items-center gap-1.5 whitespace-nowrap overflow-x-auto">
          <span className="text-slate-100 font-semibold">
            {winStatus.placedPiecesCount}/{winStatus.totalPieces}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className={movesToneClass}>
            M {movesCount}/{maxMoves}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className={winStatus.isHeightValid ? 'text-cyan-300' : 'text-rose-400 font-bold'}>
            {maxHeight}F
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className={balconyRuleStatus.className}>{balconyRuleStatus.shortLabel}</span>
          {maxAllowedShaded > 0 && winStatus.shadedRegularBalconies.length <= maxAllowedShaded && (
            <>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-amber-300/90">
                D {winStatus.shadedRegularBalconies.length}/{maxAllowedShaded}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={cycleSelectedPiece}
          className="px-2.5 py-0.5 rounded-lg bg-slate-800/90 border border-slate-600 text-sky-300 font-semibold active:scale-95 transition-transform cursor-pointer whitespace-nowrap shrink-0"
        >
          {activeSelectedId ? 'Next Block' : 'Select Block'}
        </button>
      </div>

      {/* Mobile Dual-Corner Round Controls: Bottom-Left Move Joystick & Bottom-Right Rotate Wheel */}
      <MobileGameControls
        hasSelectedBlock={Boolean(activeSelectedId) && !isOutOfMoves}
        onMove={handleNudgeSelected}
        onRotate={handleRotateAxis}
      />

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
                <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono-tabular uppercase tracking-widest font-semibold">
                  <span className="text-sky-400">Right to Light Campaign</span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {totalEarnedStars} / {PUZZLE_LEVELS.length * 3}
                  </span>
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
                const rec = levelProgress[lvl.id];
                const bestStars = rec?.bestStars ?? 0;
                const rulesSummary: string[] = [];
                if ((lvl.vipBalconies?.length ?? 0) > 0) rulesSummary.push('VIP');
                if ((lvl.shadeSeekerBalconies?.length ?? 0) > 0) rulesSummary.push('Shade');
                const ditchQuota = lvl.maxAllowedShaded ?? 0;
                if (ditchQuota > 0) rulesSummary.push(`${ditchQuota} Ditch`);

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
                      <div className="flex items-center gap-0.5" aria-label={`${bestStars} of 3 stars`}>
                        {[1, 2, 3].map((starIdx) => (
                          <Star
                            key={starIdx}
                            className={`w-3 h-3 ${
                              starIdx <= bestStars
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="font-semibold text-xs text-white line-clamp-1">
                      {lvl.title.replace(/^\d+\.\s*/, '')}
                    </div>
                    <div className="mt-1 font-mono-tabular text-[10px] text-slate-400">
                      Cap {lvl.maxHeight ?? 5}F · Par {lvl.parMoves ?? 20} · {lvl.pieces.length} Blks
                    </div>
                    {rulesSummary.length > 0 && (
                      <div className="mt-0.5 font-mono-tabular text-[10px] text-amber-300/90">
                        {rulesSummary.join(' · ')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Out of Crane Moves Modal */}
      {isOutOfMoves && !levelDrawerOpen && (
        <div
          data-testid="out-of-moves-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="out-of-moves-title"
          className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-black/75 pointer-events-auto"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-rose-500/40 shadow-2xl p-5 sm:p-6 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
            </div>

            <div className="text-[11px] font-mono-tabular font-semibold uppercase tracking-widest text-rose-400 mb-1">
              Crane Budget Exhausted
            </div>
            <h2
              id="out-of-moves-title"
              className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight"
            >
              Out of Crane Moves
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300">
              You used all {maxMoves} crane moves on Level {activeLevel.number}. Undo a step to
              re-route your tower or retry cleanly for 3 stars.
            </p>

            <div className="mt-4 flex items-center justify-center gap-3 font-mono-tabular text-xs text-slate-400">
              <span>
                Stacked {winStatus.placedPiecesCount}/{winStatus.totalPieces}
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>Cap {maxHeight}F</span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className={balconyRuleStatus.className}>{balconyRuleStatus.label}</span>
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                data-testid="out-of-moves-undo-button"
                onClick={undo}
                disabled={history.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                  history.length > 0
                    ? 'text-sky-200 bg-slate-800 hover:bg-slate-700 border-slate-600 cursor-pointer'
                    : 'text-slate-500 bg-slate-900 border-slate-800 cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-4 h-4" />
                <span>Undo Move</span>
              </button>

              <button
                type="button"
                data-testid="out-of-moves-retry-button"
                onClick={resetLevel}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Level</span>
              </button>
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

            {/* 3-Star Performance Rating */}
            <div
              data-testid="level-complete-stars"
              className="flex items-center justify-center gap-2 mb-2"
              aria-label={`Earned ${earnedStars} out of 3 stars`}
            >
              {[1, 2, 3].map((starIdx) => {
                const filled = starIdx <= earnedStars;
                return (
                  <Star
                    key={starIdx}
                    className={`w-7 h-7 sm:w-8 sm:h-8 transition-transform ${
                      filled
                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)] scale-105'
                        : 'text-slate-700'
                    }`}
                  />
                );
              })}
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
            <p className="mt-1 text-xs sm:text-sm text-slate-300">{levelClearedSubtitle}</p>

            {/* Right to Light Summary Metrics */}
            <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 p-2.5 sm:p-3 rounded-xl bg-[#090d16] border border-slate-800 font-mono-tabular">
              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-400">Units / Cap</div>
                <div className="text-xs sm:text-sm font-bold text-emerald-400">
                  {winStatus.placedPiecesCount}/{winStatus.totalPieces} · {maxHeight}F
                </div>
              </div>
              <div className="border-x border-slate-800">
                <div className="text-[10px] sm:text-[11px] text-slate-400">Balconies</div>
                <div className="text-xs sm:text-sm font-bold text-amber-300">
                  {winStatus.happyBalconiesCount}/{windowCoordinates.length} Happy
                </div>
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] text-slate-400">Moves / Par</div>
                <div className="text-xs sm:text-sm font-bold text-sky-400">
                  {movesCount} / {parMoves}
                </div>
              </div>
            </div>

            {activeLevelRecord && (
              <div className="mt-2.5 font-mono-tabular text-[11px] text-slate-400">
                Best: {activeLevelRecord.bestStars}★ · {activeLevelRecord.bestMoves} Moves
                {earnedStars < 3 ? ` · Beat ${parMoves} moves for 3★` : ' · Master Architect!'}
              </div>
            )}

            {/* Modal Actions */}
            <div className="mt-4 sm:mt-5 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setModalDismissedForView(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-4 h-4" />
                <span>Inspect</span>
              </button>

              {earnedStars < 3 && (
                <button
                  type="button"
                  onClick={resetLevel}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-amber-200 bg-slate-800 hover:bg-slate-700 border border-amber-400/40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Replay</span>
                </button>
              )}

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
      <main className="w-full h-full pt-13 sm:pt-14">
        <CubeClusterScene
          pieces={pieces}
          blocks={blocks}
          selectedPieceId={activeSelectedId}
          windowCoordinates={windowCoordinates}
          allowedFloorSet={allowedFloorSet}
          blockedWindowSet={winStatus.blockedWindowSet}
          angryBalconySet={winStatus.angryBalconySet}
          vipBalconySet={winStatus.vipBalconySet}
          shadeSeekerSet={winStatus.shadeSeekerSet}
          maxHeight={maxHeight}
          showSunRays={showSunRays}
          wallStencils={winStatus.wallStencils}
          floorStencils={winStatus.floorStencils}
          lastCraneTransfer={lastCraneTransfer}
          spacing={BLOCK_SPACING}
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


