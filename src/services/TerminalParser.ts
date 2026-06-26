export type LogSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'ACTIVE';

export interface LogToken {
  type: 'text' | 'hex' | 'ip' | 'gpio' | 'core' | 'mac' | 'error_keyword';
  value: string;
}

export interface LogEntry {
  id: string;
  rawText: string;
  timestamp: number;
  count: number;
  category: string;
  categoryTag?: string;
  severity: LogSeverity;
  tokens: LogToken[];
  hash: string;
  noticeTrigger?: string;
  
  // Payload Extensions
  isBlob?: boolean;
  blobMetadata?: {
    type: string;
    totalBytes: number;
    fragments: number;
    durationMs: number;
  };
  fragments?: string[];
}

const CRITICAL_REGEX = /(brownout|guru meditation|panic|mount failed|watchdog|fatal|reboot|core dump|corrupted)/i;
const ERROR_REGEX = /(error|failed|failure|exception)/i;
const WARNING_REGEX = /(retry|timeout|low memory|slow|packet loss|warning|warn)/i;
const SUCCESS_REGEX = /(connected|scan completed|handshake|success|received|detected|initialized|ready)/i;
const ACTIVE_REGEX = /(deauth|beacon|ble scan|transmitting|payload|injecting)/i;
const NETWORK_REGEX = /(http|websocket|api|wifi|ip|socket|tcp|udp)/i;

const TOKEN_PATTERNS = [
  { type: 'mac', regex: /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/gi },
  { type: 'ip', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gi },
  { type: 'hex', regex: /0x[0-9a-fA-F]+/gi },
  { type: 'gpio', regex: /GPIO\s*\d+/gi },
  { type: 'core', regex: /Core\s*\d+/gi },
  { type: 'error_keyword', regex: /\b(panic|guru meditation|fatal|failed|error|timeout|watchdog|brownout|corrupted)\b/gi }
];

class BlobSession {
  id = crypto.randomUUID();
  startTimestamp = Date.now();
  fragments: string[] = [];
  totalBytes = 0;
  type = 'Unknown Payload';
}

export class TerminalStreamAggregator {
  private currentSession: BlobSession | null = null;
  private lastBlobTime = 0;

  // Converts a completed blob session into a LogEntry
  private finalizeSession(): LogEntry {
    const session = this.currentSession!;
    const rawTextCombined = session.fragments.join('');
    
    // Check if the blob has corruption
    let severity: LogSeverity = 'INFO';
    let noticeTrigger: string | undefined;

    // Optional quick heuristic check:
    // If it's base64 and has invalid chars or unexpected length, it might be corrupt, 
    // but typically we let AI handle deep analysis.
    
    return {
      id: session.id,
      rawText: rawTextCombined,
      timestamp: session.startTimestamp,
      count: 1,
      category: 'PAYLOAD',
      categoryTag: '[STREAM]',
      severity,
      tokens: [{ type: 'text', value: '[HIDDEN PAYLOAD DATA]' }],
      hash: session.id, // unique
      noticeTrigger,
      isBlob: true,
      blobMetadata: {
        type: session.type,
        totalBytes: session.totalBytes,
        fragments: session.fragments.length,
        durationMs: Date.now() - session.startTimestamp
      },
      fragments: session.fragments
    };
  }

  public processLine(rawLine: string): LogEntry[] {
    const isData = rawLine.startsWith('DATA://') || (rawLine.length > 150 && !rawLine.includes(' '));
    const entriesToEmit: LogEntry[] = [];

    if (this.currentSession) {
      if (isData) {
        this.currentSession.fragments.push(rawLine);
        this.currentSession.totalBytes += new Blob([rawLine]).size;
        this.lastBlobTime = Date.now();
        return []; // Consume fragment, emit nothing yet
      } else {
        // Blob has ended
        entriesToEmit.push(this.finalizeSession());
        this.currentSession = null;
      }
    } else {
      if (isData) {
        this.currentSession = new BlobSession();
        if (rawLine.startsWith('DATA://')) this.currentSession.type = 'Base64 OLED Buffer';
        else this.currentSession.type = 'Binary Data Stream';
        
        this.currentSession.fragments.push(rawLine);
        this.currentSession.totalBytes += new Blob([rawLine]).size;
        this.lastBlobTime = Date.now();
        return []; // Consume fragment
      }
    }

    // Normal line parsing
    entriesToEmit.push(TerminalParser.parse(rawLine));
    return entriesToEmit;
  }
}

