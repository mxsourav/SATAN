import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface LogLine {
  time: string;
  tag: string;
  text: string;
  color: string;
  bold?: boolean;
}

interface UseWebSerialProps {
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  onLogParsed?: (log: LogLine) => void;
}

export function useWebSerial({ canvasRef, onLogParsed }: UseWebSerialProps = {}) {
  const [status, setStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'REBOOTING'>('DISCONNECTED');
  const [uptimeSeconds, setUptimeSeconds] = useState(0);
  const [ipAddress, setIpAddress] = useState<string | null>(null);

  const [activeMode, setActiveMode] = useState<'IR JAMMER' | 'IR RECEIVER' | 'IR REMOTE' | 'WIFI SCAN'>('IR JAMMER');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  
  const frameBufferRef = useRef<string>("");
  const isMirroringRef = useRef<boolean>(false);
  const lastFrameTimeRef = useRef<number>(0);

  const writeCommand = async (cmd: string) => {
    if (writerRef.current) {
      try {
        await writerRef.current.write(cmd + "\n");
      } catch (err) {
        console.error("Failed to write to serial", err);
      }
    }
  };

  const processLine = (line: string) => {
    // 1. Aggressive Sanitization
    // Strip unreadable binary and boot ROM noise
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(line)) return;
    const sanitized = line.replace(/[^\x20-\x7E\r\n]/g, '').trim();
    if (line.length > 5 && sanitized.length < line.length * 0.5) return;
    if (!sanitized) return;
    
    line = sanitized;

    // Handle Handshake
    if (line.includes("[BWIFIKILL_V4_CONNECTED]") || line.includes("[UPTIME]")) {
      setStatus('CONNECTED');
      if (line.includes("[BWIFIKILL_V4_CONNECTED]")) return;
    }

    // Handle Mirroring
    if (line === "[OLED_FRAME_BEGIN]") {
      isMirroringRef.current = true;
      frameBufferRef.current = "";
      return;
    }
    if (line === "[OLED_FRAME_END]") {
      isMirroringRef.current = false;
      
      const now = performance.now();
      if (now - lastFrameTimeRef.current < 30) {
        // Cap to ~30fps max
        return;
      }
      lastFrameTimeRef.current = now;

      try {
        // Decode base64
        const binaryStr = atob(frameBufferRef.current);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        
        // Convert U8G2 128x64 1-bit format to ImageData (RGBA)
        const width = 128;
        const height = 64;
        const imageData = new ImageData(width, height);
        
        for (let page = 0; page < 8; page++) {
          for (let x = 0; x < 128; x++) {
            const byteObj = bytes[page * 128 + x];
            for (let bit = 0; bit < 8; bit++) {
              const y = page * 8 + bit;
              const isSet = (byteObj & (1 << bit)) !== 0;
              const idx = (y * width + x) * 4;
              
              if (isSet) {
                imageData.data[idx] = 255;
                imageData.data[idx + 1] = 255;
                imageData.data[idx + 2] = 255;
                imageData.data[idx + 3] = 255;
              } else {
                imageData.data[idx] = 0;
                imageData.data[idx + 1] = 0;
                imageData.data[idx + 2] = 0;
                imageData.data[idx + 3] = 0; 
              }
            }
          }
        }
        
        if (canvasRef?.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            // Direct canvas draw bypassing React
            requestAnimationFrame(() => {
              ctx.putImageData(imageData, 0, 0);
            });
          }
        }
      } catch (e) {
        // Base64 decode error expected if incomplete
      }
      return;
    }
    
    if (isMirroringRef.current) {
      if (line.startsWith("WIDTH:") || line.startsWith("HEIGHT:")) return;
      
      let chunk = line;
      if (chunk.startsWith("DATA:")) {
        chunk = chunk.substring(5);
      }
      frameBufferRef.current += chunk.replace(/[\r\n]+/g, '');
      return;
    }

    // Handle regular telemetry logs
    const now = new Date();
    const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}]`;
    
    if (line.startsWith("[UPTIME]")) {
      const parts = line.split(" ");
      if (parts.length > 1) setUptimeSeconds(parseInt(parts[1], 10));
      return; // Don't show in log window
    }
    if (line.startsWith("[NET]")) {
      if (line.includes("STA_IP=") || line.includes("AP_IP=")) {
        setIpAddress(line.split("=")[1]);
      }
    }

    // Parse general tags
    let tag = "[ESP32]";
    let text = line;
    let color = "text-zinc-500";
    let bold = false;

    const tagMatch = line.match(/^(\[[A-Z0-9_ -]+\])(.*)/);
    if (tagMatch) {
      tag = tagMatch[1];
      text = tagMatch[2].trim();
      
      // Strict semantic colorization
      if (tag.includes("SYSTEM") || tag.includes("INIT")) color = "text-cyan-400";
      else if (tag.includes("JAMMER")) {
        color = "text-[#00fffb]"; // bright electric cyan
        bold = true;
        setIsTransmitting(true);
        setTimeout(() => setIsTransmitting(false), 200); 
      }
      else if (tag.includes("IR TX") || tag.includes("TX")) {
        color = "text-cyan-300";
        setIsTransmitting(true);
        setTimeout(() => setIsTransmitting(false), 200);
      }
      else if (tag.includes("IR RX") || tag.includes("RX")) {
        color = "text-emerald-400";
        setIsReceiving(true);
        setTimeout(() => setIsReceiving(false), 200);
      }
      else if (tag.includes("ERROR") || tag.includes("FAIL")) { color = "text-red-500"; bold = true; }
      else if (tag.includes("WARNING")) color = "text-amber-400";
      else if (tag.includes("SPI")) color = "text-purple-400";
      else if (tag.includes("SD")) color = "text-amber-500";
      else if (tag.includes("SUCCESS") || tag.includes("CONNECTED")) color = "text-emerald-400";
      else if (tag.includes("SCAN")) color = "text-emerald-300";
      else if (tag.includes("BEACON")) color = "text-amber-300";
      else if (tag.includes("DEAUTH")) { color = "text-red-400"; bold = true; }
      else if (tag.includes("PORTAL")) color = "text-purple-300";
    }

    if (onLogParsed) {
      onLogParsed({ time: timeStr, tag, text, color, bold });
    }
  };

  const connect = async () => {
    try {
      const p = await (navigator as any).serial.requestPort();
      await p.open({ baudRate: 115200 });
      portRef.current = p;
      setStatus('CONNECTING'); // Wait for handshake or uptime
      
      const encoder = new TextEncoderStream();
      encoder.readable.pipeTo(p.writable);
      writerRef.current = encoder.writable.getWriter();
      
      readLoop(p);
    } catch (err) {
      console.error("Connection failed", err);
      setStatus('DISCONNECTED');
    }
  };

  const disconnect = async () => {
    setStatus('DISCONNECTED');
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (writerRef.current) {
        await writerRef.current.close();
      }
      if (portRef.current) {
        await portRef.current.close();
      }
    } catch (e) {
      console.error(e);
    } finally {
      portRef.current = null;
      readerRef.current = null;
      writerRef.current = null;
    }
  };

  const readLoop = async (port: any) => {
    while (port.readable) {
      if (!portRef.current) break;
      
      const decoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            buffer += value;
            let newlineIdx;
            while ((newlineIdx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newlineIdx);
              buffer = buffer.slice(newlineIdx + 1);
              processLine(line);
            }
          }
        }
      } catch (error) {
        console.error("Serial read error:", error);
      } finally {
        reader.releaseLock();
      }
    }
  };

  const activeBtns = useRef<Record<string, number>>({});

  const sendBtn = (btnName: string, pressed: boolean) => {
    if (status !== 'CONNECTED') return;
    
    if (pressed) {
      activeBtns.current[btnName] = Date.now();
      writeCommand(`BTN_${btnName}_PRESS`);
    } else {
      const pressTime = activeBtns.current[btnName] || 0;
      const elapsed = Date.now() - pressTime;
      if (elapsed < 150) {
        setTimeout(() => {
          writeCommand(`BTN_${btnName}_RELEASE`);
        }, 150 - elapsed);
      } else {
        writeCommand(`BTN_${btnName}_RELEASE`);
      }
    }
  };

  const sendMacro = (macroCmd: string) => {
    if (status !== 'CONNECTED') return;
    writeCommand(macroCmd);
  };

  const reboot = () => {
    if (status !== 'CONNECTED') return;
    setStatus('REBOOTING');
    writeCommand('CMD_REBOOT_DEVICE');
    // Disconnect after sending reboot to clear the serial port
    setTimeout(() => disconnect(), 500);
  }

  return {
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
    sendMacro,
    reboot
  };
}
