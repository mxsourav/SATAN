import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Unlink
} from 'lucide-react';

import { useWebSerial } from './useWebSerial';

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

  const onLogParsed = useCallback((log) => {
    if (isLogsPausedRef.current) return;
    const viewport = terminalViewportRef.current;
    const anchor = terminalAnchorRef.current;
    if (!viewport || !anchor) return;

    const lineDiv = document.createElement('div');
    lineDiv.className = 'break-all';

    if (showTimestampsRef.current) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'text-zinc-600 mr-2 select-none';
      timeSpan.innerText = log.time;
      lineDiv.appendChild(timeSpan);
    }
    
    const tagSpan = document.createElement('span');
    tagSpan.className = `${log.color} ${log.bold ? 'font-bold' : ''}`;
    tagSpan.innerText = log.tag;
    lineDiv.appendChild(tagSpan);

    const textSpan = document.createElement('span');
    textSpan.className = `${log.color || 'text-zinc-300'} ml-1.5`;
    textSpan.innerText = log.text;
    lineDiv.appendChild(textSpan);

    viewport.insertBefore(lineDiv, anchor);
    lineCountRef.current++;

    while (lineCountRef.current > 1500 && viewport.firstChild !== anchor) {
      if (viewport.firstChild) {
        viewport.removeChild(viewport.firstChild);
        lineCountRef.current--;
      }
    }

    if (autoScrollEnabledRef.current) {
      anchor.scrollIntoView();
    }
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
    const viewport = terminalViewportRef.current;
    const anchor = terminalAnchorRef.current;
    if (viewport && anchor) {
      while (viewport.firstChild !== anchor) {
        if (viewport.firstChild) viewport.removeChild(viewport.firstChild);
      }
      lineCountRef.current = 0;
    }
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
  const [isLogsPaused, setIsLogsPaused] = useState(false);

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

  return (
    <div 
      className="flex-1 flex flex-col h-full max-w-7xl mx-auto w-full select-none"
      style={{
        '--display-color': displayColor,
        '--display-color-rgb': displayColorRgb,
      } as React.CSSProperties}
    >
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0 relative w-full">
        <div className="flex items-center gap-3.5 mr-auto">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.6)] border border-indigo-400/30">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-sans tracking-tight uppercase text-zinc-100">
                BWifiKill
              </h1>
              <span className="text-[10px] font-mono border border-zinc-800 font-bold bg-zinc-900 text-zinc-300 rounded px-1.5 py-0.5">
                V4.0
              </span>
            </div>
            <div className="text-xs text-zinc-500 font-mono tracking-wider uppercase font-semibold mt-0.5">
              ESP32 Cyberdeck Controller
            </div>
          </div>
        </div>

        {/* ESP32 Real-time Stats Panel */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden lg:flex gap-6 panel-hardware px-5 py-2.5 items-center bg-black/40">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 tracking-wider font-mono font-bold mb-0.5">ESP32 STATUS</span>
            <div className="flex items-center gap-2">
              <div 
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  status === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 
                  status === 'DISCONNECTED' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className="text-xs font-mono font-semibold text-zinc-200">{status}</span>
            </div>
          </div>
          <div className="h-6 w-[1px] bg-zinc-800/80" />
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 tracking-wider font-mono font-bold mb-0.5">IP ADDRESS</span>
            <span className="text-xs font-mono text-zinc-300">{ipAddress || '192.168.4.1'}</span>
          </div>
          <div className="h-6 w-[1px] bg-zinc-800/80" />
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 tracking-wider font-mono font-bold mb-0.5">UPTIME</span>
            <span className="text-xs font-mono text-zinc-300 transition-all tabular-nums">{formatUptime(uptimeSeconds)}</span>
          </div>
        </div>

        {/* Realistic Transmit and Receive Diode Status - Rectangular */}
        <div className="flex gap-3 h-[52px] shrink-0 ml-auto">
          {/* Red LED Diode for Transmitter */}
          <div className="panel-hardware flex flex-row items-center justify-between px-4 py-2 relative bg-black/30 gap-4 min-w-[140px]">
            <span className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider">IR TX</span>
            <div className="relative flex items-center justify-center">
              
              {/* SVG 3D Red Diode */}
              <svg className="w-8 h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] rotate-90" viewBox="0 0 40 40">
                {/* Metal legs */}
                <line x1="16" y1="24" x2="16" y2="38" stroke="#555" strokeWidth="1.5" />
                <line x1="24" y1="24" x2="24" y2="35" stroke="#444" strokeWidth="1.5" />
                {/* Base spacer plate */}
                <ellipse cx="20" cy="24" rx="7" ry="1.5" fill="#333" />
                {/* LED glass body */}
                <path d="M13,24 L13,15 A7,7 0 0,1 27,15 L27,24 Z" fill="url(#redLedGradient)" />
                {/* Cathode inside */}
                <path d="M15,20 L18,17 L18,22" stroke="#d4d4d8" strokeWidth="1" fill="none" opacity="0.6" />
                <path d="M25,21 L22,18 L22,23" stroke="#94a3b8" strokeWidth="1.5" fill="none" opacity="0.8" />
                
                <defs>
                  <linearGradient id="redLedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#991b1b" />
                    <stop offset="30%" stopColor="#ef4444" />
                    <stop offset="70%" stopColor="#f87171" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Transmitter active light overlay waves */}
              {isTransmitting && status === 'CONNECTED' && (
                <div className="absolute top-0 flex items-center justify-center pointer-events-none">
                  {/* Glowing aura */}
                  <div className="absolute w-6 h-6 rounded-full bg-red-500/35 blur-md animate-pulse" />
                  {/* Signal arcs */}
                  <div className="absolute w-10 h-10 rounded-full border border-red-500/40 animate-ping opacity-75" />
                  <div className="absolute w-14 h-14 rounded-full border-t border-b border-red-400/20 animate-[ping_1.5s_infinite] opacity-40" />
                </div>
              )}
            </div>
          </div>

          {/* Cyan/Blue IR Receiver Photodiode */}
          <div className="panel-hardware flex flex-row items-center justify-between px-4 py-2 relative bg-black/30 gap-4 min-w-[140px]">
            <span className="text-[10px] font-mono font-bold text-zinc-500 tracking-wider">IR RX</span>
            <div className="relative flex items-center justify-center">
              
              {/* SVG 3D Receiver Component */}
              <svg className="w-8 h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] rotate-90" viewBox="0 0 40 40">
                {/* Metal legs */}
                <line x1="15" y1="26" x2="15" y2="38" stroke="#444" strokeWidth="1.5" />
                <line x1="20" y1="26" x2="20" y2="35" stroke="#555" strokeWidth="1.5" />
                <line x1="25" y1="26" x2="25" y2="38" stroke="#444" strokeWidth="1.5" />
                {/* Metal shield bracket */}
                <rect x="11" y="10" width="18" height="16" rx="1.5" fill="#2d3748" stroke="#1a202c" strokeWidth="1" />
                {/* Internal lens dome */}
                <circle cx="20" cy="18" r="5" fill="url(#receiverDomeGradient)" />
                {/* Metal mesh grid */}
                <line x1="14" y1="12" x2="14" y2="24" stroke="#4a5568" strokeWidth="1" opacity="0.5" />
                <line x1="26" y1="12" x2="26" y2="24" stroke="#4a5568" strokeWidth="1" opacity="0.5" />
                
                <defs>
                  <linearGradient id="receiverDomeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1a365d" />
                    <stop offset="40%" stopColor="#2b6cb0" />
                    <stop offset="80%" stopColor="#0f172a" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Receiver active light waves */}
              {isReceiving && status === 'CONNECTED' && (
                <div className="absolute top-0 flex items-center justify-center pointer-events-none">
                  <div className="absolute w-6 h-6 rounded-full bg-cyan-500/25 blur-md" />
                  <div className="absolute w-10 h-10 rounded-full border border-cyan-400/50 animate-ping" />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* THREE COLUMN MAIN SECTION */}
      <main className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden min-h-0 h-full max-h-full mb-4">
        
        {/* LEFT COLUMN: SERIAL LOG TERMINAL */}
        <div className="lg:w-1/4 relative min-h-[300px] lg:min-h-0 h-full shrink-0">
          <div id="serial-log-panel" className="absolute inset-0 flex flex-col panel-hardware overflow-hidden bg-black/20">
            <div className="flex justify-between items-center border-b border-zinc-800/80 p-4 pb-2.5 shrink-0">
              <h2 className="text-[10px] font-bold font-mono tracking-widest text-zinc-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-ping" />
                SERIAL LOG
              </h2>
              <div className="flex gap-2 text-[10px] font-mono text-zinc-500">
                <button 
                  onClick={clearLogs}
                  className="hover:text-white transition-colors bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 flex items-center gap-1 active:bg-black"
                  title="Clear Logs"
                >
                  <Trash2 className="w-3 h-3" /> CLEAR
                </button>
                <button 
                  onClick={() => { showTimestampsRef.current = !showTimestampsRef.current; setShowTimestamps(showTimestampsRef.current); }}
                  className={`transition-colors border rounded px-1.5 py-0.5 flex items-center gap-1 active:bg-black ${
                    showTimestamps ? 'bg-zinc-900 border-zinc-800 hover:text-white' : 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
                  }`}
                  title="Toggle Timestamps"
                >
                  TIME
                </button>
                <button 
                  onClick={() => { isLogsPausedRef.current = !isLogsPausedRef.current; setIsLogsPaused(isLogsPausedRef.current); }}
                  className={`transition-colors border rounded px-1.5 py-0.5 flex items-center gap-1 active:bg-black ${
                    isLogsPaused ? 'bg-amber-950/40 border-amber-800 text-amber-400' : 'bg-zinc-900 border-zinc-800 hover:text-white'
                  }`}
                  title={isLogsPaused ? 'Resume Logging' : 'Pause Logging'}
                >
                  {isLogsPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3" />} 
                  {isLogsPaused ? 'RESUME' : 'PAUSE'}
                </button>
              </div>
            </div>

            <div 
              onScroll={handleTerminalScroll}
              ref={terminalViewportRef}
              className="flex-1 overflow-y-auto min-h-0 pt-2 pb-2 pl-4 pr-2 font-mono text-left text-[11px] leading-[1.3] space-y-0.5 select-text cyberdeck-scrollbar bg-[#080a0e]/95 shadow-[inset_0_4px_24px_rgba(0,0,0,0.8)]"
            >
              <div ref={terminalAnchorRef} />
            </div>

            {/* Log Settings Dropdown */}
            <div className="px-4 pb-4 pt-3 border-t border-zinc-800/80 flex justify-between items-center shrink-0">
              <span className="text-[10px] font-mono font-bold text-zinc-500">DIAG LEVEL</span>
              <select 
                value={logLevel} 
                onChange={(e) => setLogLevel(e.target.value as any)}
                className="bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-400 rounded px-2 py-1 focus:ring-1 focus:ring-zinc-700 focus:outline-none transition-all cursor-pointer h-6"
              >
                <option value="INFO">INFO</option>
                <option value="DEBUG">DEBUG</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: HIGH-FIDELITY OLED BOARD */}
        <div className="flex-1 flex justify-center items-center p-2 lg:p-4 panel-hardware bg-black/40 min-h-[350px] lg:min-h-0 relative">
          
          {/* Main PCB layout card - uses real oled.png as background */}
          <div className="relative w-full max-w-[1200px] max-h-full aspect-square flex flex-col items-center justify-center select-none shadow-2xl">
            
            {/* The Raw OLED device module background */}
            <img 
              src="/oled.png" 
              alt="OLED PCB Board" 
              className={`w-full h-full object-contain pointer-events-none drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] ${imageError ? 'hidden' : 'block'}`}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />

            {/* HIGH-FIDELITY CSS FALLBACK (Shown only if oled.png is missing) */}
            {imageError && (
              <div 
                id="pcb-fallback-container"
                className="absolute inset-0 rounded-2xl border-2 border-zinc-800 bg-[#0e0e0e] flex flex-col items-center justify-center p-8 shadow-2xl"
              >
                {/* Gold corners */}
                <div className="absolute top-4 left-4 w-6 h-6 rounded-full border-[5px] border-[#c5a059] bg-[#050505] shadow-inner" />
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full border-[5px] border-[#c5a059] bg-[#050505] shadow-inner" />
                <div className="absolute bottom-4 left-4 w-6 h-6 rounded-full border-[5px] border-[#c5a059] bg-[#050505] shadow-inner" />
                <div className="absolute bottom-4 right-4 w-6 h-6 rounded-full border-[5px] border-[#c5a059] bg-[#050505] shadow-inner" />
                
                {/* Header block */}
                <div className="absolute top-4 border border-zinc-700/60 p-1 px-3 rounded-md bg-[#050505] flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 border border-amber-300" />
                  <div className="w-2 h-2 rounded-full bg-amber-500 border border-amber-300" />
                  <div className="w-2 h-2 rounded-full bg-amber-500 border border-amber-300" />
                  <div className="w-2 h-2 rounded-full bg-amber-500 border border-amber-300" />
                </div>
                <div className="absolute top-11 text-[9px] font-mono text-zinc-500 flex gap-2">
                  <span>VCC</span><span>GND</span><span>SCL</span><span>SDA</span>
                </div>
                
                {/* Screen Bezel fallback */}
                <div className="w-[82%] aspect-[1.8] rounded-xl border-[4px] border-zinc-900 bg-black flex items-center justify-center p-3 relative shadow-2xl" />

                {/* Ribbon cable */}
                <div className="absolute bottom-4 w-32 h-14 bg-gradient-to-b from-zinc-900 to-black border border-zinc-800 rounded-b-md flex justify-center items-end pb-1 shadow-inner">
                  <div className="w-24 h-1.5 bg-[#c5a059]/40 rounded-sm flex justify-around px-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="w-[2px] h-full bg-[#c5a059]/80" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DYNAMIC SCREEN OVERLAY */}
            <div 
              id="oled-screen-layer"
              className="absolute z-10 overflow-hidden select-none transition-all duration-300 flex items-center justify-center"
              style={{
                left: '18%',
                top: '29.5%',
                width: '64%',
                height: '32%',
                backgroundColor: invertDisplay ? displayColor : '#040508',
                filter: `brightness(${brightness}%)`,
              }}
            >
              {/* Real Mirror Canvas */}
              <canvas 
                ref={oledCanvasRef}
                width={128}
                height={64}
                className="w-full h-full"
                style={{ 
                  imageRendering: 'pixelated',
                  mixBlendMode: invertDisplay ? 'normal' : 'screen', 
                  opacity: 0.95,
                  filter: invertDisplay ? 'invert(1)' : 'none'
                }}
              />
              
              {/* Tint Layer */}
              {!invertDisplay && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundColor: displayColor,
                    mixBlendMode: 'multiply'
                  }}
                />
              )}

              {/* Pixel grid overlay */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-[0.25]"
                style={{
                  backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.85) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.85) 1px, transparent 1px)',
                  backgroundSize: '0.78125% 1.5625%'
                }}
              />

              {/* Scanline overlay */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-[0.15]"
                style={{
                  backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.7) 50%)',
                  backgroundSize: '100% 3.125%'
                }}
              />
            </div>

            {/* Corner labels matching the physical OLED */}
            <div className="absolute bottom-[20.5%] left-[13%] text-[8px] text-zinc-500 font-mono tracking-wide">A0K1</div>
            <div className="absolute bottom-[20.5%] right-[13%] text-[8px] text-zinc-500 font-mono tracking-wide">1104</div>

          </div>
        </div>

        {/* RIGHT COLUMN: HARDWARE CONTROLS */}
        <div className="lg:w-1/4 flex flex-col gap-4">

          {/* OLED COLOR PICKER PANEL */}
          <div className="panel-hardware p-4 flex-1 flex flex-col justify-between bg-black/10">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h2 className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 flex items-center gap-1.5">
                OLED COLOR
              </h2>
              <button 
                onClick={() => handlePresetSelect('#00ffff', '0, 255, 255')}
                className="text-zinc-500 hover:text-white transition-all active:rotate-180 duration-300"
                title="Reset to default Cyan"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Conic Wheel & Preview Container */}
            <div className="flex gap-3 items-center">
              {/* Color Wheel */}
              <div 
                id="color-wheel"
                ref={colorWheelRef}
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  const handleMove = (ev: React.PointerEvent) => handleColorWheelSelect(ev.clientX, ev.clientY);
                  (e.target as HTMLElement).onpointermove = handleMove as any;
                  handleColorWheelSelect(e.clientX, e.clientY);
                }}
                onPointerUp={(e) => {
                  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                  (e.target as HTMLElement).onpointermove = null;
                }}
                className="w-28 h-28 touch-none select-none rounded-full cursor-crosshair color-wheel-conic shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_2px_10px_rgba(0,0,0,0.4)] border border-zinc-800 relative shrink-0"
              >
                 {/* Center mask to make it look like a ring */}
                 <div className="absolute inset-0 m-auto w-8 h-8 bg-zinc-900 rounded-full border border-zinc-800 shadow-[0_2px_6px_rgba(0,0,0,0.9)] pointer-events-none" />
                 
                 {/* Target cursor indicator */}
                 <div 
                   className="absolute w-3.5 h-3.5 rounded-full bg-white border border-zinc-950 shadow-lg pointer-events-none -translate-x-1.75 -translate-y-1.75 transition-all duration-75"
                   style={{
                     left: `${colorWheelCursor.x}px`,
                     top: `${colorWheelCursor.y}px`
                   }}
                 />
              </div>

              {/* Preview Box & RGB Text */}
              <div className="flex-1 flex flex-col gap-2 p-2 bg-zinc-950/50 rounded-lg border border-zinc-800/80">
                <div 
                  className="w-full h-10 rounded border border-zinc-900 shadow-md transition-colors"
                  style={{ backgroundColor: displayColor }}
                />
                <div className="text-[10px] font-mono text-zinc-400 font-bold leading-tight flex flex-col">
                  <span>R: {displayColorRgb.split(',')[0]}</span>
                  <span>G: {displayColorRgb.split(',')[1]}</span>
                  <span>B: {displayColorRgb.split(',')[2]}</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-zinc-800/80 my-3 w-full" />
            {/* Color Presets Row */}
            <div className="flex justify-between items-center px-1 pt-1">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset.hex, preset.rgb)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${displayColor === preset.hex ? 'border-zinc-300 scale-110 shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'border-transparent opacity-80 hover:scale-110'}`}
                  style={{ backgroundColor: preset.hex }}
                  title={`Preset ${preset.name}`}
                />
              ))}
            </div>



            <div className="h-px bg-zinc-800/80 my-3 w-full" />
            {/* DISPLAY SETTINGS TOGGLES */}
            <div className="space-y-3 shrink-0">
              <h3 className="text-[9px] font-mono font-bold tracking-widest text-zinc-500">DISPLAY SETTINGS</h3>
              
              {/* Invert Toggle */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-300 font-medium">INVERT DISPLAY</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={invertDisplay}
                    onChange={(e) => setInvertDisplay(e.target.checked)}
                    className="sr-only"
                  />
                  <div className="w-9 h-5 bg-zinc-800 border border-zinc-700 rounded-full transition-all duration-200">
                    <div 
                      className={`toggle-dot absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                        invertDisplay ? 'bg-zinc-950 translate-x-4' : 'bg-zinc-400'
                      }`}
                      style={{
                        backgroundColor: invertDisplay ? displayColor : '#a1a1aa',
                        boxShadow: invertDisplay ? `0 0 6px ${displayColor}` : 'none'
                      }}
                    />
                  </div>
                </label>
              </div>

              {/* Grid Toggle */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-300 font-medium">GRID ON GRAPH</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={gridOnGraph}
                    onChange={(e) => setGridOnGraph(e.target.checked)}
                    className="sr-only"
                  />
                  <div className="w-9 h-5 bg-zinc-800 border border-zinc-700 rounded-full transition-all duration-200">
                    <div 
                      className={`toggle-dot absolute top-[3px] left-[3px] w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                        gridOnGraph ? 'bg-zinc-950 translate-x-4' : 'bg-zinc-400'
                      }`}
                      style={{
                        backgroundColor: gridOnGraph ? displayColor : '#a1a1aa',
                        boxShadow: gridOnGraph ? `0 0 6px ${displayColor}` : 'none'
                      }}
                    />
                  </div>
                </label>
              </div>

              

            </div>

          </div>
        </div>
      </main>

      {/* BOTTOM HARDWARE NAVIGATION/BUTTON RAIL */}
      
        <div className="mt-auto flex flex-col lg:flex-row justify-between items-stretch gap-4 shrink-0 pb-2 relative z-10 bg-[#070709] border border-zinc-900/80 rounded-2xl p-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.03)] select-none">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/20 to-transparent pointer-events-none" />

          {/* Left Column: System Connection Actions */}
          <div className="flex flex-col gap-2 justify-center w-full lg:w-[220px] shrink-0 p-1 relative z-10">
            <button 
              onClick={handleConnect}
              className={`hardware-key py-2.5 px-3.5 flex items-center justify-start gap-3 rounded-lg border text-emerald-500 font-mono font-bold text-xs tracking-wider transition-all duration-300 ${
                status === 'CONNECTED' ? 'bg-[#101a14] border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'border-zinc-900/50'
              }`}
            >
              <Link className="w-4 h-4 text-emerald-500" />
              <span className="tracking-wider text-[11px]">CONNECT</span>
            </button>
            
            <button 
              onClick={handleDisconnect}
              className={`hardware-key py-2.5 px-3.5 flex items-center justify-start gap-3 rounded-lg border text-red-500 font-mono font-bold text-xs tracking-wider transition-all duration-300 ${
                status === 'DISCONNECTED' ? 'bg-[#1e1112] border-red-500/25 shadow-[0_0_12px_rgba(239,68,68,0.15)]' : 'border-zinc-900/50'
              }`}
            >
              <Unlink className="w-4 h-4 text-red-500" />
              <span className="tracking-wider text-[11px]">DISCONNECT</span>
            </button>

            <button 
              onClick={() => {
                if (window.confirm("Are you sure you want to force reboot the ESP32?")) {
                  sendMacro("CMD_REBOOT_DEVICE");
                }
              }}
              className={`hardware-key py-2.5 px-3.5 flex items-center justify-start gap-3 rounded-lg border text-amber-500 font-mono font-bold text-xs tracking-wider transition-all duration-300 ${
                status === 'REBOOTING' ? 'bg-[#1c1810] border-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.15)]' : 'border-zinc-900/50'
              }`}
            >
              <RefreshCw className={`w-4 h-4 text-amber-500 ${status === 'REBOOTING' ? 'animate-spin' : ''}`} />
              <span className="tracking-wider text-[11px]">REBOOT</span>
            </button>
          </div>

          {/* Center Column: Interactive Navigation D-Pad */}
          <div className="flex-1 min-h-[145px] bg-[#050506] border border-zinc-900 rounded-xl p-3 shadow-[inset_0_4px_12px_rgba(0,0,0,0.95)] relative overflow-hidden flex items-center justify-center">
            <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
              <div className="absolute top-1/2 left-[15%] right-[15%] h-[2px] bg-zinc-800 -translate-y-1/2" />
              <div className="absolute left-1/2 top-[15%] bottom-[15%] w-[2px] bg-zinc-800 -translate-x-1/2" />
            </div>

            {/* D-Pad 3x3 Button Grid */}
            <div className="grid grid-cols-3 grid-rows-3 gap-x-2.5 gap-y-2 w-full max-w-[460px] h-full relative z-10">
              {/* Row 1: UP button in middle column */}
              <div />
              <div className="flex items-center justify-center">
                <button 
                  onPointerDown={() => sendBtn('UP', true)}
                  onPointerUp={() => sendBtn('UP', false)}
                  onPointerLeave={() => sendBtn('UP', false)} onPointerCancel={() => sendBtn('UP', false)}
                  onMouseDown={() => sendBtn('UP', true)}
                  onMouseUp={() => sendBtn('UP', false)}
                  onTouchStart={() => sendBtn('UP', true)}
                  onTouchEnd={() => sendBtn('UP', false)}
                  className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-[#3fc5f0]"
                >
                  <ChevronUp className="w-5 h-5 text-cyan-400" />
                </button>
              </div>
              <div />

              {/* Row 2: LEFT, OK, RIGHT */}
              <div className="flex items-center justify-end">
                <button 
                  onPointerDown={() => sendBtn('LEFT', true)}
                  onPointerUp={() => sendBtn('LEFT', false)}
                  onPointerLeave={() => sendBtn('LEFT', false)} onPointerCancel={() => sendBtn('LEFT', false)}
                  onMouseDown={() => sendBtn('LEFT', true)}
                  onMouseUp={() => sendBtn('LEFT', false)}
                  onTouchStart={() => sendBtn('LEFT', true)}
                  onTouchEnd={() => sendBtn('LEFT', false)}
                  className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-[#3fc5f0]"
                >
                  <ChevronLeft className="w-5 h-5 text-cyan-400" />
                </button>
              </div>
              <div className="flex items-center justify-center">
                <button 
                  onPointerDown={() => sendBtn('OK', true)}
                  onPointerUp={() => sendBtn('OK', false)}
                  onPointerLeave={() => sendBtn('OK', false)} onPointerCancel={() => sendBtn('OK', false)}
                  onMouseDown={() => sendBtn('OK', true)}
                  onMouseUp={() => sendBtn('OK', false)}
                  onTouchStart={() => sendBtn('OK', true)}
                  onTouchEnd={() => sendBtn('OK', false)}
                  className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-xs tracking-wider text-[#3fc5f0] border border-cyan-500/20"
                >
                  OK
                </button>
              </div>
              <div className="flex items-center justify-start">
                <button 
                  onPointerDown={() => sendBtn('RIGHT', true)}
                  onPointerUp={() => sendBtn('RIGHT', false)}
                  onPointerLeave={() => sendBtn('RIGHT', false)} onPointerCancel={() => sendBtn('RIGHT', false)}
                  onMouseDown={() => sendBtn('RIGHT', true)}
                  onMouseUp={() => sendBtn('RIGHT', false)}
                  onTouchStart={() => sendBtn('RIGHT', true)}
                  onTouchEnd={() => sendBtn('RIGHT', false)}
                  className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-[#3fc5f0]"
                >
                  <ChevronRight className="w-5 h-5 text-cyan-400" />
                </button>
              </div>

              {/* Row 3: DOWN button in middle, BACK button on the right */}
              <div />
              <div className="flex items-center justify-center">
                <button 
                  onPointerDown={() => sendBtn('DOWN', true)}
                  onPointerUp={() => sendBtn('DOWN', false)}
                  onPointerLeave={() => sendBtn('DOWN', false)} onPointerCancel={() => sendBtn('DOWN', false)}
                  onMouseDown={() => sendBtn('DOWN', true)}
                  onMouseUp={() => sendBtn('DOWN', false)}
                  onTouchStart={() => sendBtn('DOWN', true)}
                  onTouchEnd={() => sendBtn('DOWN', false)}
                  className="hardware-key touch-none select-none w-24 h-9 rounded-lg font-mono font-bold text-[#3fc5f0]"
                >
                  <ChevronDown className="w-5 h-5 text-cyan-400" />
                </button>
              </div>
              <div className="flex items-center justify-start">
                <button 
                  onPointerDown={() => sendBtn('BACK', true)}
                  onPointerUp={() => sendBtn('BACK', false)}
                  onPointerLeave={() => sendBtn('BACK', false)} onPointerCancel={() => sendBtn('BACK', false)}
                  onMouseDown={() => sendBtn('BACK', true)}
                  onMouseUp={() => sendBtn('BACK', false)}
                  onTouchStart={() => sendBtn('BACK', true)}
                  onTouchEnd={() => sendBtn('BACK', false)}
                  className="hardware-key touch-none select-none w-16 h-8 rounded-md font-mono font-bold text-[10px] text-rose-500 hover:text-rose-400 tracking-wider uppercase border border-rose-500/10"
                >
                  BACK
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Mode Selectors (JAMMER, RECEIVER, REMOTE) */}
          <div className="flex flex-col gap-2 justify-center w-full lg:w-[250px] shrink-0 p-1 relative z-10">
            {/* IR JAMMER button */}
            <button 
              onPointerDown={() => sendMacro('CMD_OPEN_IR_JAMMER')} onClick={() => sendMacro('CMD_OPEN_IR_JAMMER')}
              className={`hardware-key py-2.5 px-4 flex items-center justify-start gap-3 rounded-lg border transition-all duration-300 ${
                activeMode === 'IR JAMMER' 
                  ? 'bg-[#0f1b20] text-cyan-400 border-cyan-500/25 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-bold' 
                  : 'border-zinc-900/50 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <Activity className={`w-4 h-4 ${activeMode === 'IR JAMMER' ? 'text-cyan-400 shadow-glow shadow-cyan-400' : 'text-cyan-600/70'}`} />
              <span className="text-xs font-mono font-bold tracking-wider">
                IR JAMMER
              </span>
            </button>
            
            {/* IR RECEIVER button */}
            <button 
              onPointerDown={() => sendMacro('CMD_OPEN_IR_RECEIVER')} onClick={() => sendMacro('CMD_OPEN_IR_RECEIVER')}
              className={`hardware-key py-2.5 px-4 flex items-center justify-start gap-3 rounded-lg border transition-all duration-300 ${
                activeMode === 'IR RECEIVER' 
                  ? 'bg-[#101c15] text-emerald-400 border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)] font-bold' 
                  : 'border-zinc-900/50 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <Zap className={`w-4 h-4 ${activeMode === 'IR RECEIVER' ? 'text-emerald-400 shadow-glow shadow-emerald-400' : 'text-emerald-600/70'}`} />
              <span className="text-xs font-mono font-bold tracking-wider">
                IR RECEIVER
              </span>
            </button>
            
            {/* IR REMOTE button */}
            <button 
              onPointerDown={() => sendMacro('CMD_OPEN_WIFI_SCAN')} onClick={() => sendMacro('CMD_OPEN_WIFI_SCAN')}
              className={`hardware-key py-2.5 px-4 flex items-center justify-start gap-3 rounded-lg border transition-all duration-300 ${
                activeMode === 'IR REMOTE' 
                  ? 'bg-[#1c1710] text-amber-400 border-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.15)] font-bold' 
                  : 'border-zinc-900/50 text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <Tv className={`w-4 h-4 ${activeMode === 'IR REMOTE' ? 'text-amber-400 shadow-glow shadow-amber-400' : 'text-amber-600/70'}`} />
              <span className="text-xs font-mono font-bold tracking-wider">
                WIFI SCAN
              </span>
            </button>
          </div>
        </div>
    </div>
  );
}

