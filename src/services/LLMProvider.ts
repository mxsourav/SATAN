import { getDiagnosticSystemPrompt } from './SystemPrompt';
import { WorkspaceLayoutManager } from '../workspace/WorkspaceLayoutManager';

export type ProviderType = 'openai' | 'gemini' | 'claude' | 'deepseek' | 'grok' | 'nvidia' | 'custom';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isAutoDiagnostic?: boolean;
  faultType?: string;
  isError?: boolean;
}

class LLMProviderService {
  private activeProvider: ProviderType = 'gemini';
  private apiKey: string = '';
  private customEndpoint: string = '';

  setCredentials(provider: ProviderType, key: string, endpoint?: string) {
    this.activeProvider = provider;
    this.apiKey = key;
    if (endpoint) this.customEndpoint = endpoint;
    
    // Save to local storage for persistence across reloads
    localStorage.setItem('satan_ai_provider', provider);
    localStorage.setItem('satan_ai_key', key);
  }

  loadCredentials() {
    const p = localStorage.getItem('satan_ai_provider') as ProviderType;
    const k = localStorage.getItem('satan_ai_key');
    if (p && k) {
      this.activeProvider = p;
      this.apiKey = k;
      return true;
    }
    return false;
  }

  getProvider() { return this.activeProvider; }
  hasKey() { return this.apiKey.length > 5; }

  async sendMessage(history: ChatMessage[], contextData: string, onChunk: (text: string) => void): Promise<string> {
    if (!this.hasKey()) throw new Error("API Key not set");

    // Semantic workspace metadata — workflow intent only, never pixel data (~80 tokens)
    let workspaceMeta = '';
    try {
      const layout = WorkspaceLayoutManager.loadLayout();
      const meta = WorkspaceLayoutManager.getWorkflowMetadata(layout);
      workspaceMeta = `WORKSPACE CONTEXT: ${JSON.stringify(meta)}`;
    } catch {
      // Silently skip if workspace data unavailable
    }

    // Prepend system prompt, workspace context, and serial context
    const payloadHistory: ChatMessage[] = [
      { role: 'system', content: getDiagnosticSystemPrompt() },
      ...(workspaceMeta ? [{ role: 'system' as const, content: workspaceMeta }] : []),
      { role: 'system', content: "CURRENT SERIAL CONTEXT:\n" + contextData },
      ...history
    ];

    // Get backend URL from environment or fallback to localhost during dev
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';
    const endpoint = `${backendUrl}/api/chat`;

    const body = {
      provider: this.activeProvider,
      api_key: this.apiKey,
      messages: payloadHistory
    };

    return this.streamFetch(endpoint, body, onChunk);
  }

  private async streamFetch(endpoint: string, body: any, onChunk: (t: string) => void): Promise<string> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Proxy Error: ${response.status} - ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Failed to initialize stream reader");

    const decoder = new TextDecoder("utf-8");
    let fullResponse = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        const dataStr = trimmed.slice(6);

        try {
            const parsed = JSON.parse(dataStr);
            
            if (parsed.error) {
                // unified error bubble up
                throw new Error(JSON.stringify(parsed.error));
            }

            if (parsed.done) {
                continue;
            }

            if (parsed.token) {
                fullResponse += parsed.token;
                onChunk(fullResponse);
            }
        } catch (e: any) {
            // If the error was thrown by our JSON.parse check above, rethrow it
            if (e.message?.includes('PROVIDER_ERROR')) {
                throw e;
            }
        }
      }
    }
    return fullResponse;
  }
}

export const LLMProvider = new LLMProviderService();