export class TerminalParser {
  private static generateHash(text: string): string {
    let normalized = text.replace(/\[\d{2}:\d{2}:\d{2}\]/g, '[TIME]');
    normalized = normalized.replace(/\[\d+\]/g, '[TIME]');
    normalized = normalized.replace(/\b\d+\b/g, '#');
    normalized = normalized.replace(/0x[0-9a-fA-F]+/gi, '0x###');
    return normalized.trim();
  }

  private static parseTokens(text: string): LogToken[] {
    let tokens: LogToken[] = [{ type: 'text', value: text }];

    for (const pattern of TOKEN_PATTERNS) {
      const newTokens: LogToken[] = [];
      for (const token of tokens) {
        if (token.type !== 'text') {
          newTokens.push(token);
          continue;
        }

        const matches = [...token.value.matchAll(pattern.regex)];
        if (matches.length === 0) {
          newTokens.push(token);
          continue;
        }

        let lastIndex = 0;
        for (const match of matches) {
          const index = match.index!;
          if (index > lastIndex) {
            newTokens.push({ type: 'text', value: token.value.substring(lastIndex, index) });
          }
          newTokens.push({ type: pattern.type as any, value: match[0] });
          lastIndex = index + match[0].length;
        }

        if (lastIndex < token.value.length) {
          newTokens.push({ type: 'text', value: token.value.substring(lastIndex) });
        }
      }
      tokens = newTokens;
    }

    return tokens;
  }

  public static parse(rawText: string): LogEntry {
    let severity: LogSeverity = 'INFO';
    let category = 'SYSTEM';
    let noticeTrigger: string | undefined;
    
    let categoryTag = '[SYSTEM]';
    let messageContent = rawText;

    const tagMatch = rawText.match(/^(\[[A-Z0-9_ -]+\])(.*)/);
    if (tagMatch) {
      categoryTag = tagMatch[1];
      messageContent = tagMatch[2].trim();
      
      const tagUpper = categoryTag.toUpperCase();
      if (tagUpper.includes('IR') || tagUpper.includes('TX') || tagUpper.includes('RX')) category = 'IR';
      else if (tagUpper.includes('WIFI') || tagUpper.includes('NET')) category = 'NETWORK';
      else if (tagUpper.includes('ATTACK') || tagUpper.includes('JAMMER')) category = 'ATTACK';
    }

    if (CRITICAL_REGEX.test(messageContent)) {
      severity = 'CRITICAL';
      category = 'CRASH';
      if (messageContent.toLowerCase().includes('brownout')) noticeTrigger = 'Brownout detected';
      else if (messageContent.toLowerCase().includes('mount failed')) noticeTrigger = 'SD Mount Failed';
      else if (messageContent.toLowerCase().includes('panic')) noticeTrigger = 'Kernel Panic';
    } else if (ACTIVE_REGEX.test(messageContent) || category === 'ATTACK') {
      severity = 'ACTIVE';
    } else if (ERROR_REGEX.test(messageContent)) {
      severity = 'ERROR';
    } else if (WARNING_REGEX.test(messageContent)) {
      severity = 'WARNING';
    } else if (SUCCESS_REGEX.test(messageContent)) {
      severity = 'SUCCESS';
    } else if (NETWORK_REGEX.test(messageContent) || category === 'NETWORK') {
      severity = 'INFO';
      category = 'NETWORK';
    } else if (category === 'IR') {
      severity = 'SUCCESS';
    }

    return {
      id: crypto.randomUUID(),
      rawText,
      timestamp: Date.now(),
      count: 1,
      category,
      categoryTag,
      severity,
      tokens: this.parseTokens(messageContent),
      hash: this.generateHash(rawText),
      noticeTrigger
    };
  }
}
