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
const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "";
}

function findMeta(html, key, value) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => attribute(tag, key).toLowerCase() === value.toLowerCase());
}

function recordUnique(collection, value, label, file) {
  if (!value) return;
  const previous = collection.get(value);
  if (previous) errors.push(`${file}: duplicate ${label} also used by ${previous}`);
  else collection.set(value, file);
}

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
  const expectedUrl = expectedUrls[htmlFiles.indexOf(file)];
  for (const [pattern, name] of requiredHeadPatterns) if (!pattern.test(html)) errors.push(`${label}: missing ${name}`);

  const title = html.match(/<title(?:\s[^>]*)?>([^<]+)<\/title>/i)?.[1].trim() || "";
  const descriptionTag = findMeta(html, "name", "description");
  const description = descriptionTag ? attribute(descriptionTag, "content").trim() : "";
  const canonicalTags = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => attribute(tag, "rel").toLowerCase() === "canonical");
  const canonical = canonicalTags.length === 1 ? attribute(canonicalTags[0], "href") : "";

  if (!title) errors.push(`${label}: empty title`);
  if (!description) errors.push(`${label}: empty meta description`);
  if (canonicalTags.length !== 1) errors.push(`${label}: expected exactly one canonical URL`);
  if (canonical && canonical !== expectedUrl) errors.push(`${label}: canonical does not match page URL`);
  recordUnique(titles, title, "title", label);
  recordUnique(descriptions, description, "meta description", label);
  recordUnique(canonicals, canonical, "canonical URL", label);

  const robotsTag = findMeta(html, "name", "robots");
  const robotsContent = robotsTag ? attribute(robotsTag, "content").toLowerCase() : "";
  if (!robotsContent.includes("index") || !robotsContent.includes("follow") || robotsContent.includes("noindex")) {
    errors.push(`${label}: robots meta does not permit indexing and following`);
  }

  const requiredOpenGraph = ["og:type", "og:title", "og:description", "og:url", "og:site_name", "og:image"];
  for (const property of requiredOpenGraph) {
    const tag = findMeta(html, "property", property);
    if (!tag || !attribute(tag, "content").trim()) errors.push(`${label}: missing or empty ${property}`);
  }
  const ogUrlTag = findMeta(html, "property", "og:url");
  if (ogUrlTag && attribute(ogUrlTag, "content") !== canonical) errors.push(`${label}: og:url does not match canonical URL`);

  const jsonLdBlocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!jsonLdBlocks.length) errors.push(`${label}: missing JSON-LD`);
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      if (data["@context"] !== "https://schema.org") errors.push(`${label}: JSON-LD does not use the Schema.org context`);
    } catch (error) {
      errors.push(`${label}: invalid JSON-LD (${error.message})`);
    }
  }

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
