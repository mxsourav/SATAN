import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RotateCw, 
  Trash2, 
  Pause, 
  Play, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Sun, 
  Activity, 
  Zap, 
  Tv, 
  RefreshCw,
  Link,
  Unlink,
  Info,
  X
} from 'lucide-react';

import { useWebSerial } from './useWebSerial';
import AIPanel from './components/AIPanel';
import { SessionMemory } from './services/SessionMemory';
import { LocalStructuringEngine } from './services/LocalStructuringEngine';
import { KeepAlive } from './services/KeepAlive';
import { TerminalParser, TerminalStreamAggregator, LogEntry } from './services/TerminalParser';
import { AutoDiagnosticEngine } from './services/AutoDiagnosticEngine';
import { TerminalLine, TerminalRenderMode } from './components/TerminalLine';
import { AsciiSplash } from './components/AsciiSplash';
import { TerminalNoticeBar, TerminalNoticeSystem } from './components/TerminalNoticeBar';
import { WorkspaceCanvas, type PanelId } from './workspace';

// Color Preset Themes
const COLOR_PRESETS = [
  { name: 'cyan', hex: '#00ffff', rgb: '0, 255, 255' },
  { name: 'green', hex: '#10b981', rgb: '16, 185, 129' },
  { name: 'yellow', hex: '#f59e0b', rgb: '245, 158, 11' },
  { name: 'white', hex: '#ffffff', rgb: '255, 255, 255' },
  { name: 'red', hex: '#ef4444', rgb: '239, 68, 68' },
  { name: 'purple', hex: '#8b5cf6', rgb: '139, 92, 246' },
];

interface LogLine {
  time: string;
  tag: string;
  text: string;
  color: string;
  bold?: boolean;
}

