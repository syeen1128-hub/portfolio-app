
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).send("");

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];

    const results = await Promise.all(
      items.map(item => withTimeout(getNewsResult(item), 5500, item))
    );

    return res.status(200).json({ results, time: nowStamp() });
  } catch (err) {
    return res.status(200).json({ results: [], error: String(err && err.message || err) });
  }
}

function withTimeout(promise, ms, item) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallbackResult(item, "timeout")), ms))
  ]);
}

function nowStamp() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function fallbackResult(item, source = "fallback") {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    items: [],
    goodScore: 50,
    riskScore: 50,
    summary: "뉴스 부족",
    source
  };
}

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!r.ok) throw new Error("http " + r.status);
  return await r.text();
}

function decodeHtml(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractItems(xml, source) {
  const out = [];
  const blocks = String(xml || "").match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const b of blocks.slice(0, 8)) {
    const title = decodeHtml((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    const link = decodeHtml((b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1]);
    if (!title) continue;
    out.push({ title, link, source });
  }
  return out;
}

function scoreNews(title, item) {
  const t = String(title || "").toLowerCase();

  const goodWords = [
    "수주","계약","흑자","상향","호실적","최대 실적","사상 최대","승인","허가","기술수출","수출","증가",
    "반등","회복","강세","매수","목표가 상향","증설","배당","자사주","ai","hbm","cloud","beat","upgrade",
    "record","growth","approval","contract","order","buyback","dividend"
  ];
  const badWords = [
    "하락","급락","적자","손실","부진","둔화","감소","리콜","소송","규제","압수수색","횡령","상장폐지",
    "유상증자","목표가 하향","실패","지연","중단","경고","위기","down","drop","lawsuit","probe","recall",
    "miss","downgrade","delay","loss","weak","regulation"
  ];

  let good = 0;
  let bad = 0;
  for (const w of goodWords) if (t.includes(w.toLowerCase())) good += 1;
  for (const w of badWords) if (t.includes(w.toLowerCase())) bad += 1;

  let sentiment = "neutral";
  let sentimentText = "중립";
  if (good > bad) { sentiment = "good"; sentimentText = "호재성"; }
  if (bad > good) { sentiment = "bad"; sentimentText = "악재성"; }

  return { good, bad, sentiment, sentimentText };
}

async function getNewsResult(item) {
  const name = String(item.name || item.code || "").trim();
  const code = String(item.code || "").trim();
  const market = item.market || "kr";

  const query = market === "us"
    ? `${name} ${code} stock news`
    : `${name} 주식 뉴스`;

  const urls = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  ];

  let news = [];
  for (const url of urls) {
    try {
      const xml = await fetchText(url);
      news = news.concat(extractItems(xml, "Google News"));
    } catch (e) {}
  }

  const seen = new Set();
  news = news.filter(n => {
    const k = n.title;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 6);

  let goodTotal = 0;
  let badTotal = 0;
  const items = news.map(n => {
    const s = scoreNews(n.title, item);
    goodTotal += s.good;
    badTotal += s.bad;
    return { ...n, sentiment: s.sentiment, sentimentText: s.sentimentText };
  });

  let goodScore = 50 + goodTotal * 12 - badTotal * 4;
  let riskScore = 50 + badTotal * 12 - goodTotal * 4;

  goodScore = Math.max(0, Math.min(100, Math.round(goodScore)));
  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  if (!items.length) return fallbackResult(item, "no-news");

  return {
    id: item.id,
    code,
    name,
    items,
    goodScore,
    riskScore,
    summary: `호재 ${goodTotal} / 악재 ${badTotal}`,
    source: "google-news-rss",
    time: nowStamp()
  };
}
