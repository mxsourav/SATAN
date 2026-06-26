const { GoogleGenerativeAI } = require('@google/generative-ai');

let cachedBestModel = null;

async function getBestModel(apiKey) {
    if (cachedBestModel) return cachedBestModel;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            cachedBestModel = 'gemini-1.5-flash-latest';
            return cachedBestModel;
        }
        
        const data = await response.json();
        
        // Extract model names that support generateContent
        const availableModels = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));
            
        const preferredOrder = [
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro',
            'gemini-1.5-flash'
        ];

        for (const preferred of preferredOrder) {
            if (availableModels.includes(preferred)) {
                cachedBestModel = preferred;
                return cachedBestModel;
            }
        }

        if (availableModels.length > 0) {
            cachedBestModel = availableModels[0];
            return cachedBestModel;
        }

        cachedBestModel = 'gemini-1.5-flash-latest';
        return cachedBestModel;
    } catch (e) {
        return 'gemini-1.5-flash-latest';
    }
}

async function handleStream(providerName, apiKey, messages, res) {
    const targetModelStr = await getBestModel(apiKey);
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // We can extract system instructions if any
    const systemMessages = messages.filter(m => m.role === 'system');
    const systemInstruction = systemMessages.length > 0 ? systemMessages.map(m => m.content).join("\n\n") : undefined;

    const model = genAI.getGenerativeModel({
        model: targetModelStr,
        systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
    });

    const formattedMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

    // Remove the very last message because generateContentStream expects history + new prompt
    const history = formattedMessages.slice(0, -1);
    const lastMessage = formattedMessages[formattedMessages.length - 1]?.parts[0].text || "";

    const chat = model.startChat({
        history: history,
        generationConfig: {
            temperature: 0.2,
        }
    });

    try {
        const result = await chat.sendMessageStream(lastMessage);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                res.write(`data: ${JSON.stringify({ token: chunkText })}\n\n`);
            }
        }
    } catch (err) {
        throw new Error(err.message || 'Gemini SDK Error');
    }
}

module.exports = { handleStream };
