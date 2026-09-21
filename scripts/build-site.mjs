#!/usr/bin/env node
/**
 * Builds the blog: content/published/*.md -> site/blog/<slug>/index.html,
 * plus site/blog/index.html, site/blog/rss.xml and site/sitemap.xml.
 *
 * Styling matches the existing landing page (same CSS custom properties), so
 * the blog does not look like a bolt-on. Output is plain static HTML with no
 * client-side JavaScript — fast, and appropriate for a security product.
 *
 * Usage: node scripts/build-site.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { marked } from 'marked';
import { brand, claims, path } from './lib/config.mjs';

const ORIGIN = brand.site.origin.replace(/\/$/, '');
const BLOG = brand.site.blogPath.replace(/\/$/, '');

marked.setOptions({ mangle: false, headerIds: true, gfm: true });

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/** Minimal YAML frontmatter parser — scalars and simple inline/block lists. */
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  let key = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && key) {
      (data[key] ||= []).push(unquote(listItem[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const value = kv[2];
    if (value === '') {
      data[key] = [];
    } else if (/^\[.*\]$/.test(value)) {
      data[key] = value.slice(1, -1).split(',').map((v) => unquote(v.trim())).filter(Boolean);
    } else {
      data[key] = unquote(value);
    }
  }
  return { data, body: src.slice(m[0].length) };
}

const unquote = (s) => s.replace(/^["']|["']$/g, '').trim();

const STYLE = `
:root{--bg:#0a0c10;--panel:#11151c;--panel2:#161b24;--line:#232a35;--text:#e6edf3;--dim:#8b96a5;--dimmer:#5f6a78;--acc:#5eead4;--acc2:#2dd4bf;--red:#f87171;--amber:#fbbf24;--mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:720px;margin:0 auto;padding:0 24px}
nav{border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(10,12,16,.9);backdrop-filter:blur(12px);z-index:50}
nav .wrap{max-width:940px;display:flex;align-items:center;justify-content:space-between;height:60px}
.logo{font-family:var(--mono);font-weight:600;font-size:15px;letter-spacing:-.3px;color:var(--text)}
.logo span{color:var(--acc)}
.navlinks{display:flex;gap:22px;align-items:center;font-size:14px}
.navlinks a{color:var(--dim)}.navlinks a:hover{color:var(--text);text-decoration:none}
.btn{background:var(--acc);color:#04231f;padding:8px 16px;border-radius:6px;font-weight:600;font-size:14px;display:inline-block}
.btn:hover{background:var(--acc2);text-decoration:none}
article{padding:56px 0 40px}
h1{font-size:clamp(28px,4.4vw,40px);line-height:1.15;letter-spacing:-1px;font-weight:700;margin-bottom:16px}
h2{font-size:24px;letter-spacing:-.4px;margin:44px 0 14px;padding-top:8px}
h3{font-size:18px;margin:30px 0 10px;color:var(--text)}
p{margin:0 0 18px}
ul,ol{margin:0 0 18px 22px}li{margin-bottom:8px}
blockquote{border-left:3px solid var(--line);padding-left:18px;color:var(--dim);margin:0 0 18px}
code{font-family:var(--mono);font-size:13px;background:var(--panel2);border:1px solid var(--line);border-radius:4px;padding:1.5px 5px}
pre{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px;overflow-x:auto;margin:0 0 22px}
pre code{background:none;border:none;padding:0;font-size:12.5px;line-height:1.65}
table{width:100%;border-collapse:collapse;margin:0 0 22px;font-size:14.5px}
th,td{border:1px solid var(--line);padding:9px 12px;text-align:left}
th{background:var(--panel2);font-weight:600}
hr{border:none;border-top:1px solid var(--line);margin:36px 0}
.meta{font-family:var(--mono);font-size:12.5px;color:var(--dimmer);margin-bottom:34px}
.tags{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 30px}
.tag{font-family:var(--mono);font-size:11.5px;color:var(--dim);border:1px solid var(--line);border-radius:100px;padding:3px 10px}
.cta-box{border:1px solid var(--line);background:var(--panel);border-radius:10px;padding:22px;margin:44px 0 0}
.cta-box p{margin:0 0 14px;color:var(--dim);font-size:15px}
.cta-box code{font-size:13px}
.notes{border-top:1px solid var(--line);margin-top:44px;padding-top:20px;font-size:13.5px;color:var(--dimmer)}
.notes p{margin-bottom:10px}
.post-list{list-style:none;margin:0;padding:0}
.post-list li{border-bottom:1px solid var(--line);padding:22px 0;margin:0}
.post-list h2{font-size:20px;margin:0 0 6px;letter-spacing:-.3px}
.post-list h2 a{color:var(--text)}
.post-list h2 a:hover{color:var(--acc);text-decoration:none}
.post-list p{color:var(--dim);font-size:15px;margin:0 0 8px}
.post-list .meta{margin:0;font-size:12px}
footer{border-top:1px solid var(--line);padding:32px 0;margin-top:60px;font-size:13px;color:var(--dimmer)}
footer .wrap{max-width:940px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
`.trim();

// Social preview image. A post can ship its own at site/og/blog-<slug>.png;
// every other page falls back to the site image, so a shared link never shows
// an empty card (declaring summary_large_image with no image renders broken).
function ogImageFor(slug) {
  if (slug && existsSync(path('site', 'og', `blog-${slug}.png`))) return `${ORIGIN}/og/blog-${slug}.png`;
  return `${ORIGIN}/og/asiscan.png`;
}

function chrome({ title, description, canonical, body, jsonLd, slug }) {
  const image = ogImageFor(slug);
  return `<!doctype html>
<html lang="${brand.site.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(brand.product.name)} blog" href="${ORIGIN}${BLOG}/rss.xml">
<style>${STYLE}</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};</script>
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
<nav><div class="wrap">
  <a class="logo" href="${ORIGIN}/">${escapeHtml(brand.product.name)}<span>${escapeHtml(new URL(ORIGIN).hostname.replace(/^[^.]+/, ''))}</span></a>
  <div class="navlinks">
    <a href="${BLOG}/">Blog</a>
    <a href="${ORIGIN}/#how">How it works</a>
    <a href="${ORIGIN}/#pricing">Pricing</a>
    <a class="btn" href="${ORIGIN}/#pricing">Get ${escapeHtml(brand.product.name)}</a>
  </div>
</div></nav>
${body}
<footer><div class="wrap">
  <div>&copy; ${new Date().getUTCFullYear()} ${escapeHtml(brand.product.legalEntity)} · ${escapeHtml(brand.site.region)}</div>
  <div>${escapeHtml(claims.requiredDisclaimers.owasp)}</div>
</div></footer>
</body>
</html>`;
}

function loadPosts() {
  const dir = path('content', 'published');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const src = readFileSync(path('content', 'published', f), 'utf8');
      const { data, body } = parseFrontmatter(src);
      return {
        slug: data.slug || f.replace(/\.md$/, ''),
        title: data.title || f,
        description: data.description || '',
        date: data.date || '1970-01-01',
        tags: Array.isArray(data.tags) ? data.tags : [],
        body,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function renderPost(post) {
  const canonical = `${ORIGIN}${BLOG}/${post.slug}`;
  const html = marked.parse(post.body);
  const body = `<article><div class="wrap">
<h1>${escapeHtml(post.title)}</h1>
<div class="meta">${post.date} · ${escapeHtml(brand.site.author)}, ${escapeHtml(brand.site.authorTitle)}</div>
${post.tags.length ? `<div class="tags">${post.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
${html}
<div class="cta-box">
  <p>${escapeHtml(brand.product.name)} audits an AI agent codebase against all ten OWASP Agentic categories, the LLM Top 10 and EU AI Act Article 50, and writes the evidence document.</p>
  <p><code>${escapeHtml(brand.product.cliInvocation)}</code></p>
  <a class="btn" href="${ORIGIN}/#pricing">See what it checks</a>
</div>
<div class="notes">
  <p>${escapeHtml(claims.requiredDisclaimers.owasp)}</p>
  <p>${escapeHtml(claims.requiredDisclaimers.compliance)}</p>
</div>
</div></article>`;

  return chrome({
    slug: post.slug,
    title: `${post.title} · ${brand.product.name}`,
    description: post.description,
    canonical,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      author: { '@type': 'Person', name: brand.site.author },
      publisher: { '@type': 'Organization', name: brand.product.legalEntity },
      mainEntityOfPage: canonical,
    },
  });
}

function renderIndex(posts) {
  const body = `<article><div class="wrap">
<h1>Notes on agent security</h1>
<p style="color:var(--dim);font-size:17px;margin-bottom:36px">Findings, measurements and design notes from building ${escapeHtml(brand.product.name)}. <a href="${BLOG}/rss.xml">RSS</a>.</p>
<ul class="post-list">
${posts.map((p) => `  <li>
    <h2><a href="${BLOG}/${p.slug}">${escapeHtml(p.title)}</a></h2>
    <p>${escapeHtml(p.description)}</p>
    <div class="meta">${p.date}</div>
  </li>`).join('\n')}
</ul>
</div></article>`;
  return chrome({
    title: `Blog · ${brand.product.name}`,
    description: `Findings and design notes on AI agent security from ${brand.product.name}.`,
    canonical: `${ORIGIN}${BLOG}/`,
    body,
  });
}

function renderRss(posts) {
  const items = posts.slice(0, 25).map((p) => `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${ORIGIN}${BLOG}/${p.slug}</link>
      <guid isPermaLink="true">${ORIGIN}${BLOG}/${p.slug}</guid>
      <description>${escapeHtml(p.description)}</description>
      <pubDate>${new Date(`${p.date}T13:00:00Z`).toUTCString()}</pubDate>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(brand.product.name)} — notes on agent security</title>
    <link>${ORIGIN}${BLOG}/</link>
    <atom:link href="${ORIGIN}${BLOG}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>${escapeHtml(brand.product.shortDescription)}</description>
    <language>${brand.site.locale}</language>
${items}
  </channel>
</rss>`;
}

function renderSitemap(posts) {
  const urls = [
    { loc: `${ORIGIN}/`, pri: '1.0' },
    // Static landing pages live beside the blog in site/. They are listed here
    // because this builder rewrites sitemap.xml on every publish -- a sitemap
    // maintained anywhere else is overwritten the first Tuesday it runs.
    { loc: `${ORIGIN}/faq`, pri: '0.8' },
    { loc: `${ORIGIN}${BLOG}/`, pri: '0.8' },
    { loc: `${ORIGIN}/verify`, pri: '0.6' },
    { loc: `${ORIGIN}/support`, pri: '0.5' },
    { loc: `${ORIGIN}/terms`, pri: '0.3' },
    { loc: `${ORIGIN}/privacy`, pri: '0.3' },
    ...posts.map((p) => ({ loc: `${ORIGIN}${BLOG}/${p.slug}`, pri: '0.7', lastmod: p.date })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.pri}</priority></url>`).join('\n')}
</urlset>`;
}

function main() {
  const posts = loadPosts();
  const blogDir = path('site', 'blog');
  mkdirSync(blogDir, { recursive: true });

  for (const post of posts) {
    const dir = path('site', 'blog', post.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/index.html`, renderPost(post));
  }

  writeFileSync(`${blogDir}/index.html`, renderIndex(posts));
  writeFileSync(`${blogDir}/rss.xml`, renderRss(posts));
  writeFileSync(path('site', 'sitemap.xml'), renderSitemap(posts));
  writeFileSync(
    path('site', 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /thanks\n\nSitemap: ${ORIGIN}/sitemap.xml\n`
  );

  // llms.txt — a growing share of this buyer's research starts in a language
  // model rather than a search box. A clean, factual summary with canonical
  // links is what gets cited.
  const llms = [
    `# ${brand.product.name}`,
    '',
    `> ${brand.product.shortDescription}`,
    '',
    `${brand.product.name} is a command-line static analysis tool for AI agent codebases, published by ${brand.product.legalEntity} (${brand.site.region}). It runs entirely offline with no telemetry and produces terminal, Markdown, JSON and SARIF 2.1.0 output. Licensing is one-time and perpetual: ${brand.pricing.tiers.map((t) => `${t.name} $${t.price}`).join(', ')} ${brand.pricing.currency}.`,
    '',
    `${claims.requiredDisclaimers.owasp}`,
    `${claims.requiredDisclaimers.compliance}`,
    '',
    '## Articles',
    '',
    ...posts.map((p) => `- [${p.title}](${ORIGIN}${BLOG}/${p.slug}): ${p.description}`),
    '',
    '## Product',
    '',
    `- [Home](${ORIGIN}/): what it checks, pricing, FAQ`,
    `- [Blog](${ORIGIN}${BLOG}/): findings and design notes`,
    '',
  ].join('\n');
  writeFileSync(path('site', 'llms.txt'), llms);

  console.error(`Built ${posts.length} post(s), blog index, RSS, sitemap and llms.txt.`);
}

main();
