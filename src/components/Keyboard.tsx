import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Point } from '../services/GazeTrackerService';
import { Delete, CornerDownLeft, Space } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LAYOUT = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const PREDICTIONS = ['THE', 'BE', 'TO', 'OF', 'AND', 'A', 'IN', 'THAT']; // Dummy prediction bank for now

interface KeyProps {
  id: string;
  label: React.ReactNode;
  width?: string;
  isHovered: boolean;
  progress: number;
}

const Key = ({ id, label, width = 'w-20', className, isHovered, progress, isPrediction }: KeyProps & { className?: string, isPrediction?: boolean }) => {
  if (isPrediction) {
    return (
      <div
        id={`key-${id}`}
        data-key={id}
        className={cn(
          "bg-white/5 border border-white/10 rounded-full px-6 py-2 text-sm cursor-pointer text-white/80 transition-colors relative overflow-hidden flex items-center justify-center font-sans tracking-wide",
          isHovered && "border-[#00d2ff] text-[#00d2ff]",
          className
        )}
      >
        <span className="z-10">{label}</span>
        {isHovered && progress > 0 && (
          <div 
            className="absolute left-0 bottom-0 top-0 bg-[#00d2ff]/20 z-0 transition-none"
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
        "relative flex items-center justify-center rounded-lg transition-all duration-200 font-mono h-full",
        width,
        isHovered 
          ? "bg-[#00d2ff]/10 border border-[#00d2ff]/60 shadow-[0_0_20px_rgba(0,210,255,0.15)] z-20 scale-[1.02]" 
          : "bg-white/5 border border-[#00d2ff]/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10",
        className
      )}
    >
      <span className={cn("text-[24px] z-10", isHovered ? "text-white" : "text-white")}>{label}</span>
      {isHovered && progress > 0 && (
        <div 
          className="absolute bottom-0 left-[17.5%] h-1 bg-[#00d2ff] rounded-b-lg shadow-[0_0_10px_#00d2ff] transition-none z-0"
          style={{ width: `${progress * 65}%` }}
        />
      )}
    </div>
  );
};

interface Props {
  gazePoint: Point;
}

export default function Keyboard({ gazePoint }: Props) {
  const [text, setText] = useState('');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>(PREDICTIONS.slice(0, 5));
  
  const DWELL_TIME = 700; // 700ms
  const hoverStartTimeRef = useRef<number | null>(null);
  const lastHoveredKeyRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Update suggestions based on last word
  useEffect(() => {
    const words = text.split(' ');
    const lastWord = words[words.length - 1].toUpperCase();
    if (lastWord) {
      const matches = PREDICTIONS.filter(p => p.startsWith(lastWord)).slice(0,5);
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
    // Check which key contains the gaze point
    const keys = document.querySelectorAll('[data-key]');
    let foundKey: string | null = null;
    
    if (gazePoint.x > 0 && gazePoint.y > 0) {
      for (const el of Array.from(keys)) {
        const rect = el.getBoundingClientRect();
        // Add a small padding to rect for easier selection
        const padding = 10;
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
        const progress = Math.min(elapsed / DWELL_TIME, 1);
        setDwellProgress(progress);

        if (elapsed >= DWELL_TIME) {
          handleKeyPress(lastHoveredKeyRef.current);
          // Wait a bit before restarting dwell
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
  }, []);

  return (
    <div className="flex-grow flex flex-col p-6 gap-6 select-none w-full max-w-[1200px] mx-auto h-full">
      
      {/* Text Display area */}
      <section className="bg-zinc-900/40 rounded-xl border border-white/5 p-6 shadow-inner flex-grow flex flex-col min-h-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Output Message</div>
        <div className="text-4xl font-light font-mono text-cyan-50/90 leading-relaxed overflow-y-auto min-h-0 flex-grow break-words whitespace-pre-wrap">
          <span className="text-cyan-400 mr-2">|</span>{text}
          <span className="inline-block w-[3px] h-9 align-middle bg-[#00d2ff] ml-1 animate-[pulse_1s_ease-in-out_infinite]"></span>
        </div>
      </section>

      <section className="flex justify-center gap-4 py-2 flex-wrap shrink-0">
        {suggestions.map(word => (
          <Key 
            key={`PRED_${word}`} 
            id={`PRED_${word}`} 
            label={<span className="lowercase">{word}</span>}
            width="w-auto"
            isHovered={hoveredKey === `PRED_${word}`}
            progress={hoveredKey === `PRED_${word}` ? dwellProgress : 0}
            isPrediction={true}
          />
        ))}
      </section>

      <section className="grid gap-3 shrink-0" style={{ gridTemplateRows: 'repeat(4, 80px)' }}>
        {LAYOUT.map((row, i) => (
          <div key={i} className="flex justify-center gap-3">
            {row.map(char => (
              <Key 
                key={char} 
                id={char} 
                label={char} 
                width="w-20"
                isHovered={hoveredKey === char}
                progress={hoveredKey === char ? dwellProgress : 0}
              />
            ))}
            {i === 2 && (
              <Key 
                id="BACKSPACE" 
                label="BKSP"
                width="w-32"
                className="!bg-red-500/10 !border-red-500/20 !text-red-400 text-sm font-bold"
                isHovered={hoveredKey === 'BACKSPACE'}
                progress={hoveredKey === 'BACKSPACE' ? dwellProgress : 0}
              />
            )}
          </div>
        ))}
        
        {/* Bottom Row */}
        <div className="flex justify-center gap-3">
           <Key 
              id="NUM" 
              label="?123"
              width="w-20"
              className="!text-sm !font-bold text-zinc-500"
              isHovered={hoveredKey === 'NUM'}
              progress={hoveredKey === 'NUM' ? dwellProgress : 0}
            />
           <Key 
              id="SPACE" 
              label="SPACE"
              width="w-[450px]"
              className="text-zinc-500 !text-xs tracking-widest"
              isHovered={hoveredKey === 'SPACE'}
              progress={hoveredKey === 'SPACE' ? dwellProgress : 0}
            />
             <Key 
              id="ENTER" 
              label="ENTER"
              width="w-32"
              className="!bg-cyan-500/20 !border-cyan-400 !text-cyan-400 text-sm font-bold"
              isHovered={hoveredKey === 'ENTER'}
              progress={hoveredKey === 'ENTER' ? dwellProgress : 0}
            />
        </div>
      </section>
    </div>
  );
}
