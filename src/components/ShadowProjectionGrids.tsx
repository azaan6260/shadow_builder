import React from 'react';
import { Check, Circle, Diamond, Square, Triangle } from 'lucide-react';
import {
  SilhouetteProfile,
  WallPiece,
  WinCheckResult,
  isPieceInCentralZone,
} from '../types/puzzle';

interface ShadowProjectionGridsProps {
  pieces: WallPiece[];
  selectedPieceId: string | null;
  winStatus: WinCheckResult;
  onSelectPiece: (id: string) => void;
  onAlignCameraToPlane: (plane: 'XY' | 'XZ') => void;
}

const ROWS_TOP_DOWN = [4, 3, 2, 1, 0] as const;
const ROWS_BACK_TO_FRONT = [0, 1, 2, 3, 4] as const;
const COLS_LEFT_TO_RIGHT = [0, 1, 2, 3, 4] as const;

function renderProfileIcon(profile?: SilhouetteProfile, isDarkBg = true) {
  const cls = `w-2.5 h-2.5 ${isDarkBg ? 'text-slate-300' : 'text-slate-700'}`;
  if (profile === 'circle') return <Circle className={cls} />;
  if (profile === 'triangle') return <Triangle className={cls} />;
  if (profile === 'diamond') return <Diamond className={cls} />;
  if (profile === 'rect') return <Square className={cls} />;
  return null;
}

