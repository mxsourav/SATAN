import React from 'react';

export const AsciiSplash: React.FC = () => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080a0e] z-10 pointer-events-none animate-out fade-out fill-mode-forwards duration-1000 delay-[5000ms]">
      <pre className="text-white font-bold text-[5px] leading-[5px] sm:text-[6px] sm:leading-[6px] md:text-[8px] md:leading-[8px] whitespace-pre text-center mb-6 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
{`██▄  ▄██   ██  ██   ▄█████   ▄████▄   ██     ██     █████▄      ▄████▄   ██      ██
██ ▀▀ ██    ████    ▀▀▀▄▄▄   ██     ██   ██     ██     ██▄▄██▄    ██▄▄██   ██▄▄██
██       ██   ██  ██   █████▀   ▀████▀   ▀████▀     ██        ██    ██     ██     ▀██▀`}
      </pre>
      
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-zinc-200 font-bold font-mono tracking-[0.2em] text-sm uppercase">
          SATAN — Serial Access Terminal & Analysis Node
        </h1>
        <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
          Universal Embedded Diagnostics Interface
        </p>
      </div>

      <div className="mt-12 flex items-center gap-3 text-cyan-400 font-mono text-xs animate-pulse">
        <div className="w-2 h-2 bg-cyan-400 rounded-full" />
        WAITING FOR SERIAL DEVICE...
      </div>
    </div>
  );
};
