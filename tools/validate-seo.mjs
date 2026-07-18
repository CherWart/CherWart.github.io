import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] || ".");
const config = JSON.parse(fs.readFileSync(path.join(root, "data/site-config.json"), "utf8"));
const siteUrl = String(config.siteUrl).replace(/\/$/, "");
const ignoredDirectories = new Set([".git", "node_modules"]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const htmlFiles = walk(root)
  .filter((file) => file.endsWith(".html"))
  .filter((file) => !/^google[a-z0-9]+\.html$/i.test(path.basename(file)))
  .sort();
const expectedUrls = htmlFiles.map((file) => {
  const relative = path.relative(root, file).split(path.sep).join("/");
  return relative === "index.html" ? `${siteUrl}/` : `${siteUrl}/${relative}`;
});
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const errors = [];

for (const url of expectedUrls) if (!sitemapUrls.includes(url)) errors.push(`Sitemap missing: ${url}`);
for (const url of sitemapUrls) if (!expectedUrls.includes(url)) errors.push(`Sitemap URL has no HTML page: ${url}`);

const requiredHeadPatterns = [
  [/<title(?:\s|>)/i, "title"],
  [/<meta\s+name="description"/i, "meta description"],
  [/<meta\s+name="robots"\s+content="index, follow"/i, "crawlable robots meta"],
  [/<link\s+rel="canonical"/i, "canonical URL"],
  [/<meta\s+property="og:title"/i, "Open Graph tags"],
  [/<meta\s+name="twitter:card"/i, "Twitter Card tags"],
  [/<script\s+type="application\/ld\+json"/i, "structured data"],
  [/analytics-config\.js/i, "analytics config"],
  [/assets\/js\/analytics\.js/i, "global analytics loader"]
];

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const label = path.relative(root, file);
  for (const [pattern, name] of requiredHeadPatterns) if (!pattern.test(html)) errors.push(`${label}: missing ${name}`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(value)) continue;
    if (/[+'`{}]/.test(value)) continue; // Ignore URLs assembled inside inline JavaScript templates.
    const clean = decodeURIComponent(value.split(/[?#]/)[0]);
    if (!clean) continue;
    const target = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) errors.push(`${label}: broken local link ${value}`);
  }
}

const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
if (!/User-agent:\s*\*/i.test(robots) || !/Allow:\s*\//i.test(robots)) errors.push("robots.txt does not allow crawling");
if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) errors.push("robots.txt has the wrong sitemap URL");

if (new Set(sitemapUrls).size !== sitemapUrls.length) errors.push("Sitemap contains duplicate URLs");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`SEO validation passed: ${htmlFiles.length} pages, ${sitemapUrls.length} sitemap URLs, and no broken local links.`);
