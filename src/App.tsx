import React, { useEffect, useRef, useState } from 'react';
import Calibration from './components/Calibration';
import Keyboard from './components/Keyboard';
import RemoteControl from './components/RemoteControl';
import { gazeTracker, Point } from './services/GazeTrackerService';
import { Eye, Settings, Activity, Navigation, Sliders, Cpu, Video } from 'lucide-react';
import { cn } from './components/Keyboard';

export default function App() {
  const [isRemote] = useState(() => window.location.pathname === '/remote');
  
  if (isRemote) {
    return <RemoteControl />;
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'calibration' | 'keyboard'>('calibration');
  const [gazePoint, setGazePoint] = useState<Point>({ x: -1, y: -1 });
  const [trackerStatus, setTrackerStatus] = useState<string>('Initializing');
  const [showDot, setShowDot] = useState(true);

  const [trackingMode, setTrackingMode] = useState<'eye' | 'head' | 'hybrid'>('head');
  const [smoothing, setSmoothing] = useState<number>(8);
  const [dwellTime, setDwellTime] = useState<number>(700);

  const lastMouseActivityRef = useRef<number>(0);
  const lastRemoteActivityRef = useRef<number>(0);

  // SSE receiver for remote control (Wizard of Oz mode)
  useEffect(() => {
    const source = new EventSource('/api/mouse-stream');

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'move') {
          setGazePoint({ x: data.x * window.innerWidth, y: data.y * window.innerHeight });
          lastRemoteActivityRef.current = Date.now();
        } else if (data.type === 'click') {
          const customEvent = new CustomEvent('remote-click', { detail: { keyId: data.keyId } });
          window.dispatchEvent(customEvent);
        } else if (data.type === 'type') {
          const customEvent = new CustomEvent('remote-type', { detail: { text: data.text } });
          window.dispatchEvent(customEvent);
        } else if (data.type === 'command') {
          if (data.action === 'start-calibration') {
            setMode('calibration');
          } else if (data.action === 'exit-calibration') {
            setMode('keyboard');
          }
        }
      } catch (e) {
        console.error('SSE parser error', e);
      }
    };

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMouseActivityRef.current = Date.now();
      setGazePoint({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      gazeTracker.start(videoRef.current, (point) => {
        if (Date.now() - lastMouseActivityRef.current < 1500 || Date.now() - lastRemoteActivityRef.current < 1500) {
          return;
        }
        setGazePoint(point);
        if (point.x === -1 && gazeTracker.calibrationData.length > 0) {
          setTrackerStatus('Lost face');
        } else {
          setTrackerStatus('Tracking');
        }
      });
      setTrackerStatus('Waiting for camera...');
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      gazeTracker.setCanvas(canvasRef.current);
    }
  }, [canvasRef]);

  useEffect(() => {
    gazeTracker.trackingMode = trackingMode;
  }, [trackingMode]);

  useEffect(() => {
    gazeTracker.smoothing = smoothing;
  }, [smoothing]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#050505] font-sans text-white overflow-hidden relative selection:bg-[#00d2ff]/30">
      
      {/* Hidden Video for processing */}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      {/* Camera Feed Preview */}
      <div className={cn(
        "transition-all duration-700 ease-in-out border overflow-hidden bg-black flex items-center justify-center z-[50] backdrop-blur-md",
        mode === 'calibration' 
          ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[405px] rounded-3xl opacity-75 pointer-events-none border-[#00d2ff]/30 shadow-[0_0_25px_rgba(0,210,255,0.2)]" 
          : "absolute top-24 left-8 w-[240px] h-[180px] rounded-2xl pointer-events-auto shadow-[0_10px_40px_rgba(0,0,0,0.9)] border-[#00d2ff]/50 bg-zinc-950"
      )}>
        <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-cover" />
      </div>

      <header className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-zinc-950/80 backdrop-blur-xl shrink-0 z-50">
        <div className="flex items-center gap-6">
          
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-[#00d2ff] bg-clip-text text-transparent">
              OptiKey <span className="text-[#00d2ff] text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#00d2ff]/10 border border-[#00d2ff]/20 ml-1">Pro v2.5</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${trackerStatus === 'Tracking' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : trackerStatus === 'Waiting for camera...' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-extrabold shrink-0">{trackerStatus}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Controls & Settings */}
        <div className="flex items-center gap-6">
          
          {/* Tracking Mode Selection */}
          <div className="flex items-center bg-zinc-900/90 border border-white/10 rounded-lg p-1 gap-1 shadow-inner">
            <button
              onClick={() => setTrackingMode('head')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                trackingMode === 'head' ? "bg-[#00d2ff] text-black shadow-[0_0_15px_rgba(0,210,255,0.4)]" : "text-zinc-400 hover:text-white"
              )}
            >
              <Navigation size={14} /> Head
            </button>
            <button
              onClick={() => setTrackingMode('hybrid')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                trackingMode === 'hybrid' ? "bg-[#00d2ff] text-black shadow-[0_0_15px_rgba(0,210,255,0.4)]" : "text-zinc-400 hover:text-white"
              )}
            >
              <Activity size={14} /> Hybrid
            </button>
            <button
              onClick={() => setTrackingMode('eye')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer",
                trackingMode === 'eye' ? "bg-[#00d2ff] text-black shadow-[0_0_15px_rgba(0,210,255,0.4)]" : "text-zinc-400 hover:text-white"
              )}
            >
              <Eye size={14} /> Eye Only
            </button>
          </div>

          <div className="h-6 w-[1px] bg-white/10" />

          {/* Recalibrate & Visualizer Dot Toggle */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowDot(d => !d)}
              className={cn(
                "text-xs font-bold uppercase tracking-wider px-3 py-2 rounded border transition-all cursor-pointer flex items-center gap-1.5",
                showDot 
                  ? "bg-[#00d2ff]/15 text-[#00d2ff] border-[#00d2ff]/30 shadow-[0_0_15px_rgba(0,210,255,0.2)]" 
                  : "bg-white/5 text-zinc-500 border-white/10 hover:bg-white/10"
              )}
            >
              <Video size={14} /> {showDot ? 'Gaze Dot: ON' : 'Gaze Dot: OFF'}
            </button>

            <button 
              onClick={() => setMode('calibration')}
              className="px-4 py-2 bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 border border-white/15 rounded-lg text-xs transition-all cursor-pointer text-white font-bold tracking-wider uppercase shadow-md flex items-center gap-1.5"
            >
              <Sliders size={14} className="text-[#00d2ff]" /> Recalibrate
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col relative overflow-hidden z-30">
        {mode === 'calibration' ? (
          <Calibration onComplete={() => setMode('keyboard')} />
        ) : (
          <Keyboard gazePoint={gazePoint} dwellTime={dwellTime} />
        )}
      </main>

      <footer className="h-12 shrink-0 px-8 border-t border-white/10 bg-zinc-950/90 backdrop-blur-md flex items-center justify-between text-xs text-zinc-400 font-medium z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 uppercase font-bold tracking-wider text-[10px]">Dwell Speed:</span>
            <select 
              value={dwellTime} 
              onChange={(e) => setDwellTime(Number(e.target.value))}
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#00d2ff] cursor-pointer font-mono"
            >
              <option value={400}>Fast (400ms)</option>
              <option value={700}>Normal (700ms)</option>
              <option value={1000}>Relaxed (1000ms)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-zinc-500 uppercase font-bold tracking-wider text-[10px]">Stability Buffer:</span>
            <select 
              value={smoothing} 
              onChange={(e) => setSmoothing(Number(e.target.value))}
              className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#00d2ff] cursor-pointer font-mono"
            >
              <option value={4}>Raw (4 frames)</option>
              <option value={8}>Balanced (8 frames)</option>
              <option value={15}>Ultra Stable (15 frames)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] text-zinc-500 uppercase tracking-widest font-extrabold">
          <span className="flex items-center gap-1"><Cpu size={14} className="text-cyan-500 animate-pulse" /> Mediapipe AI Engine</span>
          <span>•</span>
          <span>60 FPS Tracking</span>
        </div>
      </footer>

      {/* Gaze Visualizer Dot */}
      {showDot && gazePoint.x > 0 && gazePoint.y > 0 && mode === 'keyboard' && (
        <div 
          className="fixed w-4 h-4 rounded-full bg-[#ff4444] border-2 border-white pointer-events-none z-[100] transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(255,68,68,0.8)] transition-all duration-75 ease-out"
          style={{ left: gazePoint.x, top: gazePoint.y }}
        />
      )}

    </div>
  );
}
