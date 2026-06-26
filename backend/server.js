const express = require('express');
const cors = require('cors');

const geminiAdapter = require('./providers/gemini');
const openaiAdapter = require('./providers/openai');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Health/Keepalive Route
app.get('/api/health', (req, res) => {
    res.status(200).send('OK');
});

// Root route so users don't see "Cannot GET /" if they open the port
app.get('/', (req, res) => {
    res.status(200).send('SATAN Backend Proxy is running. Use port 3000 for the UI.');
});

// 2. Universal Chat Proxy Route
app.post('/api/chat', async (req, res) => {
    const { provider, api_key, messages } = req.body;

    if (!provider || !api_key || !messages) {
        return res.status(400).json({ error: 'Missing provider, api_key, or messages' });
    }

    // Set up standard SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        let adapter;
        if (provider === 'gemini') {
            adapter = geminiAdapter;
        } else if (['openai', 'claude', 'deepseek', 'grok', 'nvidia'].includes(provider)) {
            adapter = openaiAdapter;
        } else {
            throw new Error(`Unsupported provider: ${provider}`);
        }

        // Each adapter must handle parsing and pushing unified {"token":"..."} objects to `res`
        await adapter.handleStream(provider, api_key, messages, res);
        
        // unified ending
        res.write(`data: {"done": true}\n\n`);
        res.end();

    } catch (err) {
        console.error(`[${provider}] Proxy error:`, err);
        // unified error format
        const errorPayload = {
            type: "PROVIDER_ERROR",
            provider: provider,
            message: err.message || 'Unknown provider error',
            suggestion: 'Verify API key, version, and model support.'
        };
        res.write(`data: {"error": ${JSON.stringify(errorPayload)}}\n\n`);
        res.end();
    }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`SATAN AI Proxy running on http://localhost:${PORT}`);
});
