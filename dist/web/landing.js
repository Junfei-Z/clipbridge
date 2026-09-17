(() => {
  const KEY = "clipbridge.language.v1";
  const EN = {
    skip: "Skip to main content",
    navLabel: "Primary navigation",
    navWorkflows: "Workflows",
    navHow: "How it works",
    navDownload: "Download",
    navFaq: "FAQ",
    openTransfer: "Online transfer",
    heroEyebrow: "Open source · Local first · v0.7",
    heroTitle: "Move your clipboard and unfinished work to the next computer.",
    heroLede: "ClipBridge is a small bridge between your devices: send text and files over your local network, then continue Agent work elsewhere through GitHub and portable handoff packages.",
    downloadLatest: "Download latest",
    viewSource: "View source",
    heroNote: "macOS and Windows · MIT License · No subscription",
    previewLabel: "Agent Handoff product preview",
    ready: "Ready",
    sourceTitle: "Sender",
    clean: "Synced",
    packed: "Packed",
    handoffReady: "Handoff ready",
    handoffSize: "Code via GitHub · Context 18 KB",
    targetTitle: "Receiver",
    continueProject: "Continue clipbridge",
    threeSteps: "Sync code · Apply changes · Restore context",
    receiveHandoff: "Receive and continue",
    safeUpdate: "Safe update",
    noOverwrite: "Never overwrites local work",
    portable: "Portable",
    principlesLabel: "Product principles",
    principleLead: "Built for real cross-device work",
    principleLocal: "Local first",
    principleOpen: "Open source",
    principleSafe: "No silent overwrite",
    principleSimple: "Set up once, continue anywhere",
    twoWays: "Two ways to connect",
    workflowsTitle: "Changing devices should not mean starting over.",
    workflowsLede: "Temporary content travels over your local network. Long-lived projects travel through GitHub. ClipBridge creates no new cloud—it connects the devices and workflow you already have.",
    lanLabel: "Local network transfer",
    lanTitle: "Send text and files straight to a nearby device.",
    lanBody: "Mac, Windows, Android, and iPhone connect when they share a network. Transfer content never enters a ClipBridge cloud, and no account is required.",
    lanPoint1: "Clipboard text and multiple files",
    lanPoint2: "Six-digit pairing with visible device identity",
    lanPoint3: "No dependency on public internet speed",
    agentLabel: "Agent Handoff Beta",
    agentTitle: "Code lives on GitHub. Context travels with the project.",
    agentBody: "ClipBridge turns Git state, unfinished changes, and Agent instructions into a readable, inspectable handoff package, so the next computer continues from the right place.",
    agentPoint1: "Safely update an existing project or clone a new one",
    agentPoint2: "Stops on divergence or local modifications",
    agentPoint3: "Not locked to any Agent product",
    howKicker: "How Agent Handoff works",
    howTitle: "Three steps to pass active work to another computer.",
    howLede: "No hidden sync and no pretend chat migration. Every step is visible, inspectable, and under your control.",
    requirementKicker: "Before you start",
    requirementTitle: "Agent Handoff requires ClipBridge on both computers.",
    requirementBody: "The sender reads and packages the local project; the receiver clones or updates it and applies the handoff. Both sides need Git, Node.js, and access to the GitHub repository.",
    localInstallTitle: "Text and file transfer",
    localInstallBody: "Install only on the relay computer; phones and other devices pair in a browser.",
    agentInstallTitle: "Agent Handoff",
    agentInstallBody: "Install ClipBridge on both the sending and receiving computers.",
    step1Title: "Let the Agent summarize",
    step1Body: "Copy the official prompt from ClipBridge into your current Agent, then paste its response back.",
    step2Title: "Create and push a handoff",
    step2Body: "ClipBridge checks Git, packages the code, changes, and context, then pushes them to your GitHub repository.",
    step3Title: "Continue on the next computer",
    step3Body: "Clone a new project or safely update an existing folder, apply the handoff, and send the continuation prompt to the new Agent.",
    clarityTitle: "ClipBridge transfers work state, not proprietary sessions.",
    clarityBody: "GitHub carries code; an open Markdown/JSON package carries the goals, decisions, and next steps that actually matter.",
    privacyKicker: "Simple, with clear boundaries",
    privacyTitle: "Your data follows a path you can see.",
    privacyBody: "ClipBridge does not run a cloud for transfer content. Local content stays between devices; Agent projects use only the GitHub repository you choose. When it finds risk, it stops and explains instead of guessing.",
    readSecurity: "Read the security notes →",
    routeLabel: "ClipBridge data routes",
    localRoute: "Direct local network",
    githubRoute: "Your own repository",
    downloadKicker: "Start here",
    downloadTitle: "Make the next device switch feel uninterrupted.",
    downloadBody: "Download ClipBridge and build your own work bridge between Mac and Windows.",
    getRelease: "Get the latest release",
    tryWeb: "Try online transfer",
    releaseStepTitle: "Download and unzip",
    releaseStepBody: "On the latest Release page, download Source code (zip), then extract it to a local folder.",
    doubleClick: "Double-click to start",
    supportBoundary: "The desktop client currently supports macOS and Windows only.",
    experimentalLabel: "Experimental",
    experimentalBody: "Public WebRTC transfer remains available, but active development now focuses on local transfer and Agent Handoff.",
    faqKicker: "Common questions",
    faqTitle: "Let’s clear up the confusing parts first.",
    faqLede: "ClipBridge has two independent product tracks that can also work together across devices.",
    faq1Question: "Isn’t this basically file transfer? Why does it involve Agents?",
    faq1Answer: "ClipBridge actually has two tracks. Local text and file transfer answers “how do I send this content to another device?” Agent Handoff answers “how do I continue an unfinished software project on another computer?” One transfers content; the other transfers code and working context. You can use either one independently.",
    faq2Question: "Do both devices have to be on the same local network?",
    faq2Answer: "For local text and file transfer, both devices must be on a local network where they can reach each other. Agent Handoff does not require the same network because your own GitHub repository syncs the code and handoff package. Experimental WebRTC transfer can work across networks, but some restrictive networks may block a direct connection.",
    faq3Question: "Does ClipBridge upload my files to its own server?",
    faq3Answer: "No. Local text and files travel only between your devices, and Agent Handoff uses only the GitHub repository you explicitly choose. In experimental WebRTC mode, the server exchanges temporary connection information but never receives transfer content.",
    faq4Question: "Can it move a complete Codex or Claude Code chat session?",
    faq4Answer: "No, and it does not pretend to. Proprietary session formats are usually not portable between Agent products. ClipBridge carries what is actually needed to continue: Git history, uncommitted changes, the current goal, decisions, known issues, and next steps, stored in open Markdown, JSON, and patch files.",
    faq5Question: "Do I need a GitHub account?",
    faq5Answer: "Not for local text and file transfer. Only Agent Handoff needs GitHub, which acts as the project source both computers can access. That workflow also requires Git and Node.js on the computers.",
    faq8Question: "Does Agent Handoff require ClipBridge on both computers?",
    faq8Answer: "Yes. ClipBridge on the sending computer reads the local Git project and creates the handoff package. ClipBridge on the receiving computer safely clones or updates the project, verifies it, and applies the handoff. Both computers need Git, Node.js, and access to the target GitHub repository. In contrast, ordinary text and file transfer requires ClipBridge only on the relay computer; other devices can use a browser.",
    faq6Question: "Can I use Agent Handoff on a phone?",
    faq6Answer: "Phones can participate in text and file transfer, but Agent Handoff currently supports only Mac and Windows computers. It needs access to a local project directory and must run Git and Node.js commands. The interface clearly marks computer-only features.",
    faq7Question: "Will receiving a project overwrite local changes on the other computer?",
    faq7Answer: "Never silently. If the destination has uncommitted changes, diverged history, a detached HEAD, or unpushed commits, ClipBridge stops and explains why, so you can resolve the situation or choose another folder.",
    footerTagline: "Move the work, not the complexity.",
    releases: "Download",
    onlineTransfer: "Online transfer"
  };

  const getLanguage = () => {
    const requested = new URLSearchParams(location.search).get("lang");
    if (requested === "zh" || requested === "en") return requested;
    const saved = localStorage.getItem(KEY);
    if (saved === "zh" || saved === "en") return saved;
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  };

  const applyLanguage = (language) => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    if (language === "en") {
      for (const element of document.querySelectorAll("[data-i18n]")) {
        const value = EN[element.dataset.i18n];
        if (value) element.textContent = value;
      }
      for (const element of document.querySelectorAll("[data-i18n-aria]")) {
        const value = EN[element.dataset.i18nAria];
        if (value) element.setAttribute("aria-label", value);
      }
      document.title = "ClipBridge · Continue work across devices";
    }
    const toggle = document.querySelector("#language-toggle");
    toggle.textContent = language === "en" ? "中文" : "EN";
    toggle.setAttribute("aria-label", language === "en" ? "切换到中文" : "Switch to English");
    toggle.addEventListener("click", () => {
      localStorage.setItem(KEY, language === "en" ? "zh" : "en");
      const url = new URL(location.href);
      url.searchParams.delete("lang");
      location.href = url.href;
    });
  };

  applyLanguage(getLanguage());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
})();
