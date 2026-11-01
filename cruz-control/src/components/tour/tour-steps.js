const INTRO_STEPS = [
    {
        id: "welcome",
        title: "Hi, I'm Cruz",
        text: "I'll show you around. This tool looks at what your website and your code accidentally show to the public. You don't need any security background to use it.",
    },
    {
        id: "target-type",
        title: "What to scan",
        selector: '[data-tour="target-type"]',
        text: "Pick Live website to check what a public site shows to the world, or Repository to check a GitHub project for secret files and risky libraries. You can also link a repository to a website and check both at once.",
    },
    {
        id: "input",
        title: "Enter something",
        selector: '[data-tour="scan-input"], input[placeholder*="example.com"]',
        text: "Type a public website (like example.com) or a GitHub repository (like owner/repo), then press Start scan. Everything is passive and read-only, so nothing on your site is touched.",
    },
    {
        id: "go",
        title: "Over to you",
        text: "Go ahead and run your first scan. I'll be back when your results are ready, to explain what they mean.",
    },
];

const RESULTS_STEPS = [
    {
        id: "welcome-back",
        title: "Your results are in",
        text: "Here's what we found. I'll show you around quickly, so you know where everything is.",
    },
    {
        id: "pages",
        title: "Your pages",
        selector: 'nav[aria-label="Scan result sections"]',
        text: "Every scan has its own pages. Overview shows what your site exposes, Fix Guide explains how to fix each problem, Checklist is for before you launch, and Report Card shows how your score is worked out.",
    },
    {
        id: "score",
        title: "Your score",
        selector: 'section[aria-labelledby="score-title"]',
        card: "score",
        text: "Out of 100, higher is safer. Each check scores 0 to 10, and riskier checks count for more. A critical problem keeps your score at 50 or below until it's fixed. Open \"How is this scored?\" for the details.",
    },
    {
        id: "map",
        title: "The map",
        selector: "#map-stage",
        card: "map",
        skipIfMissing: true,
        text: "Each dot is a real server that answers for this domain. Green is healthy, amber needs attention, red is serious. Click a dot to inspect it, or switch between the globe and the flat map.",
    },
    {
        id: "repo",
        title: "Your repository",
        selector: 'section[aria-labelledby="repo-title"]',
        card: "repo",
        skipIfMissing: true,
        text: "This card shows your GitHub repository and every safety check we ran on it, scored out of 10. A tick means it passed, and a cross means something needs fixing.",
    },
    {
        id: "problems",
        title: "What is wrong",
        selector: 'section[aria-labelledby="findings-title"]',
        card: "findings",
        text: "Problems are listed worst first. Open one to see why it matters and how to fix it. If it affects a server, the map highlights it for you.",
    },
    {
        id: "ask",
        title: "Stuck? Ask me",
        selector: 'button[aria-label^="Ask Cruz"]',
        text: "I'm down here the whole time. Ask me what any term means or how to fix something, and I'll answer in plain language. That's the tour. Go and explore!",
    },
];

export const TOUR_PARTS = { intro: INTRO_STEPS, results: RESULTS_STEPS };