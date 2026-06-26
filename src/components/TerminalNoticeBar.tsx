import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

export interface TerminalNotice {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'SUCCESS' | 'INFO';
  message: string;
  count: number;
  timestamp: number;
}

// Global emitter for parser notices
type NoticeListener = (notice: Omit<TerminalNotice, 'id' | 'count' | 'timestamp'>) => void;
const listeners: NoticeListener[] = [];

export const TerminalNoticeSystem = {
  subscribe: (listener: NoticeListener) => {
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx > -1) listeners.splice(idx, 1);
    };
  },
  emit: (type: TerminalNotice['type'], message: string) => {
    listeners.forEach(l => l({ type, message }));
  }
};

export const TerminalNoticeBar: React.FC = () => {
  const [notices, setNotices] = useState<TerminalNotice[]>([]);

  useEffect(() => {
    const unsubscribe = TerminalNoticeSystem.subscribe((newNotice) => {
      setNotices(prev => {
        // Deduplicate
        const existingIdx = prev.findIndex(n => n.message === newNotice.message && n.type === newNotice.type);
        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            count: updated[existingIdx].count + 1,
            timestamp: Date.now()
          };
          return updated;
        }

        return [...prev, {
          id: crypto.randomUUID(),
          ...newNotice,
          count: 1,
          timestamp: Date.now()
        }];
      });
    });

    return unsubscribe;
  }, []);

  // Auto-expire notices after 5 seconds of inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNotices(prev => prev.filter(n => now - n.timestamp < 5000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (notices.length === 0) return null;

  return (
    <div className="absolute top-2 right-4 z-50 flex flex-col gap-2 pointer-events-none items-end max-w-[80%]">
      {notices.map(notice => {
        let bgClass = 'bg-zinc-900/90 border-zinc-700 text-zinc-300';
        let icon = <Info className="w-3.5 h-3.5 text-zinc-400" />;

        if (notice.type === 'CRITICAL') {
          bgClass = 'bg-red-950/90 border-red-500/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
          icon = <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
        } else if (notice.type === 'SUCCESS') {
          bgClass = 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
          icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
        } else if (notice.type === 'WARNING') {
          bgClass = 'bg-amber-950/90 border-amber-500/50 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
          icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
        }

        return (
          <div 
            key={notice.id}
            className={`pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded border backdrop-blur-md transition-all animate-in slide-in-from-right-4 fade-in duration-300 ${bgClass}`}
          >
            {icon}
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider">{notice.message}</span>
            {notice.count > 1 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[9px] font-mono font-bold">
                ×{notice.count}
              </span>
            )}
            <button 
              onClick={() => setNotices(prev => prev.filter(n => n.id !== notice.id))}
              className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
