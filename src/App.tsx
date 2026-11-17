/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, Award, CheckCircle2, Eye, RotateCcw, Undo2 } from 'lucide-react';
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
import { soundFX } from './utils/sound';

export default function App() {
  const activeLevelId = usePuzzleStore((s) => s.activeLevelId);
  const pieces = usePuzzleStore((s) => s.pieces);
  const blocks = usePuzzleStore((s) => s.blocks);
  const windowCoordinates = usePuzzleStore((s) => s.windowCoordinates);
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
  const selectPiece = usePuzzleStore((s) => s.selectPiece);
  const cycleSelectedPiece = usePuzzleStore((s) => s.cycleSelectedPiece);
  const moveSelectedWithGravity = usePuzzleStore((s) => s.moveSelectedWithGravity);
  const nudgePiece = usePuzzleStore((s) => s.nudgePiece);
  const movePieceTo = usePuzzleStore((s) => s.movePieceTo);
  const resetLevel = usePuzzleStore((s) => s.resetLevel);
  const setLevel = usePuzzleStore((s) => s.setLevel);
  const undo = usePuzzleStore((s) => s.undo);

  const [modalDismissedForView, setModalDismissedForView] = useState<boolean>(false);
  const [themeId] = useState<GlassThemeId>('cyan');
  const [dragPlaneMode] = useState<'XY' | 'XZ'>('XY');
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPresetId | null>('iso-ne');

  const solvedCelebratedRef = useRef<string | null>(null);

  const activeLevel = useMemo(
    () => PUZZLE_LEVELS.find((l) => l.id === activeLevelId) ?? PUZZLE_LEVELS[0],
    [activeLevelId]
  );

  // Evaluate Right to Light balcony status, staging area placement, and 60° sun shadow projections
  const winStatus = useMemo(
    () => checkWinCondition(pieces, windowCoordinates),
    [pieces, windowCoordinates]
  );

  // Phase 16: The "Right to Light" Analytical Win Condition (60° Single Sun + Balcony Residents)
  // 1. Traces the 60-degree Sun ray from each Neighboring Building balcony through the Central Zone blocks.
  // 2. Checks if any balcony resident is cast into shadow (making them angry).
  // 3. Triggers the Win State when:
  //    (a) All blocks from the staging area have been stacked in the central building zone, AND
  //    (b) Zero balconies on the neighboring buildings are shaded (0 angry residents).
  useEffect(() => {
    const visibleBlocks = blocks.filter((block) => block.visible === true);
    const centralZoneBlocks = visibleBlocks.filter(
      (block) => block.z >= -2 && block.z <= 2
    );

    // 1. Check if the 60° Sun shadow from any central zone block hits any balcony resident
    const shadedBalconies = windowCoordinates.filter(([wx, wy]) =>
      isBalconyShadedByBlocks(wx, wy, centralZoneBlocks, LIGHT_POSITION)
    );
    const zeroBalconiesShaded = shadedBalconies.length === 0;

    // 2. Staging Area Check: Have all modular blocks been moved into the central building zone?
    const allBlocksStackedInCentralZone =
      pieces.length > 0 && pieces.every((piece) => isPieceInCentralZone(piece));

    // Also compute 60° angled floor projection
    projectAngledShadow(centralZoneBlocks, LIGHT_POSITION);

    const matchedRightToLightWin =
      allBlocksStackedInCentralZone && zeroBalconiesShaded && winStatus.isWin;

    setHasWon(matchedRightToLightWin);
  }, [
    blocks,
    pieces,
    windowCoordinates,
    targetShadow,
    targetWallShape,
    targetFloorShape,
    winStatus.isWin,
    setHasWon,
  ]);

  // Trigger celebration when hasWon becomes true
  useEffect(() => {
    if (hasWon && solvedCelebratedRef.current !== activeLevel.id) {
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
  }, [hasWon, activeLevel.id]);

  const handleSelectLevel = useCallback(
    (levelId: string) => {
      setLevel(levelId);
      solvedCelebratedRef.current = null;
      setModalDismissedForView(false);
    },
    [setLevel]
  );

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

  // Keyboard shortcuts remain available for desktop users without any visible control overlay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        cycleSelectedPiece();
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
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
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycleSelectedPiece, handleNudgeSelected, undo, resetLevel]);

  const sunlitWindows = windowCoordinates.length - winStatus.blockedWindows.length;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#e2e8f0] select-none">
      {/* Slim, Mobile & Screen-Rotation Friendly Top Bar — Zero Floating Control Panels Over the 3D Canvas */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 sm:gap-6 px-3 sm:px-6 h-11 sm:h-12 bg-[#090d16]/95 border-b border-slate-800/80 pointer-events-auto">
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

        {/* Zone 2: Responsive Level Links + Quiet Inline Right-to-Light Telemetry */}
        <nav className="flex items-center gap-2.5 sm:gap-5 text-xs sm:text-sm font-medium text-slate-400 min-w-0 overflow-x-auto">
          {PUZZLE_LEVELS.map((lvl) => {
            const isCurrent = activeLevelId === lvl.id;
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => handleSelectLevel(lvl.id)}
                className={`py-1 px-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 underline-offset-4 ${
                  isCurrent
                    ? 'text-sky-400 underline decoration-sky-400 decoration-2 font-semibold'
                    : 'hover:text-slate-100'
                }`}
              >
                <span className="sm:hidden">L{lvl.number}</span>
                <span className="hidden sm:inline">Level {lvl.number}</span>
              </button>
            );
          })}

          <span aria-hidden="true" className="text-slate-700 hidden xs:inline">
            ·
          </span>

          <div className="hidden xs:flex items-center gap-1.5 font-mono-tabular text-[11px] sm:text-xs whitespace-nowrap shrink-0">
            <span className="text-slate-300">
              {winStatus.placedPiecesCount}/{winStatus.totalPieces} Stacked
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span
              className={
                winStatus.blockedWindows.length === 0
                  ? 'text-amber-300'
                  : 'text-rose-400 font-semibold'
              }
            >
              {winStatus.blockedWindows.length === 0
                ? `${sunlitWindows}/${windowCoordinates.length} Happy`
                : `${winStatus.blockedWindows.length} Angry`}
            </span>
          </div>
        </nav>

        {/* Zone 3: Compact Undo & Reset Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            data-testid="undo-button"
            onClick={undo}
            disabled={history.length === 0}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
              history.length > 0
                ? 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700 cursor-pointer'
                : 'bg-slate-900/50 text-slate-600 border-slate-800/60 cursor-not-allowed'
            }`}
            title="Undo last step (Shortcut: Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>

          <button
            type="button"
            onClick={resetLevel}
            className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 rounded-lg hover:bg-sky-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Reset Level (Shortcut: R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* Level Cleared Overlay Modal when Right to Light Validator Passes */}
      {hasWon && !modalDismissedForView && (
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
              Level Cleared
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              {activeLevel.title} — All modular skyscraper units from the staging area have been stacked by the Tower Crane and every neighboring balcony resident is enjoying the 60° sun!
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
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Inspect Tower</span>
              </button>

              <button
                type="button"
                data-testid="next-level-button"
                onClick={handleNextLevel}
                className="flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Next Level</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unobstructed Full-Viewport 3D Urban Cityscape with Gantry Crane & Neighboring Building Windows */}
      <main className="w-full h-full pt-11 sm:pt-12">
        <CubeClusterScene
          pieces={pieces}
          blocks={blocks}
          selectedPieceId={selectedBlockId ?? selectedPieceId}
          windowCoordinates={windowCoordinates}
          blockedWindowSet={winStatus.blockedWindowSet}
          wallStencils={winStatus.wallStencils}
          floorStencils={winStatus.floorStencils}
          lastCraneTransfer={lastCraneTransfer}
          spacing={1.06}
          themeId={themeId}
          dragPlaneMode={dragPlaneMode}
          activeCameraPreset={activeCameraPreset}
          onUserOrbitStart={() => setActiveCameraPreset(null)}
          onSelectPiece={selectPiece}
          onNudgePiece={nudgePiece}
          onMovePieceTo={movePieceTo}
          onMoveSelectedWithGravity={moveSelectedWithGravity}
        />
      </main>
    </div>
  );
}
