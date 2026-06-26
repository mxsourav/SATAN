import React, { useState } from 'react';
import { LogEntry, LogToken } from '../services/TerminalParser';
import { AlertTriangle, CheckCircle2, Info, Activity, AlertCircle, Wifi, ChevronDown } from 'lucide-react';

export type TerminalRenderMode = 'compact' | 'diagnostic' | 'full';

interface TerminalLineProps {
  log: LogEntry;
  showTimestamps: boolean;
  mode?: TerminalRenderMode;
  isRawAgentMode?: boolean;
}

const severityConfig = {
  CRITICAL: {
    container: 'bg-red-950/30 border-l-2 border-red-500/60 pl-2',
    text: 'text-red-300',
    icon: <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />,
    pulse: false
  },
  ERROR: {
    container: 'bg-red-900/10 border-l-2 border-red-400/40 pl-2',
    text: 'text-red-300',
    icon: <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />,
    pulse: false
  },
  WARNING: {
    container: 'bg-amber-950/20 border-l-2 border-amber-500/40 pl-2',
    text: 'text-amber-300',
    icon: <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />,
    pulse: false
  },
  SUCCESS: {
    container: 'bg-emerald-950/10 border-l-2 border-emerald-500/40 pl-2',
    text: 'text-emerald-300',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />,
    pulse: false
  },
  ACTIVE: {
    container: 'bg-yellow-950/20 border-l-2 border-yellow-500/40 pl-2',
    text: 'text-yellow-300',
    icon: <Activity className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" />,
    pulse: true
  },
  NETWORK: {
    container: 'pl-2',
    text: 'text-cyan-300',
    icon: <Wifi className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5 opacity-70" />,
    pulse: false
  },
  INFO: {
    container: 'pl-2 opacity-80',
    text: 'text-zinc-300',
    icon: <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0 mt-1 ml-1 mr-0.5" />,
    pulse: false
  }
};

const categoryColors: Record<string, string> = {
  'SYSTEM': 'text-red-400',
  'IR': 'text-emerald-400',
  'NETWORK': 'text-cyan-400',
  'ATTACK': 'text-yellow-400',
  'CRASH': 'text-red-500',
  'ERROR': 'text-red-500',
  'WARNING': 'text-amber-500',
  'SUCCESS': 'text-emerald-500',
};

const tokenColors: Record<LogToken['type'], string> = {
  text: '',
  hex: 'text-orange-400 font-bold',
  ip: 'text-cyan-400 font-bold',
  gpio: 'text-pink-400 font-bold',
  core: 'text-purple-400 font-bold',
  mac: 'text-indigo-400 font-bold',
  error_keyword: 'text-red-400 font-bold'
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
};

export const TerminalLine = React.memo(({ log, showTimestamps, mode = 'compact', isRawAgentMode = false }: TerminalLineProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderTokens = (baseColor: string = 'text-zinc-200') => {
    if ((isRawAgentMode || isExpanded) && log.isBlob) {
      return <span className={baseColor}>{log.rawText}</span>;
    }
    return log.tokens.map((token, i) => {
      if (token.type === 'text') {
        return <span key={i} className={baseColor}>{token.value}</span>;
      }
      return <span key={i} className={tokenColors[token.type]}>{token.value}</span>;
    });
  };

  if (log.isBlob && !isRawAgentMode && !isExpanded) {
    return (
      <div className="flex flex-col py-1.5 px-2 my-1 bg-[#0a0e17] border border-cyan-900/30 rounded cursor-pointer hover:bg-cyan-950/30 transition-colors group" onClick={() => setIsExpanded(true)}>
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center text-[10px] font-mono text-cyan-500">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-bold tracking-wider uppercase">[{log.blobMetadata?.type?.toUpperCase() || 'STREAM'}]</span>
          </div>
          <span className="text-[9px] text-zinc-500 font-mono">
             {showTimestamps && formatTime(log.timestamp)}
          </span>
        </div>
        <div className="flex gap-4 text-[9px] text-zinc-500 font-mono mt-1.5 items-center">
          <span className="bg-black/40 px-1.5 py-0.5 rounded">Fragments: {log.blobMetadata?.fragments}</span>
          <span className="bg-black/40 px-1.5 py-0.5 rounded">Size: {Math.round((log.blobMetadata?.totalBytes || 0) / 1024)}KB</span>
          <span className="bg-black/40 px-1.5 py-0.5 rounded">Duration: {log.blobMetadata?.durationMs}ms</span>
          <div className="flex items-center gap-1 text-cyan-600/70 ml-auto group-hover:text-cyan-400 transition-colors">
            <ChevronDown className="w-3 h-3" />
            <span>Expand Raw Payload</span>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'compact') {
    const catColor = categoryColors[log.category] || 'text-zinc-500';
    return (
      <div className="flex flex-col py-1 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-1.5 text-[10px] font-mono leading-none">
          {showTimestamps && (
            <span className="text-zinc-600 opacity-60 tabular-nums">[{formatTime(log.timestamp)}]</span>
          )}
          <span className={`${catColor} font-bold tracking-wider uppercase`}>{log.categoryTag}</span>
          {log.count > 1 && (
            <span className="text-zinc-500 font-bold ml-1 text-[9px] bg-black/40 px-1 rounded">×{log.count}</span>
          )}
        </div>
        <div className="text-[11px] font-mono leading-tight mt-1 break-all">
          {renderTokens('text-zinc-200')}
        </div>
      </div>
    );
  }

  // Fallback to Full Mode
  const config = severityConfig[log.severity];
  return (
    <div className={`flex items-start gap-2 py-0.5 hover:bg-white/5 transition-colors ${config.container}`}>
      <div className="relative flex items-center justify-center w-4 shrink-0">
        {config.icon}
        {config.pulse && (
          <div className="absolute w-2 h-2 rounded-full bg-yellow-500/50 blur-sm animate-pulse" />
        )}
      </div>

      <div className="flex-1 flex flex-wrap items-start gap-x-2 break-all">
        {showTimestamps && (
          <span className="text-zinc-600 font-mono text-[10px] tabular-nums shrink-0 mt-0.5 select-none">
            [{formatTime(log.timestamp)}]
          </span>
        )}

        {log.categoryTag && (
          <span className="text-zinc-500 font-bold text-[10px] mt-[1px]">{log.categoryTag}</span>
        )}

        <span className={`font-mono text-[11px] leading-tight`}>
          {renderTokens(config.text)}
        </span>
      </div>

      {log.count > 1 && (
        <div className="shrink-0 ml-2 select-none">
          <span className="bg-zinc-800/80 text-zinc-400 border border-zinc-700 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider">
            ×{log.count}
          </span>
        </div>
      )}
    </div>
  );
});

TerminalLine.displayName = 'TerminalLine';
