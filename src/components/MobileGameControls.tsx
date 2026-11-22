import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Rotate3d,
} from 'lucide-react';

type MoveDirection = 'left' | 'right' | 'up' | 'down' | null;

const DIRECTION_DELTAS: Record<
  Exclude<MoveDirection, null>,
  [number, number, number]
> = {
  left: [-1, 0, 0],
  right: [1, 0, 0],
  up: [0, 0, -1],
  down: [0, 0, 1],
};

interface MobileGameControlsProps {
  hasSelectedBlock: boolean;
  onMove: (delta: [number, number, number]) => void;
  onRotate: (axis: 'x' | 'y' | 'z') => void;
}

const JOYSTICK_MAX_RADIUS = 32;
const JOYSTICK_DEADZONE = 14;
const REPEAT_INITIAL_DELAY_MS = 320;
const REPEAT_INTERVAL_MS = 230;

export const MobileGameControls: React.FC<MobileGameControlsProps> = ({
  hasSelectedBlock,
  onMove,
  onRotate,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const activeDirRef = useRef<MoveDirection>(null);
  const initialDelayTimerRef = useRef<number | null>(null);
  const repeatTimerRef = useRef<number | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const [activeDir, setActiveDir] = useState<MoveDirection>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const setKnobPosition = useCallback((x: number, y: number) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }, []);

  const clearRepeatTimers = useCallback(() => {
    if (initialDelayTimerRef.current !== null) {
      window.clearTimeout(initialDelayTimerRef.current);
      initialDelayTimerRef.current = null;
    }
    if (repeatTimerRef.current !== null) {
      window.clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearRepeatTimers();
    };
  }, [clearRepeatTimers]);

  const startDirectionTrigger = useCallback(
    (dir: MoveDirection) => {
      if (dir === activeDirRef.current) return;
      activeDirRef.current = dir;
      setActiveDir(dir);
      clearRepeatTimers();

      if (!dir) return;

      // Fire immediately on entering a cardinal direction
      onMoveRef.current(DIRECTION_DELTAS[dir]);

      // Repeat smoothly if the player holds the joystick pushed in that direction
      initialDelayTimerRef.current = window.setTimeout(() => {
        repeatTimerRef.current = window.setInterval(() => {
          const current = activeDirRef.current;
          if (current) {
            onMoveRef.current(DIRECTION_DELTAS[current]);
          }
        }, REPEAT_INTERVAL_MS);
      }, REPEAT_INITIAL_DELAY_MS);
    },
    [clearRepeatTimers]
  );

  const updateJoystickFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.5;
      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const dist = Math.hypot(rawDx, rawDy);

      // Clamp visual thumbstick knob within the circular track at 60fps without React re-renders
      const clampedDist = Math.min(dist, JOYSTICK_MAX_RADIUS);
      const angle = Math.atan2(rawDy, rawDx);
      const kx = dist > 0.001 ? Math.cos(angle) * clampedDist : 0;
      const ky = dist > 0.001 ? Math.sin(angle) * clampedDist : 0;
      setKnobPosition(kx, ky);

      if (dist < JOYSTICK_DEADZONE) {
        startDirectionTrigger(null);
        return;
      }

      // Snap to dominant cardinal axis (left, right, up, down)
      let dir: MoveDirection;
      if (Math.abs(rawDx) >= Math.abs(rawDy)) {
        dir = rawDx < 0 ? 'left' : 'right';
      } else {
        dir = rawDy < 0 ? 'up' : 'down';
      }
      startDirectionTrigger(dir);
    },
    [setKnobPosition, startDirectionTrigger]
  );

  const resetJoystick = useCallback(() => {
    activePointerIdRef.current = null;
    setIsDragging(false);
    setKnobPosition(0, 0);
    startDirectionTrigger(null);
  }, [setKnobPosition, startDirectionTrigger]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateJoystickFromClientPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystickFromClientPoint(e.clientX, e.clientY);
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resetJoystick();
  };

  return (
    <>
      {/* Bottom-Left Corner: Round Directional Move Joystick (Drag or Tap Up / Down / Left / Right) */}
      <div className="sm:hidden fixed bottom-4 left-3 z-20 pb-[env(safe-area-inset-bottom,0px)] pointer-events-auto select-none">
        <div
          ref={padRef}
          data-testid="mobile-move-joystick"
          role="application"
          aria-label="Move block joystick: drag or tap up, down, left, or right"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          className={`relative w-[132px] h-[132px] rounded-full touch-none bg-[#090d16]/85 backdrop-blur-md border-2 shadow-[0_10px_28px_rgba(0,0,0,0.55)] transition-colors ${
            hasSelectedBlock
              ? 'border-emerald-400/55'
              : 'border-slate-700/90'
          }`}
        >
          {/* Subtle inner circular track guide */}
          <div className="pointer-events-none absolute inset-3 rounded-full border border-slate-700/60 bg-slate-900/50" />

          {/* Cardinal Direction Arrows (Up / Down / Left / Right) */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 transition-transform duration-100 ${
              activeDir === 'up'
                ? 'text-emerald-300 scale-125'
                : hasSelectedBlock
                ? 'text-emerald-400/80'
                : 'text-slate-500'
            }`}
          >
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 transition-transform duration-100 ${
              activeDir === 'down'
                ? 'text-emerald-300 scale-125'
                : hasSelectedBlock
                ? 'text-emerald-400/80'
                : 'text-slate-500'
            }`}
          >
            <ArrowDown className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 transition-transform duration-100 ${
              activeDir === 'left'
                ? 'text-emerald-300 scale-125'
                : hasSelectedBlock
                ? 'text-emerald-400/80'
                : 'text-slate-500'
            }`}
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 transition-transform duration-100 ${
              activeDir === 'right'
                ? 'text-emerald-300 scale-125'
                : hasSelectedBlock
                ? 'text-emerald-400/80'
                : 'text-slate-500'
            }`}
          >
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </div>

          {/* Draggable Circular Thumbstick Knob */}
          <div
            ref={knobRef}
            aria-hidden="true"
            className={`pointer-events-none absolute top-1/2 left-1/2 -ml-6 -mt-6 w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg ${
              isDragging
                ? 'transition-none'
                : 'transition-transform duration-150 ease-out'
            } ${
              activeDir
                ? 'bg-emerald-500/35 border-emerald-300 shadow-emerald-500/30'
                : hasSelectedBlock
                ? 'bg-slate-800/95 border-emerald-400/70'
                : 'bg-slate-800/90 border-slate-600'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full ${
                activeDir
                  ? 'bg-emerald-300'
                  : hasSelectedBlock
                  ? 'bg-emerald-400/70'
                  : 'bg-slate-500/70'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Bottom-Right Corner: Round 3-Axis Rotate Wheel (Y / X / Z Radial Buttons) */}
      <div className="sm:hidden fixed bottom-4 right-3 z-20 pb-[env(safe-area-inset-bottom,0px)] pointer-events-auto select-none">
        <div
          data-testid="mobile-rotate-wheel"
          role="group"
          aria-label="Rotate block controls"
          className={`relative w-[132px] h-[132px] rounded-full bg-[#090d16]/85 backdrop-blur-md border-2 shadow-[0_10px_28px_rgba(0,0,0,0.55)] transition-colors ${
            hasSelectedBlock ? 'border-sky-400/55' : 'border-slate-700/90'
          }`}
        >
          {/* Center Rotate Emblem */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          >
            <Rotate3d
              className={`w-5 h-5 ${
                hasSelectedBlock ? 'text-sky-400/90' : 'text-slate-600'
              }`}
            />
          </div>

          {/* Top (12 o'clock): Rotate Y */}
          <button
            type="button"
            data-testid="mobile-rotate-y-button"
            onClick={() => onRotate('y')}
            aria-label="Rotate block around Y axis"
            className={`absolute top-1.5 left-1/2 -translate-x-1/2 w-[46px] h-[46px] rounded-full flex flex-col items-center justify-center font-mono-tabular border transition-all active:scale-90 cursor-pointer ${
              hasSelectedBlock
                ? 'bg-sky-500/25 hover:bg-sky-500/35 text-sky-100 border-sky-400/70 shadow-sm'
                : 'bg-slate-800/85 text-slate-300 border-slate-700'
            }`}
          >
            <span className="text-[9px] text-sky-300 leading-none">Rot</span>
            <span className="text-sm font-extrabold leading-tight">Y</span>
          </button>

          {/* Bottom-Left (8 o'clock): Rotate X */}
          <button
            type="button"
            data-testid="mobile-rotate-x-button"
            onClick={() => onRotate('x')}
            aria-label="Rotate block around X axis"
            className={`absolute bottom-3 left-2 w-[46px] h-[46px] rounded-full flex flex-col items-center justify-center font-mono-tabular border transition-all active:scale-90 cursor-pointer ${
              hasSelectedBlock
                ? 'bg-sky-500/25 hover:bg-sky-500/35 text-sky-100 border-sky-400/70 shadow-sm'
                : 'bg-slate-800/85 text-slate-300 border-slate-700'
            }`}
          >
            <span className="text-[9px] text-sky-300 leading-none">Rot</span>
            <span className="text-sm font-extrabold leading-tight">X</span>
          </button>

          {/* Bottom-Right (4 o'clock): Rotate Z */}
          <button
            type="button"
            data-testid="mobile-rotate-z-button"
            onClick={() => onRotate('z')}
            aria-label="Rotate block around Z axis"
            className={`absolute bottom-3 right-2 w-[46px] h-[46px] rounded-full flex flex-col items-center justify-center font-mono-tabular border transition-all active:scale-90 cursor-pointer ${
              hasSelectedBlock
                ? 'bg-sky-500/25 hover:bg-sky-500/35 text-sky-100 border-sky-400/70 shadow-sm'
                : 'bg-slate-800/85 text-slate-300 border-slate-700'
            }`}
          >
            <span className="text-[9px] text-sky-300 leading-none">Rot</span>
            <span className="text-sm font-extrabold leading-tight">Z</span>
          </button>
        </div>
      </div>
    </>
  );
};
