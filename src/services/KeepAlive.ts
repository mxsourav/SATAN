// Lightweight keep-alive pinger for Render free-tier backends

export const KeepAlive = {
  intervalId: null as any,
  start() {
    if (this.intervalId) return;
    
    // Ping backend health route every 30s to prevent Render sleep
    // Silent execution, no UI blocking, no logs
    this.intervalId = setInterval(async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';
        await fetch(`${backendUrl}/api/health`, { method: 'GET', cache: 'no-store' });
      } catch (e) {
        // Ignore failures silently (e.g. offline)
      }
    }, 30000);
  },
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
};