export const ShadowProjectionGrids: React.FC<ShadowProjectionGridsProps> = ({
  pieces,
  selectedPieceId,
  winStatus,
  onSelectPiece,
  onAlignCameraToPlane,
}) => {
  const totalWindows = winStatus.windowCoordinates.length;
  const blockedCount = winStatus.blockedWindows.length;
  const sunlitWindows = totalWindows - blockedCount;

  return (
    <section
      aria-label="Right to Light Window Monitor and Modular Units"
      className="fixed top-16 right-6 z-20 pointer-events-auto flex flex-col gap-2.5 w-80"
    >
      {/* 1. RIGHT TO LIGHT WINDOW & TOWER FOOTPRINT MONITOR */}
      <div className="rounded-xl bg-[#0f172a] border border-slate-800 shadow-2xl p-3">
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/90">
          <h2 className="font-display text-xs font-semibold text-white tracking-wide">
            Right to Light Monitor
          </h2>
          <span
            className={`text-[11px] font-mono-tabular font-semibold ${
              blockedCount === 0 ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {sunlitWindows}/{totalWindows} Windows Lit
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Neighboring Facade Windows (XY Plane) */}
          <div className="flex flex-col items-center bg-[#090d16] rounded-lg p-2 border border-slate-800/90">
            <div className="w-full flex items-center justify-between mb-1.5">
              <button
                type="button"
                onClick={() => onAlignCameraToPlane('XY')}
                className="text-left group cursor-pointer"
                title="Align camera to Neighboring Buildings Facade (XY Plane)"
              >
                <div className="text-[11px] font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                  Neighbor Windows
                </div>
              </button>
              <span
                className={`text-[10px] font-mono-tabular ${
                  blockedCount === 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {blockedCount === 0 ? '0 Blocked' : `${blockedCount} Blocked`}
              </span>
            </div>

            <div
              data-testid="front-shadow-grid"
              className="grid grid-cols-5 gap-1 p-1.5 rounded-md bg-slate-800/80 border border-slate-700"
            >
              {ROWS_TOP_DOWN.map((yIdx) =>
                COLS_LEFT_TO_RIGHT.map((xIdx) => {
                  const cell = winStatus.wallGrid[yIdx][xIdx];
                  const isWindow = Boolean(cell.isWindow);
                  const isBlockedWindow = Boolean(cell.isBlockedWindow);
                  const isClearShadow = cell.current && !isWindow;

                  const bgColor = isBlockedWindow
                    ? '#7f1d1d'
                    : isWindow
                    ? '#fde047'
                    : isClearShadow
                    ? '#0f172a'
                    : '#334155';

                  return (
                    <div
                      key={`wall-${xIdx}-${yIdx}`}
                      data-testid={`front-shadow-cell-${xIdx}-${yIdx}`}
                      style={{ backgroundColor: bgColor }}
                      className={`w-5 h-5 rounded-xs flex items-center justify-center transition-all ${
                        isBlockedWindow
                          ? 'border-2 border-rose-400'
                          : isWindow
                          ? 'border border-amber-200'
                          : isClearShadow
                          ? 'border border-emerald-400'
                          : 'border border-slate-600'
                      }`}
                      title={`Facade (${xIdx - 2}, ${yIdx - 2}) — ${
                        isBlockedWindow
                          ? 'BLOCKED WINDOW (Move tower unit away!)'
                          : isWindow
                          ? 'Sunlit Neighbor Window (Keep clear of shadow)'
                          : isClearShadow
                          ? 'Safe Tower Shadow on Concrete Wall'
                          : 'Slate Concrete Wall'
                      }`}
                    >
                      {isBlockedWindow ? (
                        <span className="text-[9px] font-bold text-rose-200">✕</span>
                      ) : isWindow ? (
                        <span className="w-1.5 h-1.5 rounded-xs bg-amber-950/50" />
                      ) : (
                        cell.current && renderProfileIcon(cell.profile, true)
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-1.5 w-full flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
              <span className="text-amber-300">Lit: {sunlitWindows}</span>
              <span
                className={
                  blockedCount === 0
                    ? 'text-emerald-400'
                    : 'text-rose-400 font-semibold'
                }
              >
                Red: {blockedCount}
              </span>
            </div>
          </div>

          {/* Central Building Zone Floor (XZ Plane) */}
          <div className="flex flex-col items-center bg-[#090d16] rounded-lg p-2 border border-slate-800/90">
            <div className="w-full flex items-center justify-between mb-1.5">
              <button
                type="button"
                onClick={() => onAlignCameraToPlane('XZ')}
                className="text-left group cursor-pointer"
                title="Align camera to Central Building Zone Plan (XZ Plane)"
              >
                <div className="text-[11px] font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                  Central Plot XZ
                </div>
              </button>
              <span className="text-[10px] font-mono-tabular text-sky-400">
                {winStatus.placedPiecesCount}/{winStatus.totalPieces} Stacked
              </span>
            </div>

            <div
              data-testid="side-shadow-grid"
              className="grid grid-cols-5 gap-1 p-1.5 rounded-md bg-slate-800/80 border border-slate-700"
            >
              {ROWS_BACK_TO_FRONT.map((zIdx) =>
                COLS_LEFT_TO_RIGHT.map((xIdx) => {
                  const cell = winStatus.floorGrid[zIdx][xIdx];
                  const hasTower = cell.current;

                  return (
                    <div
                      key={`floor-${xIdx}-${zIdx}`}
                      data-testid={`side-shadow-cell-${xIdx}-${zIdx}`}
                      style={{
                        backgroundColor: hasTower ? '#0f172a' : '#e2e8f0',
                      }}
                      className={`w-5 h-5 rounded-xs flex items-center justify-center transition-all ${
                        hasTower
                          ? 'border border-emerald-400'
                          : 'border border-slate-400'
                      }`}
                      title={`Central Building Plot (${xIdx - 2}, ${zIdx - 2}) — ${
                        hasTower
                          ? 'Modular Unit Stacked Here'
                          : 'Open Central Plot Column'
                      }`}
                    >
                      {hasTower && renderProfileIcon(cell.profile, true)}
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-1.5 w-full flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
              <span>Placed: {winStatus.placedPiecesCount}</span>
              <span
                className={
                  winStatus.unplacedPiecesCount === 0
                    ? 'text-emerald-400'
                    : 'text-amber-300'
                }
              >
                Staging: {winStatus.unplacedPiecesCount}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
          <span>
            Staging Area Remaining: {winStatus.unplacedPiecesCount}
          </span>
          <span
            className={
              winStatus.allBlocksPlaced && blockedCount === 0
                ? 'text-emerald-400 font-semibold'
                : 'text-sky-400'
            }
          >
            {winStatus.allBlocksPlaced && blockedCount === 0
              ? 'Right to Light Met ✓'
              : 'Stack all & clear windows'}
          </span>
        </div>
      </div>

      {/* 2. MODULAR SKYSCRAPER UNITS (Staging Area vs Central Zone Checklist) */}
      <div className="rounded-xl bg-[#0f172a] border border-slate-800 shadow-2xl p-3">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/90">
          <span className="font-display text-xs font-semibold text-slate-200">
            Modular Units (Click for Crane)
          </span>
          <span className="text-[10px] font-mono-tabular text-slate-400">
            Zone · Light
          </span>
        </div>

        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
          {pieces.map((p) => {
            const isSelected = p.id === selectedPieceId;
            const inCentralZone = isPieceInCentralZone(p);
            const blocksWindow =
              inCentralZone &&
              winStatus.windowCoordinateSet.has(
                `${p.position[0]}-${p.position[1]}`
              );
            const unitReady = inCentralZone && !blocksWindow;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPiece(p.id)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-white border border-sky-400'
                    : 'bg-[#090d16] hover:bg-slate-800/70 text-slate-300 border border-slate-800/90'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: p.accentColor }}
                  />
                  <span className="truncate font-medium">{p.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono-tabular text-[10px]">
                  <span
                    className={`px-1.5 py-0.5 rounded-xs ${
                      inCentralZone
                        ? 'text-emerald-300 bg-emerald-500/15'
                        : 'text-amber-300 bg-amber-500/15'
                    }`}
                  >
                    {inCentralZone ? 'Central' : 'Staging'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-xs ${
                      blocksWindow
                        ? 'text-rose-300 bg-rose-500/20 font-semibold'
                        : 'text-emerald-300 bg-emerald-500/15'
                    }`}
                  >
                    {blocksWindow ? 'Blocks Win' : 'Sunlit'}
                  </span>
                  {unitReady && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

