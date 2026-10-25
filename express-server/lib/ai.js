const askGemini = async ({ system, contents, maxOutputTokens = 600 }) => {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,
        {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents,
                generationConfig: { maxOutputTokens },
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        const error = new Error("Gemini request failed");
        error.status = response.status;
        error.details = data;
        throw error;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Gemini returned no text");
    }

    return text;
};

module.exports = { askGemini };