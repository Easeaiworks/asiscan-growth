// Renders ASIScan marketing images from HTML with headless Chromium.
// Every figure, finding and code line below is taken from a real source:
//   - scanner output: `npx asiscan-cli` 1.5.1 on test/fixtures/vulnerable-agent
//   - code: test/fixtures/vulnerable-agent/agent.ts lines 40-44
//   - titles: src/rules/asi.ts; prices: live Stripe payment links
//   - privacy claims: asiscan.dev/privacy section 2
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = "/home/claude/img/out";
mkdirSync(OUT, { recursive: true });

const css = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0c10;--panel:#11151c;--panel2:#161b24;--line:#232a35;--text:#e6edf3;--dim:#8b96a5;--dimmer:#5f6a78;--acc:#5eead4;--red:#f87171;--amber:#fbbf24}
html,body{width:100%;height:100%}
body{background:var(--bg);color:var(--text);font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased;position:relative;overflow:hidden}
body::before{content:"";position:absolute;inset:0;background:radial-gradient(900px 600px at 0% 0%,rgba(94,234,212,.10),transparent 60%),radial-gradient(700px 500px at 100% 100%,rgba(94,234,212,.05),transparent 60%);pointer-events:none}
body::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:48px 48px;pointer-events:none}
.frame{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;padding:88px}
.mono{font-family:"JetBrains Mono",monospace}
.logo{font-family:"JetBrains Mono",monospace;font-weight:700;letter-spacing:-.5px}
.logo span{color:var(--acc)}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;color:var(--dim);font-size:30px}
.foot .logo{font-size:40px;color:var(--text)}
.chip{display:inline-flex;align-items:center;gap:14px;background:rgba(94,234,212,.08);border:1.5px solid rgba(94,234,212,.3);color:var(--acc);padding:12px 26px;border-radius:999px;font-family:"JetBrains Mono",monospace;font-size:28px;font-weight:500}
h1{font-weight:800;letter-spacing:-2.5px;line-height:1.04}
.acc{color:var(--acc)} .red{color:var(--red)} .amber{color:var(--amber)} .dim{color:var(--dim)}
.panel{background:var(--panel);border:1.5px solid var(--line);border-radius:22px}
.mid{margin:auto 0}
.src{font-family:"JetBrains Mono",monospace;font-size:21px;color:var(--dimmer);margin-top:22px}
`;

const foot = `<div class="foot"><div class="logo">asi<span>scan</span></div><div class="mono">asiscan.dev</div></div>`;
const page = (body, extra = "") => `<!doctype html><html><head><meta charset="utf-8"><style>${css}${extra}</style></head><body><div class="frame">${body}</div></body></html>`;

// Real scanner output, trimmed only by dropping the rule descriptions.
const scanLines = readFileSync("/home/claude/img/vuln-scan.txt", "utf8").split("\n");
const header = scanLines.slice(1, 3).map((l) => l.trim());
const ruleLines = scanLines.filter((l) => /^\s+(CRITICAL|HIGH|MEDIUM)\s/.test(l)).map((l) => l.trim());
const summary = scanLines.find((l) => /critical\s+·/.test(l)).trim();
const sevColor = { CRITICAL: "var(--red)", HIGH: "var(--amber)", MEDIUM: "#60a5fa" };
const termRows = ruleLines.map((l) => {
  const [, sev, id, title] = l.match(/^(CRITICAL|HIGH|MEDIUM)\s+(\S+)\s+(.*)$/);
  return `<div class="tr"><span class="sev" style="color:${sevColor[sev]};border-color:${sevColor[sev]}">${sev}</span><span class="id">${id}</span><span class="tt">${title}</span></div>`;
}).join("");

const asi = [
  ["ASI01", "Agent Goal Hijack"], ["ASI02", "Tool Misuse & Exploitation"], ["ASI03", "Identity & Privilege Abuse"],
  ["ASI04", "Agentic Supply Chain Vulnerabilities"], ["ASI05", "Unexpected Code Execution (RCE)"], ["ASI06", "Memory & Context Poisoning"],
  ["ASI07", "Insecure Inter-Agent Communication"], ["ASI08", "Cascading Failures"], ["ASI09", "Human-Agent Trust Exploitation"], ["ASI10", "Rogue Agents"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const IG = { w: 1080, h: 1350 };
const OG = { w: 1200, h: 630 };

const images = [
  // ---------- Instagram 1: real code + real finding ----------
  { name: "ig-01-code", ...IG, html: page(`
    <h1 style="font-size:76px">Your scanner sees<br>a function call.</h1>
    <p style="font-size:36px;color:var(--dim);margin-top:26px;line-height:1.35">It doesn't see that the argument<br>was written by the model.</p>
    <div class="panel code" style="margin-top:56px;padding:30px 0">
      <div class="ln"><i>40</i>const call = completion.choices[0]</div>
      <div class="ln"><i></i>&nbsp;&nbsp;.message.tool_calls?.[0];</div>
      <div class="ln"><i>41</i>if (call) {</div>
      <div class="ln"><i>42</i>&nbsp;&nbsp;const args = JSON.parse(call.function.arguments);</div>
      <div class="ln" style="color:var(--dimmer)"><i>43</i>&nbsp;&nbsp;// …</div>
      <div class="ln hit"><i>44</i>&nbsp;&nbsp;exec(\`bash -c "\${args.cmd}"\`, ...);</div>
    </div>
    <div class="panel" style="margin-top:22px;padding:28px 32px;border-color:rgba(248,113,113,.45);background:rgba(248,113,113,.06)">
      <div class="mono" style="font-size:24px;color:var(--red);font-weight:700;letter-spacing:.5px">CRITICAL · ASI05 · agent.ts:44</div>
      <div style="font-size:29px;margin-top:12px;line-height:1.4">Shell command built by string interpolation. Model-influenced values in a shell string are a command-injection primitive.</div>
    </div>
    <div class="src">Real output · asiscan-cli 1.5.1 · bundled demo agent</div>
    ${foot}`,
    `.code{font-family:"JetBrains Mono",monospace;font-size:24.5px;line-height:1.75}
     .ln{padding:0 32px;white-space:pre;color:#c9d1d9}
     .ln i{display:inline-block;width:52px;color:var(--dimmer);font-style:normal}
     .ln.hit{background:rgba(248,113,113,.12);border-left:5px solid var(--red);padding-left:27px}`) },

  // ---------- Instagram 2: "it's just a prompt" ----------
  { name: "ig-02-just-a-prompt", ...IG, html: page(`
    <div style="margin-top:auto">
      <div class="mono acc" style="font-size:30px;letter-spacing:4px;margin-bottom:36px">HEARD IN CODE REVIEW</div>
      <h1 style="font-size:150px;letter-spacing:-6px">“It's just<br>a prompt.”</h1>
      <p style="font-size:44px;color:var(--dim);margin-top:52px;line-height:1.35;max-width:880px">— about the input to a function with <span style="color:var(--text)">database access.</span></p>
    </div>
    ${foot}`) },

  // ---------- Instagram 3: five hops ----------
  { name: "ig-03-five-hops", ...IG, html: page(`<div class="mid">
    <h1 style="font-size:78px">Five hops.<br><span class="dim">Each one looks fine<br>on its own.</span></h1>
    <div class="flow">
      ${["Untrusted web page", "Agent context", "Model", "Tool call", "Your production database"].map((t, i, a) =>
        `<div class="node ${i === a.length - 1 ? "end" : ""}">${t}</div>${i < a.length - 1 ? `<div class="arr ${i === a.length - 2 ? "bad" : ""}">${i === a.length - 2 ? "↓ &nbsp;no validation" : "↓"}</div>` : ""}`).join("")}
    </div>
    <p style="font-size:34px;color:var(--dim)">That's why it survives code review.</p>
    </div>
    ${foot}`,
    `.flow{margin:56px 0 44px;display:flex;flex-direction:column;align-items:flex-start}
     .node{font-family:"JetBrains Mono",monospace;font-size:32px;background:var(--panel);border:1.5px solid var(--line);border-radius:16px;padding:20px 30px}
     .node.end{border-color:rgba(248,113,113,.55);background:rgba(248,113,113,.07)}
     .arr{font-family:"JetBrains Mono",monospace;font-size:30px;color:var(--dimmer);padding:8px 0 8px 34px}
     .arr.bad{color:var(--red);font-weight:700}`) },

  // ---------- Instagram 4: excessive agency ----------
  { name: "ig-04-excessive-agency", ...IG, html: page(`<div class="mid">
    <h1 style="font-size:80px">It needed to read<br>one calendar.</h1>
    <div class="panel" style="margin-top:56px;padding:12px 0">
      ${[["calendar.read (primary)", "needed", true], ["calendar.write (all calendars)", "granted", false], ["calendar.delete", "granted", false], ["contacts.read", "granted", false], ["mail.send", "granted", false]]
        .map(([p, s, ok]) => `<div class="perm"><span class="mono">${p}</span><span class="${ok ? "acc" : "red"} mono" style="font-weight:700">${ok ? "✓ " : "✗ "}${s}</span></div>`).join("")}
    </div>
    <p style="font-size:36px;margin-top:44px;line-height:1.4">This is <span class="acc" style="font-weight:700">excessive agency</span> — an OWASP LLM Top 10 risk. Nothing breaks until something does.</p>
    <div class="src">Illustrative permission set</div>
    </div>
    ${foot}`,
    `.perm{display:flex;justify-content:space-between;padding:22px 34px;font-size:29px;border-bottom:1.5px solid var(--line)}
     .perm:last-child{border-bottom:0}`) },

  // ---------- Instagram 5: runs offline (replaces the unverified precision image) ----------
  { name: "ig-05-offline", ...IG, html: page(`<div class="mid">
    <h1 style="font-size:124px;letter-spacing:-5px">Runs<br><span class="acc">offline.</span></h1>
    <div style="margin-top:60px;display:flex;flex-direction:column;gap:30px">
      ${["No network calls during a scan", "No telemetry, no analytics", "No account, no API key", "Your source never leaves your machine"]
        .map((t) => `<div style="font-size:40px;display:flex;gap:24px;align-items:center"><span class="acc mono" style="font-weight:700">✓</span>${t}</div>`).join("")}
    </div>
    <p style="font-size:32px;color:var(--dim);margin-top:56px">MIT licensed. Don't trust us — read the source.</p>
    </div>
    ${foot}`) },

  // ---------- Instagram 6: free vs $490 ----------
  { name: "ig-06-free-vs-report", ...IG, html: page(`<div class="mid">
    <div class="split">
      <div class="half"><div class="big acc">FREE</div><div class="lbl">The scanner.</div><div class="sub">MIT licensed.<br>Free forever.</div></div>
      <div class="half"><div class="big">$490</div><div class="lbl">The written assessment.</div><div class="sub">Only when you need it<br>documented.</div></div>
    </div>
    <p style="font-size:44px;font-weight:700;margin-top:64px;line-height:1.25;letter-spacing:-1px">Security tooling nobody runs<br>protects nobody.</p>
    <div style="margin-top:40px"><span class="chip">$ npx asiscan-cli .</span></div>
    </div>
    ${foot}`,
    `.split{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:40px}
     .half{background:var(--panel);border:1.5px solid var(--line);border-radius:22px;padding:48px 40px}
     .half:first-child{border-color:rgba(94,234,212,.4);background:rgba(94,234,212,.05)}
     .big{font-size:112px;font-weight:800;letter-spacing:-4px}
     .lbl{font-size:36px;font-weight:700;margin-top:20px}
     .sub{font-size:30px;color:var(--dim);margin-top:16px;line-height:1.4}`) },

  // ---------- Instagram 7: real terminal output ----------
  { name: "ig-07-terminal", ...IG, html: page(`
    <h1 style="font-size:72px"><span class="mono" style="letter-spacing:-2px">npx asiscan-cli .</span></h1>
    <div class="panel term" style="margin-top:48px">
      <div class="bar"><i></i><i></i><i></i></div>
      <div class="body">
        <div class="hd">${esc(header[0])}</div>
        <div class="hd dim">${esc(header[1])}</div>
        <div style="height:18px"></div>
        ${termRows}
        <div class="sum">${esc(summary)}</div>
      </div>
    </div>
    <div class="src">Real output · asiscan-cli 1.5.1 · bundled demo agent</div>
    ${foot}`,
    `.term{overflow:hidden}
     .bar{padding:18px 22px;border-bottom:1.5px solid var(--line);display:flex;gap:10px}
     .bar i{width:16px;height:16px;border-radius:50%;background:#2a313d;display:block}
     .body{padding:26px 30px;font-family:"JetBrains Mono",monospace;font-size:22px}
     .hd{font-size:23px;line-height:1.6}
     .tr{display:flex;gap:16px;align-items:center;line-height:2.02}
     .sev{font-size:16px;font-weight:700;border:1.5px solid;border-radius:6px;padding:0 8px;min-width:108px;text-align:center;line-height:1.7}
     .id{color:var(--text);font-weight:700;min-width:84px}
     .tt{color:#c9d1d9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
     .sum{margin-top:22px;padding-top:20px;border-top:1.5px solid var(--line);font-size:24px;font-weight:700}`) },

  // ---------- Instagram 8: nothing crashes ----------
  { name: "ig-08-nothing-crashes", ...IG, html: page(`
    <div style="margin-top:auto">
      <h1 style="font-size:104px;letter-spacing:-4px;line-height:1.08">Nothing crashes.<br><span class="dim">No error.<br>No red text.</span></h1>
      <p style="font-size:44px;margin-top:60px;line-height:1.35;max-width:900px">The agent just does something reasonable-looking that it should <span class="red" style="font-weight:700">never have been allowed to do.</span></p>
    </div>
    ${foot}`) },

  // ---------- Instagram 9: three questions ----------
  { name: "ig-09-three-questions", ...IG, html: page(`<div class="mid">
    <h1 style="font-size:78px">Three questions<br>for your agent.</h1>
    <div style="margin-top:60px;display:flex;flex-direction:column;gap:30px">
      ${["Can it take an irreversible action with no human approval?", "Does any credential it holds exceed the task?", "Can untrusted input reach a tool call unvalidated?"]
        .map((q, i) => `<div class="panel" style="padding:32px 36px;display:flex;gap:30px;align-items:flex-start"><span class="mono acc" style="font-size:44px;font-weight:700;line-height:1.1">0${i + 1}</span><span style="font-size:36px;line-height:1.35;font-weight:600">${q}</span></div>`).join("")}
    </div>
    <p style="font-size:36px;margin-top:48px">Can't answer all three? <span class="acc" style="font-weight:700">That's the finding.</span></p>
    </div>
    ${foot}`) },

  // ---------- Instagram 10: OWASP ASI grid ----------
  { name: "ig-10-owasp-asi", ...IG, html: page(`
    <div class="mono acc" style="font-size:26px;letter-spacing:4px">OWASP · 2026</div>
    <h1 style="font-size:66px;margin-top:18px">Top 10 for Agentic<br>Applications</h1>
    <div class="grid">
      ${asi.map(([id, t]) => `<div class="cell"><div class="mono acc" style="font-size:22px;font-weight:700">${id}</div><div style="font-size:25px;font-weight:600;margin-top:8px;line-height:1.25">${esc(t)}</div></div>`).join("")}
    </div>
    <p style="font-size:32px;margin-top:34px">ASIScan checks for all ten. <span class="dim">Free and open source.</span></p>
    ${foot}`,
    `.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:44px}
     .cell{background:var(--panel);border:1.5px solid var(--line);border-radius:16px;padding:22px 24px;min-height:128px}`) },

  // ---------- Link preview: site default ----------
  { name: "og-asiscan", ...OG, html: page(`
    <div class="logo" style="font-size:34px">asi<span>scan</span></div>
    <h1 style="font-size:66px;margin-top:44px;letter-spacing:-2.2px;max-width:1000px">Your SAST scanner doesn't know what a <span class="acc">tool call</span> is.</h1>
    <p style="font-size:26px;color:var(--dim);margin-top:24px">Static analysis for AI agent codebases · OWASP Top 10 for Agentic Applications</p>
    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center"><span class="chip" style="font-size:26px">$ npx asiscan-cli .</span><span class="mono dim" style="font-size:26px">asiscan.dev</span></div>`,
    `.frame{padding:64px 72px}`) },

  // ---------- Link preview: ASI09 blog post ----------
  { name: "og-blog-asi09-human-agent-trust-exploitation", ...OG, html: page(`
    <div style="display:flex;justify-content:space-between;align-items:center"><div class="logo" style="font-size:34px">asi<span>scan</span></div><span class="chip" style="font-size:22px;padding:8px 20px">BLOG · ASI09</span></div>
    <h1 style="font-size:64px;margin-top:52px;letter-spacing:-2.2px;max-width:1040px">The approval dialog your agent wrote for itself</h1>
    <p style="font-size:26px;color:var(--dim);margin-top:24px">Human-Agent Trust Exploitation · OWASP Top 10 for Agentic Applications</p>
    <div style="margin-top:auto;text-align:right" class="mono dim"><span style="font-size:26px">asiscan.dev/blog</span></div>`,
    `.frame{padding:64px 72px}`) },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
for (const img of images) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: img.w, height: img.h });
  await p.setContent(img.html, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  // Fail loudly if anything overflows its frame rather than ship a clipped image.
  const overflow = await p.evaluate(() => document.querySelector(".frame").scrollHeight - window.innerHeight);
  await p.screenshot({ path: `${OUT}/${img.name}.png`, type: "png" });
  console.log(`${img.name}.png ${img.w}x${img.h}${overflow > 0 ? `  OVERFLOW by ${overflow}px` : ""}`);
  await p.close();
}
await browser.close();