export default function App() {
  const oledCanvasRef = useRef<HTMLCanvasElement>(null);

  // Web Serial Integration

  // Terminal Refs for high-speed DOM injection
  const terminalViewportRef = useRef<HTMLDivElement>(null);
  const terminalAnchorRef = useRef<HTMLDivElement>(null);
  const lineCountRef = useRef(0);
  
  // State Refs for the log parser callback
  const showTimestampsRef = useRef(false);
  const isLogsPausedRef = useRef(false);
  const autoScrollEnabledRef = useRef(true);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logQueueRef = useRef<LogEntry[]>([]);
  const flushScheduledRef = useRef(false);
  const streamAggregatorRef = useRef(new TerminalStreamAggregator());

  const onLogParsed = useCallback((rawLine: string) => {
    if (isLogsPausedRef.current) return;
    
    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}]`;
    
    // Legacy structuring engine for AI crash context
    LocalStructuringEngine.parseLine(timeStr, "[ESP32]", rawLine);

    const entries = streamAggregatorRef.current.processLine(rawLine);
    
    for (const entry of entries) {
      if (entry.noticeTrigger) {
        TerminalNoticeSystem.emit(entry.severity as any, entry.noticeTrigger);
      }
      AutoDiagnosticEngine.processLog(entry);
      logQueueRef.current.push(entry);
    }

    if (entries.length > 0 && !flushScheduledRef.current) {
      flushScheduledRef.current = true;
      requestAnimationFrame(() => {
        setLogs(prev => {
          const updated = [...prev];
          const newEntries = logQueueRef.current;
          logQueueRef.current = [];
          flushScheduledRef.current = false;

          for (const newEntry of newEntries) {
            const lastEntry = updated[updated.length - 1];
            // Only group if hash matches and it's not a generic SYSTEM log which might over-group
            if (lastEntry && lastEntry.hash === newEntry.hash && newEntry.category !== 'SYSTEM') {
              // Create a fresh object to break reference so React.memo updates
              updated[updated.length - 1] = {
                ...lastEntry,
                count: lastEntry.count + 1,
                timestamp: newEntry.timestamp
              };
            } else {
              updated.push(newEntry);
            }
            SessionMemory.appendLog(newEntry);
          }

          if (updated.length > 2000) return updated.slice(-2000);
          return updated;
        });

        // Auto-scroll anchor logic
        if (autoScrollEnabledRef.current && terminalAnchorRef.current) {
          terminalAnchorRef.current.scrollIntoView();
        }
      });
    }
  }, []);

  useEffect(() => {
    // Start backend keepalive ping to prevent Render cold starts
    // Update the URL to the production Render backend once deployed
    KeepAlive.start();
    return () => KeepAlive.stop();
  }, []);

  const { 
    status, 
    uptimeSeconds, 
    ipAddress, 
    activeMode,
    setActiveMode,
    isTransmitting,
    isReceiving,
    connect, 
    disconnect, 
    sendBtn,
    sendMacro
  } = useWebSerial({ canvasRef: oledCanvasRef, onLogParsed });

  const clearLogs = () => {
    setLogs([]);
    SessionMemory.clearSession();
  };

  // Settings Toggles
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [invertDisplay, setInvertDisplay] = useState(false);
  const [gridOnGraph, setGridOnGraph] = useState(true);
  
  const [imageError, setImageError] = useState(false);
  
  const [displayColor, setDisplayColor] = useState('#00ffff');
  const [displayColorRgb, setDisplayColorRgb] = useState('0, 255, 255');
  const [brightness, setBrightness] = useState(80);
  const [logLevel, setLogLevel] = useState<'INFO' | 'DEBUG' | 'WARN' | 'ERROR'>('INFO');
  const [terminalStyle, setTerminalStyle] = useState<TerminalRenderMode>('compact');
  const [isLogsPaused, setIsLogsPaused] = useState(false);
  const [isRawAgentMode, setIsRawAgentMode] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const [colorWheelCursor, setColorWheelCursor] = useState({ x: 14, y: 72 });
  const [isDraggingColor, setIsDraggingColor] = useState(false);
  const colorWheelRef = useRef<HTMLDivElement>(null);
  // Formats uptime seconds to HH:MM:SS
  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Time Formatter for logs
  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTerminalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 40;
    autoScrollEnabledRef.current = isAtBottom;
  };

  // Color Calculation Helper: HSL to Hex
  const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Helper: Hex to RGB string for custom theme
  const hexToRgbString = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
    }
    return '0, 255, 255';
  };

  // Handles clicking/dragging on Color Wheel to choose custom hue
  const handleColorWheelSelect = (clientX: number, clientY: number) => {
    if (!colorWheelRef.current) return;
    const rect = colorWheelRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    
    const dx = clickX - centerX;
    const dy = clickY - centerY;
    
    // Calculate polar coordinates
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = centerX;
    
    // Clamp to boundaries
    const angleRad = Math.atan2(dy, dx);
    const clampedDistance = Math.min(distance, maxRadius);
    
    // Set visual cursor position
    const cursorX = centerX + Math.cos(angleRad) * clampedDistance;
    const cursorY = centerY + Math.sin(angleRad) * clampedDistance;
    setColorWheelCursor({ x: cursorX, y: cursorY });

    // Compute HSL
    const angleDeg = (angleRad * (180 / Math.PI) + 360) % 360;
    const saturation = (clampedDistance / maxRadius) * 100;
    const hex = hslToHex(angleDeg, saturation, 50);
    
    setDisplayColor(hex);
    setDisplayColorRgb(hexToRgbString(hex));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDraggingColor(true);
    handleColorWheelSelect(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingColor) {
        handleColorWheelSelect(e.clientX, e.clientY);
      }
    };
    const handleMouseUp = () => {
      setIsDraggingColor(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingColor]);

  // Preset Select handler
  const handlePresetSelect = (hex: string, rgb: string) => {
    setDisplayColor(hex);
    setDisplayColorRgb(rgb);
    
    // Position color wheel cursor matching presets (scaled coordinates on 144px wheel)
    if (!colorWheelRef.current) return;
    const centerX = 72;
    const centerY = 72;
    let angleDeg = 0;
    let dist = 58;

    switch (hex) {
      case '#00ffff': angleDeg = 180; break; // Cyan
      case '#10b981': angleDeg = 120; break; // Green
      case '#f59e0b': angleDeg = 60; break;  // Yellow
      case '#ffffff': dist = 0; break;       // White (center)
      case '#ef4444': angleDeg = 0; break;   // Red
      case '#8b5cf6': angleDeg = 280; break; // Purple
    }

    const angleRad = angleDeg * (Math.PI / 180);
    setColorWheelCursor({
      x: centerX + Math.cos(angleRad) * dist,
      y: centerY + Math.sin(angleRad) * dist
    });
  };

  // Action Button Handlers
  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleReboot = () => {
    sendBtn('AUX', true); // Maybe AUX is used for something. Firmware might reset on DTR.
  };

  // D-Pad navigation trigger actions on OLED
  const handleDpadPress = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'OK') => {
    if (status !== 'CONNECTED') return;
    sendBtn(direction, true);
    // Auto-release after a short delay since it's an onClick right now
    setTimeout(() => {
      sendBtn(direction, false);
    }, 150);
  };



  // Render hardware LED based on connectivity
  const ledColor = status === 'CONNECTED' ? '#10b981' : (status === 'REBOOTING' ? '#ef4444' : '#ef4444');

  // ── Build Panel Contents Map ──────────────────────────────────────────
  // Each panel's JSX is assembled here from App-level state/handlers.
  // The workspace engine renders these inside absolute-positioned wrappers.
  const panelContents = useMemo<Partial<Record<PanelId, React.ReactNode>>>(() => ({

    // ── AI DIAGNOSTICS PANEL ──────────────────────────────────────────
    aiDiagnostics: (
      <AIPanel />
    ),

    // ── SATAN NAME CARD PANEL ─────────────────────────────────────────
    satanHeader: (
      <div 
        className="panel-hardware h-full w-full flex items-center justify-center p-3 bg-black/30 select-none panel-satan-header cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setShowAboutModal(true)}
        title="Click to view system architecture and updates"
      >
        <div className="flex items-center gap-3.5 w-full justify-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.6)] border border-indigo-400/30 shrink-0">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold font-sans tracking-tight uppercase text-zinc-100 truncate">S.A.T.A.N.</h1>
              <span className="text-[9px] font-mono border border-zinc-800 font-bold bg-indigo-950 text-indigo-300 rounded px-1.5 py-0.5 shrink-0 hover:bg-indigo-900 transition-colors">v1.1.0</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase font-semibold mt-0.5 truncate">Universal ESP32 Monitor</div>
          </div>
        </div>
      </div>
    ),

    // ── IR STATUS DIODES PANEL ────────────────────────────────────────
    irDiodes: (
      <div className="panel-hardware h-full w-full flex items-center justify-center p-3 bg-black/30 select-none panel-ir-diodes">
        <div className="flex gap-3 items-center justify-center w-full flex-wrap">
          {/* IR TX */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/20 gap-3 border border-zinc-900 rounded-lg flex-1 min-w-[120px]">
            <span className="text-[9px] font-mono font-bold text-zinc-500 tracking-wider">IR TX</span>
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-7 h-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] rotate-90" viewBox="0 0 40 40">
                <line x1="16" y1="24" x2="16" y2="38" stroke="#555" strokeWidth="1.5" />
                <line x1="24" y1="24" x2="24" y2="35" stroke="#444" strokeWidth="1.5" />
                <ellipse cx="20" cy="24" rx="7" ry="1.5" fill="#333" />
                <path d="M13,24 L13,15 A7,7 0 0,1 27,15 L27,24 Z" fill="url(#redLedGradient)" />
                <path d="M15,20 L18,17 L18,22" stroke="#d4d4d8" strokeWidth="1" fill="none" opacity="0.6" />
                <path d="M25,21 L22,18 L22,23" stroke="#94a3b8" strokeWidth="1.5" fill="none" opacity="0.8" />
                <defs><linearGradient id="redLedGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#991b1b" /><stop offset="30%" stopColor="#ef4444" /><stop offset="70%" stopColor="#f87171" /><stop offset="100%" stopColor="#7f1d1d" /></linearGradient></defs>
              </svg>
              {isTransmitting && status === 'CONNECTED' && (
                <div className="absolute top-0 flex items-center justify-center pointer-events-none">
                  <div className="absolute w-5 h-5 rounded-full bg-red-500/35 blur-md animate-pulse" />
                  <div className="absolute w-8 h-8 rounded-full border border-red-500/40 animate-ping opacity-75" />
                </div>
              )}
            </div>
          </div>
          {/* IR RX */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/20 gap-3 border border-zinc-900 rounded-lg flex-1 min-w-[120px]">
            <span className="text-[9px] font-mono font-bold text-zinc-500 tracking-wider">IR RX</span>
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-7 h-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] rotate-90" viewBox="0 0 40 40">
                <line x1="15" y1="26" x2="15" y2="38" stroke="#444" strokeWidth="1.5" />
                <line x1="20" y1="26" x2="20" y2="35" stroke="#555" strokeWidth="1.5" />
                <line x1="25" y1="26" x2="25" y2="38" stroke="#444" strokeWidth="1.5" />
                <rect x="11" y="10" width="18" height="16" rx="1.5" fill="#2d3748" stroke="#1a202c" strokeWidth="1" />
                <circle cx="20" cy="18" r="5" fill="url(#receiverDomeGradient)" />
                <defs><linearGradient id="receiverDomeGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#1a365d" /><stop offset="40%" stopColor="#2b6cb0" /><stop offset="80%" stopColor="#0f172a" /></linearGradient></defs>
              </svg>
              {isReceiving && status === 'CONNECTED' && (
                <div className="absolute top-0 flex items-center justify-center pointer-events-none">
                  <div className="absolute w-5 h-5 rounded-full bg-cyan-500/25 blur-md" />
                  <div className="absolute w-8 h-8 rounded-full border border-cyan-400/50 animate-ping" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),

    // ── CREDITS PANEL ─────────────────────────────────────────────────
    credits: (
      <div 
        className="panel-hardware h-full w-full flex flex-col p-3 bg-[#050608]/95 font-mono select-none cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setShowAboutModal(true)}
        title="Click to view system architecture and updates"
      >
        <h2 className="text-[10px] font-bold tracking-widest text-zinc-500 mb-1.5 border-b border-zinc-800/60 pb-1 flex items-center gap-1.5 uppercase">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
          SYSTEM ABOUT
        </h2>
        <div className="text-[10px] text-zinc-400 space-y-1 mt-1.5 leading-relaxed">
          <div><span className="text-zinc-600 font-bold">PROJECT:</span> TetraX / BWifiKill</div>
          <div><span className="text-zinc-600 font-bold">SYSTEM v:</span> 1.1.0 (Architecture)</div>
          <div className="text-indigo-400 text-[9px] font-bold mt-1.5 hover:text-indigo-300 transition-colors">▶ OPEN SYSTEM MAP</div>
        </div>
      </div>
    ),

    // ── SERIAL MONITOR PANEL ──────────────────────────────────────────
    serialMonitor: (
      <div id="serial-log-panel" className="flex flex-col h-full panel-hardware overflow-hidden bg-black/20">
        <div className="flex flex-col border-b border-zinc-800/80 p-4 pb-2.5 shrink-0 gap-3">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-bold font-mono tracking-widest text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-ping" />
              SERIAL LOG
            </h2>
            <div className="flex items-center gap-2 bg-black/60 rounded px-1 py-0.5 border border-zinc-800/50 cursor-pointer" onClick={() => setIsRawAgentMode(!isRawAgentMode)}>
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded transition-all ${!isRawAgentMode ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'text-zinc-600'}`}>HUMAN READABLE</span>
              <div className="w-7 h-3.5 bg-zinc-950 rounded-full border border-zinc-800 relative transition-colors shadow-inner">
                <div className={`absolute top-0.5 left-0.5 w-2 h-2 rounded-full transition-transform ${isRawAgentMode ? 'translate-x-3.5 bg-red-500 shadow-[0_0_5px_#ef4444]' : 'bg-cyan-500 shadow-[0_0_5px_#06b6d4]'}`} />
              </div>
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded transition-all ${isRawAgentMode ? 'bg-red-950/40 text-red-400 shadow-sm' : 'text-zinc-600'}`}>RAW AGENT</span>
            </div>
          </div>
          <div className="flex gap-2 text-[10px] font-mono text-zinc-500 justify-end">
            <button onClick={clearLogs} className="hover:text-white transition-colors bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 flex items-center gap-1 active:bg-black" title="Clear Logs">
              <Trash2 className="w-3 h-3" /> <span>CLEAR</span>
            </button>
            <button onClick={() => { showTimestampsRef.current = !showTimestampsRef.current; setShowTimestamps(showTimestampsRef.current); }} className={`transition-colors border rounded px-1.5 py-0.5 flex items-center gap-1 active:bg-black ${showTimestamps ? 'bg-zinc-900 border-zinc-800 hover:text-white' : 'bg-zinc-800/50 border-zinc-700 text-zinc-500'}`} title="Toggle Timestamps"><span>TIME</span></button>
            <button onClick={() => { isLogsPausedRef.current = !isLogsPausedRef.current; setIsLogsPaused(isLogsPausedRef.current); }} className={`transition-colors border rounded px-1.5 py-0.5 flex items-center gap-1 active:bg-black ${isLogsPaused ? 'bg-amber-950/40 border-amber-800 text-amber-400' : 'bg-zinc-900 border-zinc-800 hover:text-white'}`} title={isLogsPaused ? 'Resume Logging' : 'Pause Logging'}>
              {isLogsPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3" />} <span>{isLogsPaused ? 'RESUME' : 'PAUSE'}</span>
            </button>
          </div>
        </div>
        <div onScroll={handleTerminalScroll} ref={terminalViewportRef} className="flex-1 overflow-y-auto min-h-0 pt-2 pb-2 pl-4 pr-2 font-mono text-left text-[11px] leading-[1.3] space-y-0.5 !select-text cursor-text cyberdeck-scrollbar bg-[#080a0e]/95 shadow-[inset_0_4px_24px_rgba(0,0,0,0.8)] pointer-events-auto relative">
          <TerminalNoticeBar />
          {logs.length === 0 && <AsciiSplash />}
          {logs.map((log) => (
            <TerminalLine key={log.id} log={log} showTimestamps={showTimestamps} mode={terminalStyle} isRawAgentMode={isRawAgentMode} />
          ))}
          <div ref={terminalAnchorRef} />
        </div>
        <div className="px-4 pb-4 pt-3 border-t border-zinc-800/80 flex justify-between items-center shrink-0">
          <div className="flex gap-2 items-center">
            <span className="text-[10px] font-mono font-bold text-zinc-500">STYLE</span>
            <select value={terminalStyle} onChange={(e) => setTerminalStyle(e.target.value as any)} className="bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-400 rounded px-2 py-1 focus:ring-1 focus:ring-zinc-700 focus:outline-none transition-all cursor-pointer h-6">
              <option value="compact">COMPACT</option>
              <option value="diagnostic">DIAGNOSTIC</option>
              <option value="full">VISUAL</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-[10px] font-mono font-bold text-zinc-500">DIAG LEVEL</span>
            <select value={logLevel} onChange={(e) => setLogLevel(e.target.value as any)} className="bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-400 rounded px-2 py-1 focus:ring-1 focus:ring-zinc-700 focus:outline-none transition-all cursor-pointer h-6">
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>
        </div>
      </div>
    ),

    // ── OLED DISPLAY PANEL ────────────────────────────────────────────
    oledDisplay: (
      <div className="panel-hardware bg-black/40 p-2 relative h-full w-full flex items-center justify-center select-none shadow-2xl rounded-xl">
        <div className="relative h-full max-w-full aspect-square flex items-center justify-center">
          <img src="/oled.png" alt="OLED PCB Board" className={`w-full h-full object-contain pointer-events-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] ${imageError ? 'hidden' : 'block'}`} referrerPolicy="no-referrer" onError={() => setImageError(true)} />
          {imageError && (
            <div id="pcb-fallback-container" className="absolute inset-0 rounded-2xl border-2 border-zinc-800 bg-[#0e0e0e] flex flex-col items-center justify-center p-8 shadow-2xl">
              <div className="absolute top-4 left-4 w-6 h-6 rounded-full border-[5px] border-[#c5a059] bg-[#050505] shadow-inner" />
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full border-[5px] border-[#c5a059] bg-[#050505] shadow-inner" />
              <div className="absolute bottom-4 left-4 w-6 h-6 rounded-full border-[5px] border-[#c5a059] bg-[#050505] shadow-inner" />
              <div className="absolute bottom-4 right-4 w-6 h-6 rounded-full border-[5px] border-[#c5a059] bg-[#050505] shadow-inner" />
              <div className="w-[82%] aspect-[1.8] rounded-xl border-[4px] border-zinc-900 bg-black flex items-center justify-center p-3 relative shadow-2xl" />
            </div>
          )}
          <div id="oled-screen-layer" className="absolute z-10 overflow-hidden select-none transition-all duration-300 flex items-center justify-center" style={{ left: '17.5%', top: '30.5%', width: '65%', height: '32%', backgroundColor: invertDisplay ? displayColor : '#040508', filter: `brightness(${brightness}%)` }}>
            <canvas ref={oledCanvasRef} width={128} height={64} className="w-full h-full" style={{ imageRendering: 'pixelated', mixBlendMode: invertDisplay ? 'normal' : 'screen', opacity: 0.95, filter: invertDisplay ? 'invert(1)' : 'none' }} />
            {!invertDisplay && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: displayColor, mixBlendMode: 'multiply' }} />}
            <div className="absolute inset-0 pointer-events-none opacity-[0.25]" style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.85) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.85) 1px, transparent 1px)', backgroundSize: '0.78125% 1.5625%' }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.15]" style={{ backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.7) 50%)', backgroundSize: '100% 3.125%' }} />
          </div>
          <div className="absolute bottom-[20.5%] left-[13%] text-[8px] text-zinc-500 font-mono tracking-wide">A0K1</div>
          <div className="absolute bottom-[20.5%] right-[13%] text-[8px] text-zinc-500 font-mono tracking-wide">1104</div>
        </div>
      </div>
    ),

    // ── OLED SETTINGS PANEL ───────────────────────────────────────────
    oledSettings: (
      <div className="panel-hardware p-4 h-full flex flex-col justify-between bg-black/10 overflow-y-auto">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 flex items-center gap-1.5">OLED COLOR</h2>
          <button onClick={() => handlePresetSelect('#00ffff', '0, 255, 255')} className="text-zinc-500 hover:text-white transition-all active:rotate-180 duration-300" title="Reset to default Cyan"><RotateCw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex gap-3 items-center panel-responsive-flex">
          <div id="color-wheel" ref={colorWheelRef} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); const handleMove = (ev: React.PointerEvent) => handleColorWheelSelect(ev.clientX, ev.clientY); (e.target as HTMLElement).onpointermove = handleMove as any; handleColorWheelSelect(e.clientX, e.clientY); }} onPointerUp={(e) => { (e.target as HTMLElement).releasePointerCapture(e.pointerId); (e.target as HTMLElement).onpointermove = null; }} className="w-28 h-28 touch-none select-none rounded-full cursor-crosshair color-wheel-conic shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_2px_10px_rgba(0,0,0,0.4)] border border-zinc-800 relative shrink-0">
            <div className="absolute inset-0 m-auto w-8 h-8 bg-zinc-900 rounded-full border border-zinc-800 shadow-[0_2px_6px_rgba(0,0,0,0.9)] pointer-events-none" />
            <div className="absolute w-3.5 h-3.5 rounded-full bg-white border border-zinc-950 shadow-lg pointer-events-none -translate-x-1.75 -translate-y-1.75 transition-all duration-75" style={{ left: `${colorWheelCursor.x}px`, top: `${colorWheelCursor.y}px` }} />
          </div>
          <div className="flex-1 flex flex-col gap-2 p-2 bg-zinc-950/50 rounded-lg border border-zinc-800/80">
            <div className="w-full h-10 rounded border border-zinc-900 shadow-md transition-colors" style={{ backgroundColor: displayColor }} />
            <div className="text-[10px] font-mono text-zinc-400 font-bold leading-tight flex flex-col">
              <span>R: {displayColorRgb.split(',')[0]}</span>
              <span>G: {displayColorRgb.split(',')[1]}</span>
              <span>B: {displayColorRgb.split(',')[2]}</span>
            </div>
          </div>
        </div>
        <div className="h-px bg-zinc-800/80 my-3 w-full" />
        <div className="flex justify-between items-center px-1 pt-1">
          {COLOR_PRESETS.map(preset => (
            <button key={preset.name} onClick={() => handlePresetSelect(preset.hex, preset.rgb)} className={`w-5 h-5 rounded-full border-2 transition-all ${displayColor === preset.hex ? 'border-zinc-300 scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'border-transparent opacity-80 hover:scale-110'}`} style={{ backgroundColor: preset.hex }} title={`Preset ${preset.name}`} />
          ))}
        </div>
        <div className="h-px bg-zinc-800/80 my-3 w-full" />
        <div className="space-y-3 shrink-0">
          <h3 className="text-[9px] font-mono font-bold tracking-widest text-zinc-500">DISPLAY SETTINGS</h3>
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-300 font-medium">INVERT DISPLAY</span>
            <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={invertDisplay} onChange={(e) => setInvertDisplay(e.target.checked)} className="sr-only" /><div className="w-9 h-5 bg-zinc-800 border border-zinc-700 rounded-full transition-all duration-200"><div className={`toggle-dot absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full transition-all duration-200 ${invertDisplay ? 'bg-zinc-950 translate-x-4' : 'bg-zinc-400'}`} style={{ backgroundColor: invertDisplay ? displayColor : '#a1a1aa', boxShadow: invertDisplay ? `0 0 6px ${displayColor}` : 'none' }} /></div></label>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-300 font-medium">GRID ON GRAPH</span>
            <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={gridOnGraph} onChange={(e) => setGridOnGraph(e.target.checked)} className="sr-only" /><div className="w-9 h-5 bg-zinc-800 border border-zinc-700 rounded-full transition-all duration-200"><div className={`toggle-dot absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full transition-all duration-200 ${gridOnGraph ? 'bg-zinc-950 translate-x-4' : 'bg-zinc-400'}`} style={{ backgroundColor: gridOnGraph ? displayColor : '#a1a1aa', boxShadow: gridOnGraph ? `0 0 6px ${displayColor}` : 'none' }} /></div></label>
          </div>
        </div>
      </div>
    ),

    // ── CONTROLS PANEL ────────────────────────────────────────────────
    controls: (
      <div className="panel-hardware h-full flex flex-col md:flex-row gap-2 justify-center items-center p-3 bg-black/20 panel-responsive-flex-controls">
        <button onClick={handleConnect} className={`hardware-key py-2.5 px-3.5 flex items-center justify-start gap-3 rounded-lg border text-emerald-500 font-mono font-bold text-xs tracking-wider transition-all duration-300 ${status === 'CONNECTED' ? 'bg-[#101a14] border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'border-zinc-900/50'}`}>
          <Link className="w-4 h-4 text-emerald-500" /><span className="tracking-wider text-[11px]">CONNECT</span>
        </button>
        <button onClick={handleDisconnect} className={`hardware-key py-2.5 px-3.5 flex items-center justify-start gap-3 rounded-lg border text-red-500 font-mono font-bold text-xs tracking-wider transition-all duration-300 ${status === 'DISCONNECTED' ? 'bg-[#1e1112] border-red-500/25 shadow-[0_0_12px_rgba(239,68,68,0.15)]' : 'border-zinc-900/50'}`}>
          <Unlink className="w-4 h-4 text-red-500" /><span className="tracking-wider text-[11px]">DISCONNECT</span>
        </button>
        <button onClick={() => { if (window.confirm("Are you sure you want to force reboot the ESP32?")) { sendMacro("CMD_REBOOT_DEVICE"); } }} className={`hardware-key py-2.5 px-3.5 flex items-center justify-start gap-3 rounded-lg border text-amber-500 font-mono font-bold text-xs tracking-wider transition-all duration-300 ${status === 'REBOOTING' ? 'bg-[#1c1810] border-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.15)]' : 'border-zinc-900/50'}`}>
          <RefreshCw className={`w-4 h-4 text-amber-500 ${status === 'REBOOTING' ? 'animate-spin' : ''}`} /><span className="tracking-wider text-[11px]">REBOOT</span>
        </button>
      </div>
    ),

    // ── D-PAD PANEL ───────────────────────────────────────────────────
    dpad: (
      <div className="panel-hardware h-full bg-[#050506] border border-zinc-900 rounded-xl p-3 shadow-[inset_0_4px_12px_rgba(0,0,0,0.95)] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
          <div className="absolute top-1/2 left-[15%] right-[15%] h-[2px] bg-zinc-800 -translate-y-1/2" />
          <div className="absolute left-1/2 top-[15%] bottom-[15%] w-[2px] bg-zinc-800 -translate-x-1/2" />
        </div>
        <div className="grid grid-cols-3 grid-rows-3 gap-x-2.5 gap-y-2 w-full max-w-[460px] h-full relative z-10">
          <div />
          <div className="flex items-center justify-center">
            <button onPointerDown={() => sendBtn('UP', true)} onPointerUp={() => sendBtn('UP', false)} onPointerLeave={() => sendBtn('UP', false)} onPointerCancel={() => sendBtn('UP', false)} onMouseDown={() => sendBtn('UP', true)} onMouseUp={() => sendBtn('UP', false)} onTouchStart={() => sendBtn('UP', true)} onTouchEnd={() => sendBtn('UP', false)} className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-[#3fc5f0]"><ChevronUp className="w-5 h-5 text-cyan-400" /></button>
          </div>
          <div />
          <div className="flex items-center justify-end">
            <button onPointerDown={() => sendBtn('LEFT', true)} onPointerUp={() => sendBtn('LEFT', false)} onPointerLeave={() => sendBtn('LEFT', false)} onPointerCancel={() => sendBtn('LEFT', false)} onMouseDown={() => sendBtn('LEFT', true)} onMouseUp={() => sendBtn('LEFT', false)} onTouchStart={() => sendBtn('LEFT', true)} onTouchEnd={() => sendBtn('LEFT', false)} className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-[#3fc5f0]"><ChevronLeft className="w-5 h-5 text-cyan-400" /></button>
          </div>
          <div className="flex items-center justify-center">
            <button onPointerDown={() => sendBtn('OK', true)} onPointerUp={() => sendBtn('OK', false)} onPointerLeave={() => sendBtn('OK', false)} onPointerCancel={() => sendBtn('OK', false)} onMouseDown={() => sendBtn('OK', true)} onMouseUp={() => sendBtn('OK', false)} onTouchStart={() => sendBtn('OK', true)} onTouchEnd={() => sendBtn('OK', false)} className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-xs tracking-wider text-[#3fc5f0] border border-cyan-500/20">OK</button>
          </div>
          <div className="flex items-center justify-start">
            <button onPointerDown={() => sendBtn('RIGHT', true)} onPointerUp={() => sendBtn('RIGHT', false)} onPointerLeave={() => sendBtn('RIGHT', false)} onPointerCancel={() => sendBtn('RIGHT', false)} onMouseDown={() => sendBtn('RIGHT', true)} onMouseUp={() => sendBtn('RIGHT', false)} onTouchStart={() => sendBtn('RIGHT', true)} onTouchEnd={() => sendBtn('RIGHT', false)} className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-[#3fc5f0]"><ChevronRight className="w-5 h-5 text-cyan-400" /></button>
          </div>
          <div />
          <div className="flex items-center justify-center">
            <button onPointerDown={() => sendBtn('DOWN', true)} onPointerUp={() => sendBtn('DOWN', false)} onPointerLeave={() => sendBtn('DOWN', false)} onPointerCancel={() => sendBtn('DOWN', false)} onMouseDown={() => sendBtn('DOWN', true)} onMouseUp={() => sendBtn('DOWN', false)} onTouchStart={() => sendBtn('DOWN', true)} onTouchEnd={() => sendBtn('DOWN', false)} className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-[#3fc5f0]"><ChevronDown className="w-5 h-5 text-cyan-400" /></button>
          </div>
          <div className="flex items-center justify-start">
            <button onPointerDown={() => sendBtn('BACK', true)} onPointerUp={() => sendBtn('BACK', false)} onPointerLeave={() => sendBtn('BACK', false)} onPointerCancel={() => sendBtn('BACK', false)} onMouseDown={() => sendBtn('BACK', true)} onMouseUp={() => sendBtn('BACK', false)} onTouchStart={() => sendBtn('BACK', true)} onTouchEnd={() => sendBtn('BACK', false)} className="hardware-key touch-none select-none w-16 h-8 rounded-md font-mono font-bold text-[10px] text-rose-500 hover:text-rose-400 tracking-wider uppercase border border-rose-500/10">BACK</button>
          </div>
        </div>
      </div>
    ),

    // ── MACROS / MODE SELECTORS PANEL ─────────────────────────────────
    macros: (
      <div className="panel-hardware h-full flex flex-col md:flex-row gap-2 justify-center items-center p-3 bg-black/20 panel-responsive-flex-controls">
        <button onPointerDown={() => sendMacro('CMD_OPEN_IR_JAMMER')} onClick={() => sendMacro('CMD_OPEN_IR_JAMMER')} className={`hardware-key py-2.5 px-4 flex items-center justify-start gap-3 rounded-lg border transition-all duration-300 ${activeMode === 'IR JAMMER' ? 'bg-[#0f1b20] text-cyan-400 border-cyan-500/25 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-bold' : 'border-zinc-900/50 text-zinc-400 hover:text-zinc-300'}`}>
          <Activity className={`w-4 h-4 ${activeMode === 'IR JAMMER' ? 'text-cyan-400' : 'text-cyan-600/70'}`} /><span className="text-xs font-mono font-bold tracking-wider">IR JAMMER</span>
        </button>
        <button onPointerDown={() => sendMacro('CMD_OPEN_IR_RECEIVER')} onClick={() => sendMacro('CMD_OPEN_IR_RECEIVER')} className={`hardware-key py-2.5 px-4 flex items-center justify-start gap-3 rounded-lg border transition-all duration-300 ${activeMode === 'IR RECEIVER' ? 'bg-[#101c15] text-emerald-400 border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-bold' : 'border-zinc-900/50 text-zinc-400 hover:text-zinc-300'}`}>
          <Zap className={`w-4 h-4 ${activeMode === 'IR RECEIVER' ? 'text-emerald-400' : 'text-emerald-600/70'}`} /><span className="text-xs font-mono font-bold tracking-wider">IR RECEIVER</span>
        </button>
        <button onPointerDown={() => sendMacro('CMD_OPEN_WIFI_SCAN')} onClick={() => sendMacro('CMD_OPEN_WIFI_SCAN')} className={`hardware-key py-2.5 px-4 flex items-center justify-start gap-3 rounded-lg border transition-all duration-300 ${activeMode === 'IR REMOTE' ? 'bg-[#1c1710] text-amber-400 border-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.15)] font-bold' : 'border-zinc-900/50 text-zinc-400 hover:text-zinc-300'}`}>
          <Tv className={`w-4 h-4 ${activeMode === 'IR REMOTE' ? 'text-amber-400' : 'text-amber-600/70'}`} /><span className="text-xs font-mono font-bold tracking-wider">WIFI SCAN</span>
        </button>
      </div>
    ),

    // ── TELEMETRY PANEL ───────────────────────────────────────────────
    telemetry: (
      <div className="panel-hardware h-full p-3 bg-black/20 flex flex-col gap-3 overflow-hidden">
        <h2 className="text-[9px] font-mono font-bold tracking-widest text-zinc-500">TELEMETRY</h2>
        <div className="flex flex-col md:flex-row gap-2 flex-1 panel-responsive-flex-telemetry">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 tracking-wider font-mono font-bold">STATUS</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${status === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : status === 'DISCONNECTED' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-amber-500 animate-pulse'}`} />
              <span className="text-xs font-mono font-semibold text-zinc-200">{status}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 tracking-wider font-mono font-bold">IP</span>
            <span className="text-xs font-mono text-zinc-300">{ipAddress || '192.168.4.1'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 tracking-wider font-mono font-bold">UPTIME</span>
            <span className="text-xs font-mono text-zinc-300 tabular-nums">{formatUptime(uptimeSeconds)}</span>
          </div>
        </div>
      </div>
    ),

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [logs, showTimestamps, isLogsPaused, isRawAgentMode, terminalStyle, logLevel, displayColor, displayColorRgb, invertDisplay, gridOnGraph, brightness, status, ipAddress, uptimeSeconds, activeMode, imageError, colorWheelCursor, showAboutModal]);

  return (
    <div className="flex w-screen h-screen bg-[#020304] overflow-hidden font-sans select-none overflow-x-hidden">
      {/* Main SATAN Dashboard — Workspace Engine */}
      <div className="flex-1 flex flex-col h-full w-full bg-[#020304]"
        style={{
          '--display-color': displayColor,
          '--display-color-rgb': displayColorRgb,
        } as React.CSSProperties}
      >
        {/* WORKSPACE ENGINE — renders all panels from registry */}
        <WorkspaceCanvas 
          panelContents={panelContents} 
          onSendSerialCommand={(cmd) => {
            if (status === 'CONNECTED') {
              sendMacro(cmd);
            } else {
              alert("Serial connection required to execute command.");
            }
          }}
        />
      </div>

      {/* SYSTEM ARCHITECTURE & ABOUT MODAL */}
      {showAboutModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setShowAboutModal(false)}
        >
          <div 
            className="bg-[#050608]/95 border border-zinc-800/80 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 bg-[#080a0e]/95 select-none">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/30 flex items-center justify-center text-indigo-400">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold font-mono tracking-widest text-zinc-100 uppercase">SATAN — SYSTEM ARCHITECTURE</h2>
                  <p className="text-[10px] font-mono text-zinc-500 mt-0.5">Version 1.1.0 (Current Release)</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAboutModal(false)} 
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 font-mono text-xs select-text cyberdeck-scrollbar bg-[#030406]">
              {/* Visual System Architecture Diagram - "God Level Visual Map" */}
              <div className="bg-[#07090d]/90 border border-zinc-800/60 rounded-xl p-6 relative overflow-hidden shadow-[inset_0_4px_24px_rgba(0,0,0,0.6)]">
                <div className="flex justify-between items-center mb-6 border-b border-zinc-800/40 pb-3">
                  <h3 className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                    SYSTEM TOPOLOGY & DATA STREAM FLOWS
                  </h3>
                  <div className="flex gap-4 text-[9px] text-zinc-500">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-indigo-500/20 border border-indigo-500/50" /> FRONTEND</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-cyan-500/20 border border-cyan-500/50" /> BRIDGE</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-purple-500/20 border border-purple-500/50" /> AI CORE</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-red-500/20 border border-red-500/50" /> ESP32</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 relative min-h-[300px]">
                  
                  {/* Column 1: CLIENT FRONTEND (Vite/React) */}
                  <div className="bg-[#0b0f16]/90 border border-indigo-950/60 rounded-xl p-4 flex flex-col justify-between shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">FRONTEND</span>
                        <span className="text-[8px] bg-indigo-950 text-indigo-300 font-bold px-1 rounded-sm border border-indigo-800/40">ONLINE</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-100 block">Vite + React SPA</span>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Executes the cyberdeck interface, mirrors OLED frame buffers, and formats serial telemetry stream.</p>
                    </div>
                    <div className="mt-4 border-t border-zinc-900/60 pt-3 space-y-2 text-[10px]">
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        Workspace engine
                        <span className="text-[8px] text-zinc-600 block font-normal">IndexedDB profiles</span>
                      </div>
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        OLED mirror component
                        <span className="text-[8px] text-zinc-600 block font-normal">Pixel grid mapping</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: DATA CONNECTION BRIDGE (WebSerial) */}
                  <div className="bg-[#0b0f16]/90 border border-cyan-950/60 rounded-xl p-4 flex flex-col justify-between shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">BRIDGE</span>
                        <span className="text-[8px] bg-cyan-950 text-cyan-300 font-bold px-1 rounded-sm border border-cyan-800/40">115200 BAUD</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-100 block">WebSerial Bridge</span>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Direct byte stream pipe executing inside Chromium sandbox to communicate with ESP32.</p>
                    </div>
                    <div className="mt-4 border-t border-zinc-900/60 pt-3 space-y-2 text-[10px]">
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        Auto-reconnect handler
                        <span className="text-[8px] text-zinc-600 block font-normal">Serial handshake</span>
                      </div>
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        Buffer stream parser
                        <span className="text-[8px] text-zinc-600 block font-normal">ANSI code cleanup</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: AI DIAGNOSTICS SYSTEM (v1.1.0 Active) */}
                  <div className="bg-[#0b0f16]/90 border border-purple-950/60 rounded-xl p-4 flex flex-col justify-between shadow-[0_0_15px_rgba(168,85,247,0.05)]">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">AI DIAGNOSTICS</span>
                        <span className="text-[8px] bg-purple-950 text-purple-300 font-bold px-1 rounded-sm border border-purple-800/40">ACTIVE (v1.1.0)</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-100 block">LLM Adapters</span>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Direct API stream analyzing serial console output, resolving anomalies, and compiling reports.</p>
                    </div>
                    <div className="mt-4 border-t border-zinc-900/60 pt-3 space-y-2 text-[10px]">
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        Gemini & OpenAI API
                        <span className="text-[8px] text-zinc-600 block font-normal">Prompt orchestrator</span>
                      </div>
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        Auto Diagnostic engine
                        <span className="text-[8px] text-zinc-600 block font-normal">Anomaly identification</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 4: HARDWARE TARGET (ESP32) */}
                  <div className="bg-[#0b0f16]/90 border border-red-950/60 rounded-xl p-4 flex flex-col justify-between shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">MCU TARGET</span>
                        <span className="text-[8px] bg-red-950 text-red-300 font-bold px-1 rounded-sm border border-red-800/40">ESP32</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-100 block">ESP32 Core Device</span>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Runs firmware (TetraX / BWifiKill), executes IR transceivers, and handles serial console packets.</p>
                    </div>
                    <div className="mt-4 border-t border-zinc-900/60 pt-3 space-y-2 text-[10px]">
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        OLED frame buffer
                        <span className="text-[8px] text-zinc-600 block font-normal">Mirror output stream</span>
                      </div>
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        IR transceiver array
                        <span className="text-[8px] text-zinc-600 block font-normal">Transmissions & captures</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 5: REMOTE BACKEND & STORAGE (Planned) */}
                  <div className="bg-[#0b0f16]/90 border border-emerald-950/60 rounded-xl p-4 flex flex-col justify-between shadow-[0_0_15px_rgba(16,185,129,0.05)] opacity-60">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">REMOTE SERVICES</span>
                        <span className="text-[8px] bg-zinc-900 text-zinc-400 font-bold px-1 rounded-sm border border-zinc-800/40">ROADMAP</span>
                      </div>
                      <span className="text-xs font-bold text-zinc-100 block">Express API Backend</span>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">Central storage repository supporting OTA firmware uploads and user profiles.</p>
                    </div>
                    <div className="mt-4 border-t border-zinc-900/60 pt-3 space-y-2 text-[10px]">
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        AWS S3 storage store
                        <span className="text-[8px] text-zinc-600 block font-normal">Binary OTA firmware</span>
                      </div>
                      <div className="bg-black/35 border border-zinc-900/40 p-1.5 rounded font-bold text-zinc-400">
                        PostgreSQL Database
                        <span className="text-[8px] text-zinc-600 block font-normal">Fleet management registry</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Connecting Flow Lines Overlay */}
                  <div className="absolute inset-0 pointer-events-none hidden lg:block" style={{ zIndex: 1 }}>
                    <svg className="w-full h-full" style={{ position: 'absolute', top: 0, left: 0 }}>
                      <path d="M 18% 50% L 21% 50%" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" strokeDasharray="4,4" fill="none" />
                      <path d="M 38% 50% L 61% 50%" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1.5" strokeDasharray="4,4" fill="none" />
                      <path d="M 18% 30% Q 25% 15% 41% 30%" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5" strokeDasharray="4,4" fill="none" />
                      <path d="M 78% 70% Q 50% 85% 18% 70%" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1.5" strokeDasharray="4,4" fill="none" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* What's New & Roadmap Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* What's New section */}
                <div className="space-y-4">
                  <h3 className="text-zinc-300 font-bold uppercase tracking-wider text-[10px] border-b border-zinc-800 pb-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#6366f1] rounded-full" />
                    WHAT'S NEW IN v1.1.0
                  </h3>
                  <ul className="space-y-3.5 text-[10px] text-zinc-400 leading-relaxed list-none pl-0">
                    <li className="flex gap-2">
                      <span className="text-indigo-400 shrink-0 select-none">■</span>
                      <div>
                        <strong className="text-zinc-300">AI Diagnostics Integration (Gemini / OpenAI API):</strong>
                        <p className="mt-0.5 text-zinc-500">Implemented real-time console log diagnostics and auto-troubleshooting loop via LLM adapters. Initially planned for future roadmap, fully deployed in v1.1.0.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-400 shrink-0 select-none">■</span>
                      <div>
                        <strong className="text-zinc-300">Multi-Profile Layout Switcher:</strong>
                        <p className="mt-0.5 text-zinc-500">Create, switch, rename, and delete layout profiles directly from the tab manager bar.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-400 shrink-0 select-none">■</span>
                      <div>
                        <strong className="text-zinc-300">Mouse Multi-Selection Mode:</strong>
                        <p className="mt-0.5 text-zinc-500">Accumulate selections by clicking on panels without needing key modifiers. Accessible via the MULTI-SELECT toolbar button.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-400 shrink-0 select-none">■</span>
                      <div>
                        <strong className="text-zinc-300">Keyboard Arrow Key Navigation:</strong>
                        <p className="mt-0.5 text-zinc-500">Precise 1px nudges (or 10px with Shift held) using Arrow keys. Toggleable with the KEYS MOVE control.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-400 shrink-0 select-none">■</span>
                      <div>
                        <strong className="text-zinc-300">Figma-Style Smart Snapping & Spacing Rules:</strong>
                        <p className="mt-0.5 text-zinc-500">Snap margins automatically to 16px and 24px, display alignment axes, and spacing indicators.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-400 shrink-0 select-none">■</span>
                      <div>
                        <strong className="text-zinc-300">Layout Safety & Health Score:</strong>
                        <p className="mt-0.5 text-zinc-500">Live evaluation score from 0-100% displaying spacing imbalances, edge boundary crossings, and overlap errors.</p>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Roadmap / Upcoming section */}
                <div className="space-y-4">
                  <h3 className="text-zinc-300 font-bold uppercase tracking-wider text-[10px] border-b border-zinc-800 pb-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full" />
                    UPCOMING ROADMAP
                  </h3>
                  <ul className="space-y-3.5 text-[10px] text-zinc-400 leading-relaxed list-none pl-0">
                    <li className="flex gap-2">
                      <span className="text-emerald-400 shrink-0 select-none">□</span>
                      <div>
                        <strong className="text-zinc-300">v1.2.0: Web Firmware Flasher (WebSerial)</strong>
                        <p className="mt-0.5 text-zinc-500">Drag-and-drop .bin compilation binaries directly into browser to write/flash over bootloader.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-400 shrink-0 select-none">□</span>
                      <div>
                        <strong className="text-zinc-300">v1.3.0: Universal Device Profiles</strong>
                        <p className="mt-0.5 text-zinc-500">Standardized handshake auto-detecting connected hardware variants (TetraX, Blue-Box, BruceForce) and loading corresponding sub-panels.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-400 shrink-0 select-none">□</span>
                      <div>
                        <strong className="text-zinc-300">v1.4.0: OTA Update Orchestration</strong>
                        <p className="mt-0.5 text-zinc-500">Initiate secure WiFi network firmware rollouts directly from the control console.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-400 shrink-0 select-none">□</span>
                      <div>
                        <strong className="text-zinc-300">v1.5.0: Multi-Device Dashboard</strong>
                        <p className="mt-0.5 text-zinc-500">Simultaneously connect and view multiple ESP32 devices on a split screen layout with fleet command broadcast capability.</p>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-400 shrink-0 select-none">□</span>
                      <div>
                        <strong className="text-zinc-300">v2.0.0: Node.js Backend & Fleet Database</strong>
                        <p className="mt-0.5 text-zinc-500">Centralized database tracking hardware logs, client fleet mappings, and multi-tenant security profiles.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-3 border-t border-zinc-800/60 bg-[#080a0e]/95 flex justify-between items-center text-[9px] font-mono text-zinc-600 select-none">
              <span>PROJECT: TETRAX / BWIFIKILL</span>
              <span>DEVELOPER: MXSOURAV</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
