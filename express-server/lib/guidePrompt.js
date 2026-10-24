const SYSTEM_PROMPT = `You help students and beginner developers fix security problems on their own website or GitHub repo.
Write short, numbered steps in plain language. Explain any technical term in a few words.
Only give defensive advice (how to fix and protect). Never give attack instructions.
Only use the facts provided. If a step depends on their hosting provider, say so and tell them where to look instead of guessing.
Keep it under 200 words.`;

const buildPrompt = finding =>
    `Problem: ${finding.title}\nWhy it matters: ${finding.explain}\nShort fix: ${finding.fix}\nAffected: ${(finding.hosts || []).join(", ") || "n/a"}\nWrite a step-by-step guide to fix this.`;

module.exports = { SYSTEM_PROMPT, buildPrompt };