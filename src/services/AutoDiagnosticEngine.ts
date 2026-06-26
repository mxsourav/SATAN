import { LogEntry } from './TerminalParser';

export type DiagnosticEvent = {
  id: string;
  faultType: string;
  timestamp: number;
  triggerLog: LogEntry;
  contextLogs: LogEntry[];
  status: 'ANALYZING' | 'COMPLETED' | 'FAILED';
  analysisResult?: {
    cause: string;
    fix: string;
    confidence: number;
  };
};

type Listener = (event: DiagnosticEvent) => void;

class AutoDiagnosticEngineService {
  private buffer: LogEntry[] = [];
  private readonly BUFFER_SIZE = 40;
  private listeners: Listener[] = [];
  private activeCapture: { faultType: string; triggerLog: LogEntry; logsAfter: number; capturedLogs: LogEntry[] } | null = null;
  private cooldowns: Record<string, number> = {};

  public processLog(entry: LogEntry) {
    // Only buffer human-readable text for the rolling window context
    // We keep payloads separate to prevent blowing up AI context limit
    this.buffer.push(entry);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }

    if (this.activeCapture) {
      this.activeCapture.capturedLogs.push(entry);
      this.activeCapture.logsAfter++;
      
      // Stop capturing after 15 lines following the crash
      if (this.activeCapture.logsAfter >= 15) {
        this.finalizeCapture();
      }
      return;
    }

    if (entry.severity === 'CRITICAL' && entry.noticeTrigger) {
      const faultType = entry.noticeTrigger;
      
      // 60-second cooldown per fault type to prevent API spam
      if (this.cooldowns[faultType] && Date.now() - this.cooldowns[faultType] < 60000) {
        return; 
      }
      
      this.activeCapture = {
        faultType,
        triggerLog: entry,
        logsAfter: 0,
        capturedLogs: [...this.buffer]
      };
      
      this.cooldowns[faultType] = Date.now();
      
      // Dispatch early 'ANALYZING' event to show a local warning immediately
      this.dispatch({
        id: entry.id,
        faultType,
        timestamp: entry.timestamp,
        triggerLog: entry,
        contextLogs: [],
        status: 'ANALYZING'
      });
    }
  }

  private finalizeCapture() {
    if (!this.activeCapture) return;
    const { faultType, triggerLog, capturedLogs } = this.activeCapture;
    this.activeCapture = null;
    
    // In full deployment, this submits `capturedLogs` to the Gemini Proxy.
    // Simulating proxy latency for the Auto Diagnostic Card generation:
    setTimeout(() => {
      let cause = "Unknown hardware failure.";
      let fix = "Check connections and power supply.";
      
      if (faultType.toLowerCase().includes('brownout')) {
        cause = "ESP32 voltage rail likely dipped below stable threshold during a transmission burst or boot sequence.";
        fix = "Add 470uF–1000uF capacitor near VIN. Avoid powering peripherals from weak 3.3V rail. Check USB cable voltage drop.";
      } else if (faultType.toLowerCase().includes('panic') || faultType.toLowerCase().includes('guru meditation')) {
        cause = "Null pointer dereference or heap corruption occurred in the active task.";
        fix = "Check memory allocations before the crash. Ensure interrupts are not calling blocking functions.";
      }

      this.dispatch({
        id: triggerLog.id,
        faultType,
        timestamp: triggerLog.timestamp,
        triggerLog,
        contextLogs: capturedLogs,
        status: 'COMPLETED',
        analysisResult: {
          cause,
          fix,
          confidence: Math.floor(Math.random() * 15) + 80 // 80-95%
        }
      });
    }, 2500);
  }

  public subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private dispatch(event: DiagnosticEvent) {
    this.listeners.forEach(l => l(event));
  }
}

export const AutoDiagnosticEngine = new AutoDiagnosticEngineService();
