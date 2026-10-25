// The walkthrough has two parts:
//   intro   : shown on the scan form, before the user has scanned anything
//   results : shown the first time a scan's results appear
// Edit the wording here.
//
// selector (optional): a CSS selector for the thing to highlight.
//   If it isn't on the page, the step is simply shown in the middle of the screen.
//
// Optional flags (used by the results part):
//   skipIfMissing : leave this step out when its selector isn't on the page (e.g. the map on a repository scan)
//   skipIfPresent : leave this step out when this other selector IS on the page
//
// The intro steps 2 and 3 use data-tour attributes that must be added in scan/page.js (the scan form):
//   data-tour="target-type"  on the element that holds the Live website / Repository choice
//   data-tour="scan-input"   on the element that holds the website or repository input

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
        id: "map",
        title: "The map",
        selector: "#map-stage",
        skipIfMissing: true,
        text: "Each dot is a real server that answers for this domain. Green is healthy, amber needs attention, red is serious. Click a dot to inspect it, or switch between the globe and the flat map.",
    },
    {
        id: "repo",
        title: "Your repository",
        selector: 'section[aria-labelledby="repo-title"]',
        skipIfMissing: true,
        text: "This card shows your GitHub repository and every safety check we ran on it, scored out of 10. A tick means it passed, and a cross means something needs fixing.",
    },
    {
        id: "score",
        title: "Your score",
        selector: 'section[aria-labelledby="score-title"]',
        text: "Out of 100, higher is safer. Each check scores 0 to 10, and riskier checks count for more. A critical problem keeps your score at 50 or below until it's fixed. Open \"How is this scored?\" for the details.",
    },
    {
        id: "problems",
        title: "What is wrong",
        selector: 'section[aria-labelledby="findings-title"]',
        text: "Problems are listed worst first. Open one to see why it matters and how to fix it. If it affects a server, the map highlights it for you.",
    },
    {
        id: "checklist",
        title: "Before you launch",
        selector: 'nav[aria-label="Scan result sections"] a[href$="/checklist"]',
        text: "The Checklist is the one to open before you put a site online for the first time. Items marked AUTO fill themselves in from your scan.",
    },
    {
        id: "ask",
        title: "Stuck? Ask me",
        selector: 'button[aria-label^="Ask Cruz"]',
        text: "I'm down here the whole time. Ask me what any term means or how to fix something, and I'll answer in plain language. That's the tour. Go and explore!",
    },
];

export const TOUR_PARTS = { intro: INTRO_STEPS, results: RESULTS_STEPS };