import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const targetDirectory = path.resolve(process.argv[2] || ".");
const configPath = path.join(targetDirectory, "data", "site-config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const siteUrl = String(config.siteUrl || "").replace(/\/$/, "");

if (!/^https:\/\/cherwart\.github\.io$/.test(siteUrl)) {
  throw new Error("siteUrl must be https://cherwart.github.io");
}

const urls = config.sitemapPaths.map((route) => `${siteUrl}${route}`);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url) => `  <url><loc>${url.replace(/&/g, "&amp;")}</loc></url>`),
  "</urlset>",
  ""
].join("\n");

fs.writeFileSync(path.join(targetDirectory, "sitemap.xml"), sitemap);
fs.writeFileSync(
  path.join(targetDirectory, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
);

const indexPath = path.join(targetDirectory, "index.html");
let index = fs.readFileSync(indexPath, "utf8");
const verificationPattern = /\n?\s*<meta name="google-site-verification" content="[^"]*">/g;
index = index.replace(verificationPattern, "");

const verificationCode = String(config.googleSiteVerification || "").trim();
if (verificationCode) {
  const escapedCode = verificationCode.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const verificationMeta = `  <meta name="google-site-verification" content="${escapedCode}">\n`;
  index = index.replace(
    '  <meta name="google" content="notranslate">\n',
    `  <meta name="google" content="notranslate">\n${verificationMeta}`
  );
}

fs.writeFileSync(indexPath, index);
