#!/usr/bin/env node

const base = (process.argv[2] || "http://127.0.0.1:3002").replace(/\/$/, "");

function fail(message) {
  throw new Error(`Article smoke test failed: ${message}`);
}

const sitemapResponse = await fetch(`${base}/sitemap.xml`);
if (!sitemapResponse.ok) fail(`sitemap returned HTTP ${sitemapResponse.status}`);
const sitemap = await sitemapResponse.text();
const postPath = [...sitemap.matchAll(/<loc>([^<]+\/posts\/[^<]+)<\/loc>/g)]
  .map((match) => {
    try {
      return new URL(match[1]).pathname;
    } catch {
      return null;
    }
  })
  .find(Boolean);
if (!postPath) fail("sitemap contains no published article");

for (const locale of ["zh", "en", "ja", "ko"]) {
  const articleResponse = await fetch(`${base}${postPath}`, {
    headers: { cookie: `cl-locale=${locale}` },
  });
  if (articleResponse.status !== 200) {
    fail(`${postPath} (${locale}) returned HTTP ${articleResponse.status}`);
  }
  const html = await articleResponse.text();
  if (!html.includes("data-cl-article")) fail(`article body marker is missing (${locale})`);

  const jsonLdMatches = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  if (!jsonLdMatches.length) fail(`JSON-LD script is missing (${locale})`);
  for (const match of jsonLdMatches) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      fail(
        `JSON-LD is not valid JSON (${locale}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

console.log(`Article smoke test passed in zh/en/ja/ko: ${postPath}`);
