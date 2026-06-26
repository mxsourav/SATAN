import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Settings, AlertTriangle, Download, Trash2, Cpu, Copy, Check } from 'lucide-react';
import { LLMProvider, ChatMessage, ProviderType } from '../services/LLMProvider';
import { LocalStructuringEngine, CrashWarning } from '../services/LocalStructuringEngine';
import { SessionMemory } from '../services/SessionMemory';
import { AutoDiagnosticEngine } from '../services/AutoDiagnosticEngine';

export default function AIPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<CrashWarning[]>([]);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<ProviderType>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-1.5-flash-latest');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load credentials
    if (LLMProvider.loadCredentials()) {
      setProvider(LLMProvider.getProvider());
    } else {
      setShowSettings(true);
    }

    // Subscribe to warnings
    const unsubscribe = LocalStructuringEngine.subscribe((newWarnings) => {
      setWarnings([...newWarnings]);
    });

    const unsubscribeAuto = AutoDiagnosticEngine.subscribe((event) => {
      setMessages(prev => {
        const existingIdx = prev.findIndex(m => m.isAutoDiagnostic && m.faultType === event.faultType && m.content.includes("ANALYZING"));
        
        if (event.status === 'ANALYZING') {
          if (existingIdx > -1) return prev;
          return [...prev, {
            role: 'assistant',
            isAutoDiagnostic: true,
            faultType: event.faultType,
            content: JSON.stringify({ status: 'ANALYZING', faultType: event.faultType })
          }];
        } else if (event.status === 'COMPLETED') {
          const newMsg: ChatMessage = {
            role: 'assistant',
            isAutoDiagnostic: true,
            faultType: event.faultType,
            content: JSON.stringify({ status: 'COMPLETED', faultType: event.faultType, result: event.analysisResult })
          };
          if (existingIdx > -1) {
            const next = [...prev];
            next[existingIdx] = newMsg;
            return next;
          }
          return [...prev, newMsg];
        }
        return prev;
      });
    });

    return () => { unsubscribe(); unsubscribeAuto(); };
  }, []);

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isTyping]);

  const handleSaveSettings = () => {
    LLMProvider.setCredentials(provider, apiKey);
    setShowSettings(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Fetch massive session log context
      const logs = await SessionMemory.getAllLogsForSession();
      const mappedLogs = logs.map(l => {
        const date = new Date(l.timestamp);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
        return {
          timeStr,
          tag: l.categoryTag || l.category || 'ESP32',
          text: l.rawText
        };
      });
      const compressedContext = LocalStructuringEngine.formatContextForAI(mappedLogs);

      // Create a temporary assistant message that will be updated via stream
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const responseText = await LLMProvider.sendMessage([...messages, userMsg], compressedContext, (chunk) => {
        setMessages(prev => {
          const newMsg = [...prev];
          newMsg[newMsg.length - 1].content = chunk; // LLMProvider now sends full concatenated response so far
          return newMsg;
        });
      });
    } catch (error: any) {
      console.error(error);
      let errorObj;
      try {
        errorObj = JSON.parse(error.message);
      } catch (e) {
        errorObj = {
          type: "SYSTEM_ERROR",
          provider: provider,
          message: error.message || "Failed to reach AI proxy backend.",
          suggestion: "Ensure the backend server is running on port 3001."
        };
      }

      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: JSON.stringify(errorObj), isError: true }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExport = async () => {
    const html = await SessionMemory.exportSessionHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SATAN_Export_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full w-full bg-[#050608]/95 flex flex-col relative overflow-hidden">
      
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-800/60 shrink-0 bg-[#080a0e]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs font-bold text-zinc-200 tracking-widest uppercase">AI Diagnostics</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="p-1.5 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300" title="Export Session">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 rounded transition-colors ${showSettings ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`} title="AI Settings">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings Overlay */}
      {showSettings && (
        <div className="absolute top-14 left-0 right-0 bottom-0 bg-[#07090d] z-10 p-5 overflow-y-auto">
          <h3 className="text-sm font-bold text-zinc-300 mb-3 uppercase tracking-wider">Provider Setup</h3>
          
          <div className="flex flex-row flex-wrap gap-2 mb-5">
             {['gemini', 'openai', 'claude', 'deepseek', 'grok', 'nvidia'].map(p => (
               <button 
                 key={p}
                 onClick={() => {
                   setProvider(p as ProviderType);
                   if (p === 'gemini' && import.meta.env.VITE_GEMINI_API_KEY) {
                     setApiKey(import.meta.env.VITE_GEMINI_API_KEY);
                   }
                 }}
                 className={`w-[70px] h-[70px] border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all ${
                   provider === p ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'
                 }`}
               >
                 <img src={`/providers/${p}-color.svg`} alt={p} className="w-6 h-6 opacity-90" onError={(e) => e.currentTarget.style.display='none'} />
                 <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{p}</span>
               </button>
             ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono text-zinc-500 mb-1 block">API KEY</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500" placeholder="Paste your API key here" />
            </div>
            <button onClick={handleSaveSettings} className="w-full bg-zinc-100 text-black font-bold text-sm py-2 rounded hover:bg-white transition-colors uppercase tracking-wider mt-2">
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Instant Local Warnings */}
      {warnings.length > 0 && (
        <div className="p-3 bg-black/40 border-b border-red-900/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> HARDWARE FAULTS DETECTED
            </span>
            <button onClick={() => LocalStructuringEngine.clearWarnings()} className="text-zinc-500 hover:text-white"><Trash2 className="w-3 h-3" /></button>
          </div>
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="text-xs font-mono bg-red-500/10 border border-red-500/20 text-red-300 px-2 py-1.5 rounded flex items-start gap-2">
                <div className="mt-0.5">•</div>
                <div>
                  <strong className="block">{w.type}</strong>
                  <span className="opacity-80 text-[10px]">{w.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {messages.length === 0 && !showSettings && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-40">
            <Cpu className="w-12 h-12 mb-4 text-zinc-500" />
            <h3 className="text-sm font-bold text-zinc-300 mb-2">DIAGNOSTIC ENGINE READY</h3>
            <p className="text-xs font-mono text-zinc-500">Ask a question to analyze the hidden serial memory buffer. Context is handled automatically.</p>
          </div>
        )}

        {messages.map((m, i) => {
          let errData: any = null;
          if (m.isError) {
            try { errData = JSON.parse(m.content); } catch (e) {}
          }
          
          let autoData: any = {};
          if (m.isAutoDiagnostic) {
            try { autoData = JSON.parse(m.content || '{}'); } catch (e) {}
          }
          
          return (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.isAutoDiagnostic ? (
                <div className="w-full bg-[#110e05] border border-amber-900/40 rounded-xl overflow-hidden flex flex-col shadow-lg">
                  <div className="bg-amber-950/40 px-3 py-2 border-b border-amber-900/50 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                       <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">AUTO-DIAGNOSTIC: {m.faultType}</span>
                     </div>
                     <span className="text-[9px] font-mono font-bold text-amber-500/60 uppercase">
                       {autoData.status === 'ANALYZING' ? 'ANALYZING CONTEXT...' : 'ANALYSIS COMPLETE'}
                     </span>
                  </div>
                  <div className="p-4">
                    {autoData.status === 'ANALYZING' ? (
                      <div className="flex flex-col items-center justify-center py-4 space-y-3 opacity-70">
                        <Cpu className="w-8 h-8 text-amber-500/50 animate-bounce" />
                        <span className="text-xs font-mono text-amber-400/80 tracking-widest uppercase">Consulting AI Proxy...</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-black/40 rounded-lg p-3 border border-amber-900/20">
                          <h4 className="text-[10px] uppercase font-bold text-amber-500/80 mb-1.5 tracking-wider">Root Cause Analysis</h4>
                          <p className="text-sm text-zinc-300 leading-relaxed font-sans">{autoData.result?.cause}</p>
                        </div>
                        <div className="bg-emerald-950/20 rounded-lg p-3 border border-emerald-900/30">
                          <h4 className="text-[10px] uppercase font-bold text-emerald-500/80 mb-1.5 tracking-wider">Recommended Fix</h4>
                          <p className="text-sm text-emerald-200/90 leading-relaxed font-sans">{autoData.result?.fix}</p>
                        </div>
                        <div className="flex justify-end">
                          <span className="text-[9px] font-mono text-zinc-500 bg-black/40 px-2 py-1 rounded">Confidence: {autoData.result?.confidence}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : m.isError ? (
                <div className="w-full bg-red-950/40 border border-red-900/50 rounded-xl overflow-hidden flex flex-col">
                  <div className="bg-red-900/40 px-3 py-2 border-b border-red-900/50 flex items-center gap-2">
                     <AlertTriangle className="w-4 h-4 text-red-500" />
                     <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">{errData?.type || 'PROVIDER_ERROR'}</span>
                  </div>
                  <div className="p-3">
                    <div className="text-[13px] text-zinc-300 font-medium mb-2 capitalize">Provider: {errData?.provider || 'Unknown'}</div>
                    
                    {errData?.suggestion && (
                      <div className="bg-black/30 rounded p-2 border border-white/5 mb-3">
                        <span className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">Suggested Fix</span>
                        <span className="text-xs text-zinc-300">{errData.suggestion}</span>
                      </div>
                    )}

                    <details className="group cursor-pointer">
                      <summary className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-bold select-none outline-none">
                        [ Show Technical Details ]
                      </summary>
                      <div className="mt-2 p-2 bg-black/40 rounded border border-red-900/30 text-[10px] font-mono text-red-400/70 break-words whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {errData?.message || 'No stack trace available.'}
                      </div>
                    </details>
                  </div>
                </div>
              ) : (
                <div className={`group relative max-w-[90%] rounded-xl px-4 py-3 ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}>
                  
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(m.content);
                      setCopiedIndex(i);
                      setTimeout(() => setCopiedIndex(null), 2000);
                    }}
                    className="absolute -top-3 -right-3 p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-all border border-zinc-700 shadow-xl z-10"
                    title="Copy message"
                  >
                    {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <div className="prose prose-invert prose-sm max-w-none font-sans leading-relaxed text-[13px] break-words whitespace-pre-wrap overflow-visible">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {isTyping && (
           <div className="flex justify-start">
             <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay:'0.1s'}}></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-black/40 border-t border-zinc-800/50">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI to analyze logs..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-4 pr-10 py-2.5 text-sm text-zinc-200 outline-none focus:border-indigo-500 font-sans"
            disabled={isTyping}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-2 p-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
