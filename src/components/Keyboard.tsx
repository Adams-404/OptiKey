import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Point } from '../services/GazeTrackerService';
import { Delete, CornerDownLeft, Space, RefreshCw, LayoutGrid } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const QWERTY_LAYOUT = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const QUADRANT_PAGES = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'G', 'H'],
  ['I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P'],
  ['Q', 'R', 'S', 'T'],
  ['U', 'V', 'W', 'X'],
  ['Y', 'Z', '.', '?'],
];

const PREDICTIONS = ['THE', 'BE', 'TO', 'OF', 'AND', 'A', 'IN', 'THAT', 'HAVE', 'I', 'IT', 'FOR', 'NOT', 'ON', 'WITH', 'HE', 'AS', 'YOU', 'DO', 'AT'];

interface KeyProps {
  key?: React.Key;
  id: string;
  label: React.ReactNode;
  width?: string;
  isHovered: boolean;
  progress: number;
  className?: string;
  isPrediction?: boolean;
}

const Key = ({ id, label, width = 'w-20', className, isHovered, progress, isPrediction }: KeyProps) => {
  if (isPrediction) {
    return (
      <div
        id={`key-${id}`}
        data-key={id}
        className={cn(
          "bg-zinc-900/80 border border-white/10 rounded-full px-6 py-2.5 text-sm cursor-pointer text-zinc-300 transition-all relative overflow-hidden flex items-center justify-center font-sans tracking-wide shadow-md backdrop-blur-sm",
          isHovered && "border-[#00d2ff] text-white shadow-[0_0_15px_rgba(0,210,255,0.4)] scale-105 z-20 bg-zinc-800",
          className
        )}
      >
        <span className="z-10 font-medium">{label}</span>
        {isHovered && progress > 0 && (
          <div 
            className="absolute left-0 bottom-0 top-0 bg-gradient-to-r from-[#00d2ff]/20 to-[#00d2ff]/40 z-0 transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      id={`key-${id}`}
      data-key={id}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl transition-all duration-200 font-mono h-full backdrop-blur-sm",
        width,
        isHovered 
          ? "bg-gradient-to-b from-[#00d2ff]/20 to-[#00d2ff]/40 border-2 border-[#00d2ff] shadow-[0_0_25px_rgba(0,210,255,0.3)] z-20 scale-[1.03]" 
          : "bg-zinc-900/60 border border-white/10 shadow-[0_4_20px_rgba(0,0,0,0.4)] z-10 hover:border-white/20",
        className
      )}
    >
      <span className={cn("z-10 tracking-tight", isHovered ? "text-white font-bold" : "text-zinc-200")}>{label}</span>
      {isHovered && progress > 0 && (
        <div 
          className="absolute bottom-0 left-4 right-4 h-1.5 bg-[#00d2ff] rounded-full shadow-[0_0_12px_#00d2ff] transition-none z-0"
          style={{ width: `calc(${progress * 100}% - 32px)` }}
        />
      )}
    </div>
  );
};

interface Props {
  gazePoint: Point;
  dwellTime?: number;
}

export default function Keyboard({ gazePoint, dwellTime = 700 }: Props) {
  const [text, setText] = useState('');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>(PREDICTIONS.slice(0, 5));
  
  const [layoutMode, setLayoutMode] = useState<'quadrant' | 'qwerty'>('quadrant');
  const [quadrantPage, setQuadrantPage] = useState(0);

  const hoverStartTimeRef = useRef<number | null>(null);
  const lastHoveredKeyRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Update suggestions based on last word
  useEffect(() => {
    const words = text.split(' ');
    const lastWord = words[words.length - 1].toUpperCase();
    if (lastWord) {
      const matches = PREDICTIONS.filter(p => p.startsWith(lastWord) && p !== lastWord).slice(0, 5);
      setSuggestions(matches.length > 0 ? matches : PREDICTIONS.slice(0, 5));
    } else {
      setSuggestions(PREDICTIONS.slice(0, 5));
    }
  }, [text]);

  const handleKeyPress = (keyId: string) => {
    if (keyId === 'BACKSPACE') {
      setText(t => t.slice(0, -1));
    } else if (keyId === 'SPACE') {
      setText(t => t + ' ');
    } else if (keyId === 'ENTER') {
      setText(t => t + '\n');
    } else if (keyId === 'PAGE_NEXT') {
      setQuadrantPage(p => (p + 1) % QUADRANT_PAGES.length);
    } else if (keyId === 'TOGGLE_LAYOUT') {
      setLayoutMode(m => m === 'quadrant' ? 'qwerty' : 'quadrant');
    } else if (keyId.startsWith('PRED_')) {
      const word = keyId.replace('PRED_', '');
      setText(t => {
        const words = t.split(' ');
        words.pop();
        return words.join(' ') + (words.length > 0 ? ' ' : '') + word + ' ';
      });
    } else {
      setText(t => t + keyId);
    }
  };

  useEffect(() => {
    const keys = document.querySelectorAll('[data-key]');
    let foundKey: string | null = null;
    
    if (gazePoint.x > 0 && gazePoint.y > 0) {
      for (const el of Array.from(keys)) {
        const rect = el.getBoundingClientRect();
        // Generous padding for high stability targeting
        const padding = 15;
        if (
          gazePoint.x >= rect.left - padding &&
          gazePoint.x <= rect.right + padding &&
          gazePoint.y >= rect.top - padding &&
          gazePoint.y <= rect.bottom + padding
        ) {
          foundKey = (el as HTMLElement).dataset.key || null;
          break;
        }
      }
    }

    if (foundKey !== lastHoveredKeyRef.current) {
      setHoveredKey(foundKey);
      lastHoveredKeyRef.current = foundKey;
      hoverStartTimeRef.current = foundKey ? performance.now() : null;
      setDwellProgress(0);
    }
  }, [gazePoint]);

  useEffect(() => {
    const checkDwell = (timestamp: number) => {
      if (hoverStartTimeRef.current && lastHoveredKeyRef.current) {
        const elapsed = timestamp - hoverStartTimeRef.current;
        const progress = Math.min(elapsed / dwellTime, 1);
        setDwellProgress(progress);

        if (elapsed >= dwellTime) {
          handleKeyPress(lastHoveredKeyRef.current);
          // 500ms cooldown after triggering
          hoverStartTimeRef.current = timestamp + 500; 
          setDwellProgress(0);
        }
      } else {
        setDwellProgress(0);
      }
      rafRef.current = requestAnimationFrame(checkDwell);
    };
    rafRef.current = requestAnimationFrame(checkDwell);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dwellTime, layoutMode, quadrantPage]);

  const currentPageLetters = QUADRANT_PAGES[quadrantPage];

  return (
    <div className="flex-grow flex flex-col p-6 gap-6 select-none w-full max-w-[1400px] mx-auto h-full justify-between">
      
      {/* Top Header Section */}
      <div className="flex flex-col gap-4 shrink-0">
        {/* Output Message Display area */}
        <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col min-h-[120px] max-h-[160px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-extrabold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> Output Message
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">{text.length} chars</span>
          </div>
          <div className="text-3xl font-mono text-white leading-relaxed overflow-y-auto flex-grow break-words whitespace-pre-wrap">
            {text}
            <span className="inline-block w-3 h-7 align-middle bg-[#00d2ff] ml-1 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_12px_#00d2ff]"></span>
          </div>
        </section>

        {/* Predictive Suggestions Bank */}
        <section className="flex justify-center gap-4 flex-wrap shrink-0">
          {suggestions.map(word => (
            <Key 
              key={`PRED_${word}`} 
              id={`PRED_${word}`} 
              label={<span className="lowercase font-semibold">{word}</span>}
              width="w-auto"
              isHovered={hoveredKey === `PRED_${word}`}
              progress={hoveredKey === `PRED_${word}` ? dwellProgress : 0}
              isPrediction={true}
            />
          ))}
        </section>
      </div>

      {/* Main Keyboard Grid Area */}
      {layoutMode === 'quadrant' ? (
        <section className="flex-grow grid grid-cols-2 grid-rows-2 gap-6 my-2 min-h-[360px]">
          {currentPageLetters.map((char, index) => (
            <div
              key={char}
              id={`key-${char}`}
              data-key={char}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-3xl transition-all duration-300 border backdrop-blur-md shadow-2xl overflow-hidden",
                hoveredKey === char 
                  ? "bg-gradient-to-br from-[#00d2ff]/25 to-[#00d2ff]/45 border-2 border-[#00d2ff] shadow-[0_0_40px_rgba(0,210,255,0.4)] scale-[1.02] z-20" 
                  : "bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border-white/10 hover:border-white/20 z-10 shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
              )}
            >
              <span className="text-8xl font-black tracking-tighter bg-gradient-to-b from-white to-zinc-300 bg-clip-text text-transparent mb-1">
                {char}
              </span>
              <span className="text-xs uppercase font-bold tracking-widest text-cyan-400/80 mt-2">
                Key {index + 1}
              </span>

              {hoveredKey === char && dwellProgress > 0 && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-3 bg-[#00d2ff] shadow-[0_0_20px_#00d2ff] transition-none z-0"
                  style={{ width: `${dwellProgress * 100}%` }}
                />
              )}
            </div>
          ))}
        </section>
      ) : (
        <section className="grid gap-3 shrink-0 my-auto" style={{ gridTemplateRows: 'repeat(4, 75px)' }}>
          {QWERTY_LAYOUT.map((row, i) => (
            <div key={i} className="flex justify-center gap-3">
              {row.map(char => (
                <Key 
                  key={char} 
                  id={char} 
                  label={<span className="text-2xl font-semibold">{char}</span>} 
                  width="w-20"
                  isHovered={hoveredKey === char}
                  progress={hoveredKey === char ? dwellProgress : 0}
                />
              ))}
              {i === 2 && (
                <Key 
                  id="BACKSPACE" 
                  label={<span className="text-sm font-bold flex items-center gap-1"><Delete size={16} /> BKSP</span>}
                  width="w-32"
                  className="!bg-red-500/15 !border-red-500/30 !text-red-400"
                  isHovered={hoveredKey === 'BACKSPACE'}
                  progress={hoveredKey === 'BACKSPACE' ? dwellProgress : 0}
                />
              )}
            </div>
          ))}
          
          {/* Bottom Row */}
          <div className="flex justify-center gap-3">
             <Key 
                id="TOGGLE_LAYOUT" 
                label={<span className="text-xs font-bold flex items-center gap-1.5"><LayoutGrid size={16} /> BIG KEYS</span>}
                width="w-36"
                className="!bg-cyan-500/20 !border-cyan-500/40 !text-cyan-400 font-bold tracking-wider"
                isHovered={hoveredKey === 'TOGGLE_LAYOUT'}
                progress={hoveredKey === 'TOGGLE_LAYOUT' ? dwellProgress : 0}
              />
             <Key 
                id="SPACE" 
                label={<span className="text-xs font-bold tracking-widest flex items-center gap-2"><Space size={16} /> SPACE</span>}
                width="w-[450px]"
                className="text-zinc-300 font-sans tracking-widest"
                isHovered={hoveredKey === 'SPACE'}
                progress={hoveredKey === 'SPACE' ? dwellProgress : 0}
              />
               <Key 
                id="ENTER" 
                label={<span className="text-sm font-bold flex items-center gap-1"><CornerDownLeft size={16} /> ENTER</span>}
                width="w-32"
                className="!bg-cyan-500/20 !border-cyan-400 !text-cyan-400 text-sm font-bold"
                isHovered={hoveredKey === 'ENTER'}
                progress={hoveredKey === 'ENTER' ? dwellProgress : 0}
              />
          </div>
        </section>
      )}

      {/* Persistent Bottom Control Bar */}
      {layoutMode === 'quadrant' && (
        <section className="grid grid-cols-4 gap-4 h-24 shrink-0">
          <Key 
            id="PAGE_NEXT" 
            label={
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg">
                  <RefreshCw size={22} className="animate-spin-slow" /> SWITCH KEYS
                </div>
                <div className="text-[10px] tracking-widest font-mono text-zinc-400 font-semibold uppercase">
                  Group {quadrantPage + 1} of {QUADRANT_PAGES.length}
                </div>
              </div>
            }
            width="w-full"
            className="!bg-cyan-500/15 !border-cyan-500/40 !text-cyan-300 shadow-[0_0_20px_rgba(0,210,255,0.15)]"
            isHovered={hoveredKey === 'PAGE_NEXT'}
            progress={hoveredKey === 'PAGE_NEXT' ? dwellProgress : 0}
          />

          <Key 
            id="SPACE" 
            label={<span className="text-base font-bold tracking-widest flex items-center gap-2"><Space size={20} /> SPACE</span>}
            width="w-full"
            className="!bg-zinc-800/80 !border-white/15 text-white"
            isHovered={hoveredKey === 'SPACE'}
            progress={hoveredKey === 'SPACE' ? dwellProgress : 0}
          />

          <Key 
            id="BACKSPACE" 
            label={<span className="text-base font-bold tracking-wider flex items-center gap-2"><Delete size={20} /> DELETE</span>}
            width="w-full"
            className="!bg-red-500/15 !border-red-500/30 !text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
            isHovered={hoveredKey === 'BACKSPACE'}
            progress={hoveredKey === 'BACKSPACE' ? dwellProgress : 0}
          />

          <Key 
            id="TOGGLE_LAYOUT" 
            label={<span className="text-xs font-bold tracking-wider flex items-center gap-2"><LayoutGrid size={18} /> QWERTY MODE</span>}
            width="w-full"
            className="!bg-zinc-800/80 !border-white/15 text-zinc-300"
            isHovered={hoveredKey === 'TOGGLE_LAYOUT'}
            progress={hoveredKey === 'TOGGLE_LAYOUT' ? dwellProgress : 0}
          />
        </section>
      )}

    </div>
  );
}
