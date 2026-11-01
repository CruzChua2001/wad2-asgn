const { supabase } = require("../lib/supabase");
const { buildFindings } = require("../lib/findings");
const { askGemini } = require("../lib/ai");
const { CHAT_SYSTEM_PROMPT, buildScanContext } = require("../lib/chatPrompt");

const CHAT_LIMIT = 20;
const CHAT_WINDOW_MS = 10 * 60 * 1000;
const chatHits = new Map();

const isTooFast = userId => {
    const now = Date.now();
    const recent = (chatHits.get(userId) || []).filter(t => now - t < CHAT_WINDOW_MS);
    recent.push(now);
    chatHits.set(userId, recent);
    return recent.length > CHAT_LIMIT;
};

const chat = async (req, res) => {
    try {
        if (isTooFast(req.user.id)) {
            return res.status(429).json({ error: "You're asking quickly! Please wait a few minutes and try again." });
        }

        const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
        const messages = incoming
            .filter(m => m && typeof m.text === "string" && m.text.trim())
            .map(m => ({ role: m.role === "user" ? "user" : "model", text: m.text.trim().slice(0, 500) }))
            .slice(-10);

        while (messages.length && messages[0].role !== "user") {
            messages.shift();
        }

        if (!messages.length || messages[messages.length - 1].role !== "user") {
            return res.status(400).json({ error: "Please type a question first." });
        }

        let system = CHAT_SYSTEM_PROMPT;
        const { scanId } = req.body;

        if (scanId) {
            if (typeof scanId !== "string") {
                return res.status(400).json({ error: "Something went wrong with that scan. Please try again." });
            }

            const { data: scan, error } = await supabase.from("scans")
                .select("id, project_id, created_at, domain_scans(domain, result, created_at), repo_scans(github_repo, result, created_at)")
                .eq("id", scanId).maybeSingle();

            if (error || !scan) {
                return res.status(404).json({ error: "Scan not found." });
            }

            if (scan.project_id) {
                const { data: member } = await supabase.from("project_members").select("role")
                    .eq("project_id", scan.project_id).eq("user_id", req.user.id).maybeSingle();

                if (!member) {
                    return res.status(404).json({ error: "Scan not found." });
                }
            }

            system += `\n\n${buildScanContext(scan, buildFindings(scan))}`;
        } else {
            system += "\n\nThe person is not looking at a scan right now, so answer general questions only and suggest they open a scan for specific advice.";
        }

        const contents = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        const reply = await askGemini({ system, contents });

        res.json({ reply });
    } catch (error) {
        console.error("Error in Ask Cruz chat:", error.status || "", error.details ? JSON.stringify(error.details) : error);

        if (error.status === 429 || error.status === 503) {
            return res.status(503).json({ error: "Cruz is busy right now. Please try again in a minute." });
        }

        res.status(500).json({ error: "Cruz couldn't answer just now. Please try again." });
    }
};

module.exports = { chat };