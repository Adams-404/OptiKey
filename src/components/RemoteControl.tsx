import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Trash2, RotateCcw, Keyboard as KeyIcon, Send, Move, ShieldAlert } from 'lucide-react';

export default function RemoteControl() {
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const trackpadRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef<number>(0);

  // Check connection status
  useEffect(() => {
    setIsConnected(true);
    return () => setIsConnected(false);
  }, []);

  // Send mouse coordinate update to the presenter
  const sendMove = async (x: number, y: number) => {
    const now = performance.now();
    // Throttle to once every 30ms to maintain extreme smoothness without flooding the server
    if (now - lastSentRef.current < 30) return;
    lastSentRef.current = now;

    try {
      await fetch('/api/mouse-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'move', x, y })
      });
    } catch (e) {
      console.error('Remote trackpad send error', e);
    }
  };

  // Send click command to the presenter
  const sendCommand = async (type: 'click' | 'type' | 'command', payload: Record<string, any>) => {
    try {
      await fetch('/api/mouse-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...payload })
      });
    } catch (e) {
      console.error('Remote command send error', e);
    }
  };

  // Handle touch events on the trackpad
  const handleTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!trackpadRef.current) return;
    const touch = e.touches[0];
    const rect = trackpadRef.current.getBoundingClientRect();
    
    // Calculate relative coordinates normalized from 0 to 1
    const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
    
    sendMove(x, y);
  };

  // Handle mouse drag events for local desktop testing
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || !trackpadRef.current) return; // Only track while dragging with mouse down
    const rect = trackpadRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    
    sendMove(x, y);
  };

  const handleTextSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendCommand('type', { text: inputText });
    setInputText('');
  };

  const handleClear = () => {
    sendCommand('type', { text: '' });
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#050505] font-sans text-white p-6 justify-between select-none">
      
      {/* Top Banner */}
      <header className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            OptiKey Remote Dashboard
          </h1>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
            <span className="text-[9px] font-mono tracking-widest text-zinc-400 uppercase">
              {isConnected ? 'Active Wizard Link' : 'Connecting'}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold flex items-center gap-1 text-purple-400">
          <ShieldAlert size={12} /> Wizard of Oz Control Enabled
        </p>
      </header>

      {/* Main Drag Trackpad Area */}
      <div className="flex-grow flex flex-col gap-4 min-h-[300px]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-zinc-500 flex items-center gap-1">
            <Move size={12} /> Interactive Gaze Pad
          </span>
          <span className="text-[9px] text-zinc-500 font-mono">Drag finger to guide cursor</span>
        </div>
        
        <div
          ref={trackpadRef}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onMouseMove={handleMouseMove}
          className="flex-grow rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/30 to-zinc-950/70 backdrop-blur-2xl relative overflow-hidden flex items-center justify-center shadow-[inset_0_2px_20px_rgba(255,255,255,0.02)] active:border-cyan-500/30 transition-colors"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        >
          {/* Neon trackpad guides */}
          <div className="absolute inset-0 pointer-events-none border border-cyan-500/5 m-4 rounded-xl flex items-center justify-center">
            <span className="text-[10px] text-cyan-400/25 font-mono tracking-widest uppercase font-bold animate-pulse">Drag Zone</span>
          </div>
        </div>
      </div>

      {/* Control Triggers & Keyboard Injection */}
      <div className="flex flex-col gap-6 mt-6 shrink-0">
        
        {/* Quick Shortcut Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => sendCommand('click', { keyId: 'SPACE' })}
            className="py-3 px-4 bg-zinc-900 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold font-mono tracking-wider active:scale-95 transition-all text-zinc-300"
          >
            [SPACE]
          </button>
          <button
            onClick={() => sendCommand('click', { keyId: 'BACKSPACE' })}
            className="py-3 px-4 bg-zinc-900 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold font-mono tracking-wider active:scale-95 transition-all text-zinc-300"
          >
            [BACKSPACE]
          </button>
          <button
            onClick={() => sendCommand('click', { keyId: 'TRIGGER_DWELL' })}
            className="py-3 px-4 bg-cyan-900/20 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold font-mono tracking-wider active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)]"
          >
            [FORCE DWELL]
          </button>
        </div>

        {/* Secret Text Form */}
        <form onSubmit={handleTextSend} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-zinc-500 flex items-center gap-1">
              <KeyIcon size={12} /> Secret Text Injector
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-[9px] uppercase tracking-wider text-red-400 hover:text-red-300 flex items-center gap-1 font-bold"
            >
              <Trash2 size={10} /> Clear Screen
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type phrase to inject secretly..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-grow bg-zinc-900/80 border border-white/10 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-purple-500/50 transition-colors font-semibold"
            />
            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl px-5 py-3 transition-all flex items-center justify-center shrink-0 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            >
              <Send size={14} />
            </button>
          </div>
        </form>

        {/* Calibration Controls */}
        <div className="flex gap-3 justify-between items-center bg-zinc-950/60 border border-white/5 rounded-xl p-3">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
            <RotateCcw size={12} /> Presenter Mode
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => sendCommand('command', { action: 'start-calibration' })}
              className="px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
            >
              Enter Calib
            </button>
            <button
              onClick={() => sendCommand('command', { action: 'exit-calibration' })}
              className="px-3 py-1.5 bg-zinc-900 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
            >
              Exit Calib
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
