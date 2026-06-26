import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { LogEntry } from './TerminalParser';

interface SerialMemoryDB extends DBSchema {
  logs: {
    key: number;
    value: LogEntry;
    indexes: { 'by-timestamp': number };
  };
}

class SessionMemoryService {
  private dbPromise: Promise<IDBPDatabase<SerialMemoryDB>>;
  private sessionStartTime: number;
  private currentSessionId: string = crypto.randomUUID();

  constructor() {
    this.sessionStartTime = Date.now();
    this.dbPromise = openDB<SerialMemoryDB>('satan-serial-memory', 2, {
      upgrade(db) {
        // Handle upgrade if it already existed
        if (db.objectStoreNames.contains('logs')) {
          db.deleteObjectStore('logs');
        }
        const store = db.createObjectStore('logs', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }

  async appendLog(log: LogEntry) {
    const db = await this.dbPromise;
    await db.add('logs', log);
  }

  async getAllLogsForSession() {
    const db = await this.dbPromise;
    const logs = await db.getAllFromIndex('logs', 'by-timestamp');
    // Only return logs from this browser session
    return logs.filter(l => l.timestamp >= this.sessionStartTime);
  }

  async clearSession() {
    const db = await this.dbPromise;
    await db.clear('logs');
    this.sessionStartTime = Date.now();
    this.currentSessionId = crypto.randomUUID();
  }
  async exportSessionHTML() {
    const logs = await this.getAllLogsForSession();
    const rawLogs = logs.map(l => l.rawText).join('\n');
    return `<!DOCTYPE html>
<html>
<head>
    <title>SATAN Diagnosic Export</title>
    <style>
        body { background: #0a0a0a; color: #00ff00; font-family: monospace; padding: 20px; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
        .header { border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>SATAN Session Export</h1>
        <p>Session ID: ${this.currentSessionId}</p>
        <p>Exported at: ${new Date().toISOString()}</p>
    </div>
    <pre>${rawLogs}</pre>
</body>
</html>`;
  }
}

export const SessionMemory = new SessionMemoryService();
