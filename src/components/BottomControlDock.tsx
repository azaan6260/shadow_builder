import React from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Move,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CAMERA_PRESETS,
  CameraPresetId,
  GLASS_THEMES,
  GlassThemeId,
  WallPiece,
} from '../types/puzzle';

interface BottomControlDockProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pieces: WallPiece[];
  selectedPieceId: string | null;
  onSelectPiece: (id: string) => void;
  onNudgeSelected: (delta: [number, number, number]) => void;
  dragPlaneMode: 'XY' | 'XZ';
  onToggleDragPlaneMode: () => void;
  activeCameraPreset: CameraPresetId | null;
  onSelectCameraPreset: (preset: CameraPresetId) => void;
  themeId: GlassThemeId;
  onSelectTheme: (theme: GlassThemeId) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onResetLevel: () => void;
  onUndo: () => void;
  canUndo: boolean;
  historyCount: number;
  lastMoveInfo: string | null;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  isCollapsed,
  onToggleCollapse,
  pieces,
  selectedPieceId,
  onNudgeSelected,
  dragPlaneMode,
  onToggleDragPlaneMode,
  activeCameraPreset,
  onSelectCameraPreset,
  themeId,
  onSelectTheme,
  soundEnabled,
  onToggleSound,
  onResetLevel,
  onUndo,
  canUndo,
  historyCount,
  lastMoveInfo,
}) => {
  const selectedPiece = pieces.find((p) => p.id === selectedPieceId) ?? pieces[0];

  return (
    <div
      className="fixed z-20 pointer-events-auto transition-transform duration-200 ease-out"
      style={{
        bottom: '16px',
        left: '50%',
        transform: `translateX(-50%) translateY(${isCollapsed ? 'calc(100% - 34px)' : '0px'})`,
        width: 'min(940px, 95vw)',
      }}
    >
      {/* Top Collapse / Expand Handle Bar */}
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#0f172a] border border-slate-800 text-xs text-slate-300 font-mono-tabular">
          <span className="text-slate-400">Selected Shape:</span>
          <strong className="text-sky-400">
            {selectedPiece ? selectedPiece.name : 'None'}
          </strong>
          {selectedPiece && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>
                Pos <strong className="text-white">({selectedPiece.position.join(', ')})</strong>
              </span>
            </>
          )}
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400 hidden sm:inline">
            {lastMoveInfo ?? 'Drag shapes in 3D, click 3D arrows, or use WASD + Q/E'}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0f172a] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          title="Toggle HUD Controls (Shortcut: H)"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
              <span>Hide Controls</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Panel */}
      <div className="rounded-xl bg-[#0f172a] border border-slate-800 shadow-2xl p-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Column 1: 3D Shape Directional Nudge Pad (X, Y, Z) (5 cols) */}
          <div className="md:col-span-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Move Selected Shape (X · Y · Z)
              </span>
              <button
                type="button"
                onClick={onToggleDragPlaneMode}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                  dragPlaneMode === 'XY'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                }`}
                title="Switch mouse drag plane between Vertical Wall (XY) and Ground Depth (XZ)"
              >
                <Move className="w-3 h-3" />
                <span>Mouse Drag: {dragPlaneMode === 'XY' ? 'Wall (XY)' : 'Ground (XZ)'}</span>
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              <button
                type="button"
                onClick={() => onNudgeSelected([-1, 0, 0])}
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-sky-300 transition-colors cursor-pointer"
                title="Move Left (-X) [A / Left Arrow]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono-tabular mt-0.5">-X Left</span>
              </button>

              <button
                type="button"
                onClick={() => onNudgeSelected([1, 0, 0])}
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-sky-300 transition-colors cursor-pointer"
                title="Move Right (+X) [D / Right Arrow]"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono-tabular mt-0.5">+X Right</span>
              </button>

              <button
                type="button"
                onClick={() => onNudgeSelected([0, 1, 0])}
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-emerald-300 transition-colors cursor-pointer"
                title="Move Up (+Y on Wall) [W / Up Arrow]"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono-tabular mt-0.5">+Y Up</span>
              </button>

              <button
                type="button"
                onClick={() => onNudgeSelected([0, -1, 0])}
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-emerald-300 transition-colors cursor-pointer"
                title="Move Down (-Y on Wall) [S / Down Arrow]"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono-tabular mt-0.5">-Y Down</span>
              </button>

              <button
                type="button"
                onClick={() => onNudgeSelected([0, 0, -1])}
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-amber-300 transition-colors cursor-pointer"
                title="Move Toward Screen (-Z Depth) [Q]"
              >
                <ArrowUp className="w-3.5 h-3.5 -rotate-45" />
                <span className="text-[10px] font-mono-tabular mt-0.5">-Z Back</span>
              </button>

              <button
                type="button"
                onClick={() => onNudgeSelected([0, 0, 1])}
                className="flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-[#090d16] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-amber-300 transition-colors cursor-pointer"
                title="Move Forward (+Z Depth) [E]"
              >
                <ArrowDown className="w-3.5 h-3.5 -rotate-45" />
                <span className="text-[10px] font-mono-tabular mt-0.5">+Z Front</span>
              </button>
            </div>
          </div>

          {/* Column 2: Isometric & Orthographic Camera Presets (4 cols) */}
          <div className="md:col-span-4 flex flex-col gap-1.5">
            <span className="text-xs text-slate-300 font-medium">
              Camera Views
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {CAMERA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectCameraPreset(preset.id)}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                    activeCameraPreset === preset.id
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'bg-[#090d16] hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column 3: Material Finish & Undo / Reset Actions (3 cols) */}
          <div className="md:col-span-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-1">
              {(Object.keys(GLASS_THEMES) as GlassThemeId[]).map((id) => {
                const t = GLASS_THEMES[id];
                const selected = themeId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectTheme(id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      selected
                        ? 'bg-slate-800 text-white border border-sky-400/60'
                        : 'bg-[#090d16] text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                    title={t.name}
                  >
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: t.swatchHex }}
                    />
                    <span>{t.name.split(' ')[1]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                data-testid="dock-undo-button"
                onClick={onUndo}
                disabled={!canUndo}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                  canUndo
                    ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-700 cursor-pointer'
                    : 'bg-slate-900/50 text-slate-600 border-slate-800/60 cursor-not-allowed'
                }`}
                title="Undo Last Move (Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo{historyCount > 0 ? ` (${historyCount})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={onResetLevel}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer whitespace-nowrap"
                title="Reset all shapes to initial positions"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer shrink-0"
                title={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
                aria-label={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
