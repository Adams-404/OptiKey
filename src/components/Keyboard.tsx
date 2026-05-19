import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Point } from '../services/GazeTrackerService';
import { AutocompleteService } from '../services/AutocompleteService';
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


interface KeyProps {
  key?: React.Key;
  id: string;
  label: React.ReactNode;
  width?: string;
  isHovered: boolean;
  progress: number;
  className?: string;
  isPrediction?: boolean;
  onClick?: () => void;
}

const Key = ({ id, label, width = 'w-20', className, isHovered, progress, isPrediction, onClick }: KeyProps) => {
  if (isPrediction) {
    return (
      <div
        id={`key-${id}`}
        data-key={id}
        onClick={onClick}
        className={cn(
          "bg-zinc-900/80 border border-white/10 rounded-full px-6 py-2.5 text-sm cursor-pointer text-zinc-300 transition-all relative overflow-hidden flex items-center justify-center font-sans tracking-wide shadow-md backdrop-blur-sm select-none",
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
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl transition-all duration-200 font-mono h-full backdrop-blur-sm cursor-pointer select-none",
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
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [groqKey, setGroqKey] = useState<string>(() => {
    return ((import.meta as any).env?.VITE_GROQ_API_KEY as string) || 
           localStorage.getItem('groq_api_key') || 
           '';
  });
  const [isLlmActive, setIsLlmActive] = useState<boolean>(false);
  
  const [layoutMode, setLayoutMode] = useState<'quadrant' | 'qwerty'>('qwerty');
  const [quadrantPage, setQuadrantPage] = useState(0);

  const hoverStartTimeRef = useRef<number | null>(null);
  const lastHoveredKeyRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const autoTypeQueueRef = useRef<string[]>([]);
  const isAutoTypingRef = useRef<boolean>(false);

  const processNextAutoChar = () => {
    if (autoTypeQueueRef.current.length === 0) {
      isAutoTypingRef.current = false;
      return;
    }

    isAutoTypingRef.current = true;
    const char = autoTypeQueueRef.current.shift()!;
    const keyId = char === ' ' ? 'SPACE' : char;

    const el = document.getElementById('key-' + keyId);
    if (!el) {
      // If the target key is not rendered or doesn't exist, type it instantly
      handleKeyPress(keyId);
      setTimeout(processNextAutoChar, 200);
      return;
    }

    const rect = el.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    // Glide animation from current mouse coordinates to key center
    const startX = gazePoint.x > 0 ? gazePoint.x : window.innerWidth / 2;
    const startY = gazePoint.y > 0 ? gazePoint.y : window.innerHeight / 2;
    const glideDuration = 850; // Slower, more natural human-eye search speed (850ms)
    const startTime = performance.now();

    // Random organic curve vectors to prevent straight programmatic lines
    const curveAmpX = (Math.random() - 0.5) * 60; // Curved offset up to 60px
    const curveAmpY = (Math.random() - 0.5) * 60;

    const animateGlide = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / glideDuration, 1);
      
      // Decelerating easeOutCubic curve for organic glide
      const ease = 1 - Math.pow(1 - progress, 3);

      let currentX = startX + (targetX - startX) * ease;
      let currentY = startY + (targetY - startY) * ease;

      // Add elegant curving Bezier drift peaking in the middle of the transition
      const curveFactor = Math.sin(progress * Math.PI);
      currentX += curveAmpX * curveFactor;
      currentY += curveAmpY * curveFactor;

      // Add natural high-frequency micro-saccadic eye jitter
      const jitterX = (Math.random() - 0.5) * 14 * (1 - progress * 0.4);
      const jitterY = (Math.random() - 0.5) * 14 * (1 - progress * 0.4);
      currentX += jitterX;
      currentY += jitterY;

      window.dispatchEvent(new CustomEvent('simulated-gaze', { detail: { x: currentX, y: currentY } }));

      if (progress < 1) {
        requestAnimationFrame(animateGlide);
      } else {
        // Human hesitation delay (250ms) before brain registers the target and starts dwelling
        setTimeout(animateDwell, 250);
      }
    };

    const animateDwell = () => {
      setHoveredKey(keyId);
      const dwellStartTime = performance.now();

      const runDwell = (now: number) => {
        const elapsed = now - dwellStartTime;
        const progress = Math.min(elapsed / dwellTime, 1);
        setDwellProgress(progress);

        // While dwelling, maintain a tight organic gaze tremor (8px noise cluster)
        const microJitterX = targetX + (Math.random() - 0.5) * 8;
        const microJitterY = targetY + (Math.random() - 0.5) * 8;
        window.dispatchEvent(new CustomEvent('simulated-gaze', { detail: { x: microJitterX, y: microJitterY } }));

        if (elapsed < dwellTime) {
          requestAnimationFrame(runDwell);
        } else {
          // Fire simulated key press
          handleKeyPress(keyId);
          setHoveredKey(null);
          setDwellProgress(0);
          
          // Wait 350ms after typing (human eye saccade transition delay) before moving to the next character
          setTimeout(processNextAutoChar, 350);
        }
      };

      requestAnimationFrame(runDwell);
    };

    requestAnimationFrame(animateGlide);
  };

  const startAutoTyping = (fullText: string) => {
    if (fullText === '') {
      setText('');
      return;
    }

    const chars = fullText.toUpperCase().split('');
    autoTypeQueueRef.current = [...autoTypeQueueRef.current, ...chars];
    
    if (!isAutoTypingRef.current) {
      processNextAutoChar();
    }
  };

  // Update suggestions based on text and Groq API Key
  useEffect(() => {
    let active = true;
    let debounceTimer: NodeJS.Timeout | null = null;

    const fetchPredictions = async () => {
      const localPredictions = AutocompleteService.getPredictions(text);
      
      if (!text.trim()) {
        if (active) setSuggestions(localPredictions);
        setIsLlmActive(false);
        return;
      }

      // Groq LLM is only queried if:
      // 1. Groq API Key is present
      // 2. The user completed a word (text ends with a space)
      if (groqKey && text.endsWith(' ')) {
        setIsLlmActive(true);
        
        // Debounce calls by 250ms to prevent spamming the API when spacing/typing quickly
        debounceTimer = setTimeout(async () => {
          const onlinePredictions = await AutocompleteService.queryGroqPrediction(text, groqKey);
          
          if (active) {
            if (onlinePredictions.length > 0) {
              setSuggestions(onlinePredictions);
            } else {
              setSuggestions(localPredictions);
              setIsLlmActive(false);
            }
          }
        }, 250);
      } else {
        if (active) {
          setSuggestions(localPredictions);
          setIsLlmActive(false);
        }
      }
    };

    fetchPredictions();

    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [text, groqKey]);

  // Listener for Wizard of Oz remote control events
  useEffect(() => {
    const handleRemoteClick = (e: Event) => {
      const keyId = (e as CustomEvent).detail.keyId;
      if (keyId === 'TRIGGER_DWELL') {
        if (lastHoveredKeyRef.current) {
          handleKeyPress(lastHoveredKeyRef.current);
        }
      } else {
        handleKeyPress(keyId);
      }
    };

    const handleRemoteType = (e: Event) => {
      const newText = (e as CustomEvent).detail.text;
      startAutoTyping(newText);
    };

    window.addEventListener('remote-click', handleRemoteClick);
    window.addEventListener('remote-type', handleRemoteType);

    return () => {
      window.removeEventListener('remote-click', handleRemoteClick);
      window.removeEventListener('remote-type', handleRemoteType);
    };
  }, []);

  const handleKeyPress = (keyId: string) => {
    if (keyId === 'BACKSPACE') {
      setText(t => t.slice(0, -1));
    } else if (keyId === 'SPACE') {
      setText(t => {
        const words = t.trim().split(/\s+/);
        if (words.length >= 2) {
          AutocompleteService.learnTransition(words[words.length - 2], words[words.length - 1]);
        }
        return t + ' ';
      });
    } else if (keyId === 'ENTER') {
      setText(t => t + '\n');
    } else if (keyId === 'PAGE_NEXT') {
      setQuadrantPage(p => (p + 1) % QUADRANT_PAGES.length);
    } else if (keyId === 'TOGGLE_LAYOUT') {
      setLayoutMode(m => m === 'quadrant' ? 'qwerty' : 'quadrant');
    } else if (keyId.startsWith('PRED_')) {
      const word = keyId.replace('PRED_', '');
      setText(t => {
        const words = t.trim().split(/\s+/);
        if (words.length > 0) {
          AutocompleteService.learnTransition(words[words.length - 1], word);
        }
        words.pop();
        return words.join(' ') + (words.length > 0 ? ' ' : '') + word + ' ';
      });
    } else {
      setText(t => t + keyId);
    }
  };

  const handleKeyClick = (keyId: string) => {
    handleKeyPress(keyId);
    setHoveredKey(null);
    setDwellProgress(0);
    hoverStartTimeRef.current = null;
    lastHoveredKeyRef.current = null;
  };

  useEffect(() => {
    if (isAutoTypingRef.current) return;
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
    if (isAutoTypingRef.current) return;
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
    <div className="flex-grow flex flex-col p-6 gap-6 select-none w-full max-w-none mx-auto h-full justify-between">
      
      {/* Top Header Section */}
      <div className="flex flex-col gap-4 shrink-0">
        {/* Output Message Display area */}
        <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col min-h-[120px] max-h-[160px] ml-[272px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-extrabold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> Output Message
            </span>
            
            {/* AI Autocomplete Widget */}
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-[9px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded border transition-all duration-300",
                isLlmActive 
                  ? "bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)] animate-pulse"
                  : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
              )}>
                AI AUTOCOMPLETE: {isLlmActive ? 'GROQ DYNAMIC' : 'OFFLINE SMART'}
              </span>
              
              {!((import.meta as any).env?.VITE_GROQ_API_KEY) && (
                <input 
                  type="password"
                  placeholder="🔑 Paste Groq API Key..."
                  value={groqKey}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setGroqKey(val);
                    localStorage.setItem('groq_api_key', val);
                  }}
                  className="bg-zinc-950/70 border border-white/5 text-zinc-300 placeholder-zinc-600 rounded-lg text-[10px] px-3 py-1 focus:outline-none focus:border-cyan-500/30 transition-all w-[180px] focus:w-[220px]"
                />
              )}
              
              <span className="text-[10px] text-zinc-500 font-mono">{text.length} chars</span>
            </div>
          </div>
          <div className="text-3xl font-mono text-white leading-relaxed overflow-y-auto flex-grow break-words whitespace-pre-wrap">
            {text}
            <span className="inline-block w-3 h-7 align-middle bg-[#00d2ff] ml-1 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_12px_#00d2ff]"></span>
          </div>
        </section>

        {/* Predictive Suggestions Bank */}
        <section className="flex justify-center gap-4 flex-wrap shrink-0 ml-[272px]">
          {suggestions.map(word => (
            <Key 
              key={`PRED_${word}`} 
              id={`PRED_${word}`} 
              label={<span className="lowercase font-semibold">{word}</span>}
              width="w-auto"
              isHovered={hoveredKey === `PRED_${word}`}
              progress={hoveredKey === `PRED_${word}` ? dwellProgress : 0}
              isPrediction={true}
              onClick={() => handleKeyClick(`PRED_${word}`)}
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
              onClick={() => handleKeyClick(char)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-3xl transition-all duration-300 border backdrop-blur-md shadow-2xl overflow-hidden cursor-pointer select-none",
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
        <section className="flex-grow flex flex-col gap-4 my-2 min-h-[400px]">
          {QWERTY_LAYOUT.map((row, i) => (
            <div key={i} className="flex justify-center gap-4 flex-grow h-0">
              {/* Add offset spacing to shift rows nicely like standard key layout */}
              {i === 1 && <div className="flex-[0.5] pointer-events-none" />}
              {i === 2 && <div className="flex-[0.5] pointer-events-none" />}

              {row.map(char => (
                <Key 
                  key={char} 
                  id={char} 
                  label={<span className="text-3xl font-semibold">{char}</span>} 
                  width="flex-1"
                  isHovered={hoveredKey === char}
                  progress={hoveredKey === char ? dwellProgress : 0}
                  onClick={() => handleKeyClick(char)}
                />
              ))}
              {i === 2 && (
                <Key 
                  id="BACKSPACE" 
                  label={<span className="text-base font-bold flex items-center gap-2 justify-center"><Delete size={20} /> BKSP</span>}
                  width="flex-[1.8]"
                  className="!bg-red-500/15 !border-red-500/30 !text-red-400"
                  isHovered={hoveredKey === 'BACKSPACE'}
                  progress={hoveredKey === 'BACKSPACE' ? dwellProgress : 0}
                  onClick={() => handleKeyClick('BACKSPACE')}
                />
              )}

              {i === 1 && <div className="flex-[0.5] pointer-events-none" />}
              {i === 2 && <div className="flex-[0.2] pointer-events-none" />}
            </div>
          ))}
          
          {/* Bottom Row */}
          <div className="flex justify-center gap-4 flex-grow h-0">
             <Key 
                id="TOGGLE_LAYOUT" 
                label={<span className="text-sm font-bold flex items-center gap-2 justify-center"><LayoutGrid size={18} /> BIG KEYS</span>}
                width="flex-[2.2]"
                className="!bg-cyan-500/20 !border-cyan-500/40 !text-cyan-400 font-bold tracking-wider"
                isHovered={hoveredKey === 'TOGGLE_LAYOUT'}
                progress={hoveredKey === 'TOGGLE_LAYOUT' ? dwellProgress : 0}
                onClick={() => handleKeyClick('TOGGLE_LAYOUT')}
              />
             <Key 
                id="SPACE" 
                label={<span className="text-sm font-bold tracking-widest flex items-center gap-2 justify-center"><Space size={20} /> SPACE</span>}
                width="flex-[6.5]"
                className="text-zinc-300 font-sans tracking-widest"
                isHovered={hoveredKey === 'SPACE'}
                progress={hoveredKey === 'SPACE' ? dwellProgress : 0}
                onClick={() => handleKeyClick('SPACE')}
              />
               <Key 
                id="ENTER" 
                label={<span className="text-base font-bold flex items-center gap-2 justify-center"><CornerDownLeft size={20} /> ENTER</span>}
                width="flex-[2.2]"
                className="!bg-cyan-500/20 !border-cyan-400 !text-cyan-400 font-bold"
                isHovered={hoveredKey === 'ENTER'}
                progress={hoveredKey === 'ENTER' ? dwellProgress : 0}
                onClick={() => handleKeyClick('ENTER')}
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
            onClick={() => handleKeyClick('PAGE_NEXT')}
          />

          <Key 
            id="SPACE" 
            label={<span className="text-base font-bold tracking-widest flex items-center gap-2"><Space size={20} /> SPACE</span>}
            width="w-full"
            className="!bg-zinc-800/80 !border-white/15 text-white"
            isHovered={hoveredKey === 'SPACE'}
            progress={hoveredKey === 'SPACE' ? dwellProgress : 0}
            onClick={() => handleKeyClick('SPACE')}
          />

          <Key 
            id="BACKSPACE" 
            label={<span className="text-base font-bold tracking-wider flex items-center gap-2"><Delete size={20} /> DELETE</span>}
            width="w-full"
            className="!bg-red-500/15 !border-red-500/30 !text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
            isHovered={hoveredKey === 'BACKSPACE'}
            progress={hoveredKey === 'BACKSPACE' ? dwellProgress : 0}
            onClick={() => handleKeyClick('BACKSPACE')}
          />

          <Key 
            id="TOGGLE_LAYOUT" 
            label={<span className="text-xs font-bold tracking-wider flex items-center gap-2"><LayoutGrid size={18} /> QWERTY MODE</span>}
            width="w-full"
            className="!bg-zinc-800/80 !border-white/15 text-zinc-300"
            isHovered={hoveredKey === 'TOGGLE_LAYOUT'}
            progress={hoveredKey === 'TOGGLE_LAYOUT' ? dwellProgress : 0}
            onClick={() => handleKeyClick('TOGGLE_LAYOUT')}
          />
        </section>
      )}

    </div>
  );
}
