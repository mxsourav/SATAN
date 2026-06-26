async function handleStream(providerName, apiKey, messages, res) {
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    let targetModel = 'gpt-4o-mini';

    if (providerName === 'deepseek') {
        endpoint = 'https://api.deepseek.com/v1/chat/completions';
        targetModel = 'deepseek-chat';
    } else if (providerName === 'grok') {
        endpoint = 'https://api.x.ai/v1/chat/completions';
        targetModel = 'grok-beta';
    } else if (providerName === 'claude') {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        targetModel = 'anthropic/claude-3-5-sonnet';
    } else if (providerName === 'nvidia') {
        endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
        targetModel = 'meta/llama-3.1-405b-instruct';
    }

    const payload = {
        model: targetModel,
        messages: messages,
        stream: true,
        temperature: 0.2
    };

    const fetchRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            // OpenRouter specific optional headers
            'HTTP-Referer': 'https://github.com/SATAN',
            'X-Title': 'S.A.T.A.N.'
        },
        body: JSON.stringify(payload)
    });

    if (!fetchRes.ok) {
        const errText = await fetchRes.text();
        throw new Error(`API Error: ${fetchRes.status} - ${errText}`);
    }

    const reader = fetchRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

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
            if (dataStr === '[DONE]') continue;

            try {
                const parsed = JSON.parse(dataStr);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                    res.write(`data: ${JSON.stringify({ token })}\n\n`);
                }
            } catch (e) {
                // ignore parsing errors for partial chunks
            }
        }
    }
}

module.exports = { handleStream };
