export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).send("");

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const items = Array.isArray(body.items) ? body.items : [];

    const results = await Promise.allSettled(
      items.map(item => withTimeout(getQuote(item), 7500, item))
    );

    const quotes = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      const item = items[i] || {};
      return {
        id: item.id,
        price: null,
        high52: null,
        time: nowStamp(),
        source: "error",
        error: String((r.reason && r.reason.message) || r.reason || "unknown")
      };
    });

    return res.status(200).json({ quotes, time: nowStamp() });
  } catch (err) {
    return res.status(200).json({
      quotes: [],
      error: String((err && err.message) || err)
    });
  }
}

function withTimeout(promise, ms, item) {
  return Promise.race([
    promise,
    new Promise(resolve =>
      setTimeout(
        () => resolve({ id: item.id, price: null, high52: null, time: nowStamp(), source: "timeout" }),
        ms
      )
    )
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

async function getQuote(item) {
  if (item.market === "coin") return await quoteUpbit(item);
  if (item.market === "us") return await quoteYahoo(item);
  return await quoteKr(item);
}

function cleanNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[,\s원$]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchText(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": opts.accept || "*/*",
      "Referer": opts.referer || "https://finance.naver.com/",
      ...(opts.headers || {})
    }
  });
  if (!response.ok) throw new Error("http " + response.status);
  return await response.text();
}

async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, { ...opts, accept: "application/json" });
  return JSON.parse(text);
}

async function quoteKr(item) {
  const code = String(item.code || "").padStart(6, "0");

  let price = null;
  let high52 = null;
  let source = "none";

  try {
    const j = await fetchJson(`https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/basic`);
    price = cleanNumber(j.closePrice || j.now || j.price || j.nv || j.lastPrice) || price;
    high52 = cleanNumber(j.high52wPrice || j.fiftyTwoWeekHighPrice || j.yearHighPrice || j.highPriceOf52Weeks || j.high52WeekPrice) || high52;
    if (price) source = "naver-basic";
  } catch (e) {}

  try {
    const j = await fetchJson(`https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${encodeURIComponent(code)}`);
    const data = j?.result?.areas?.[0]?.datas?.[0];
    price = cleanNumber(data?.nv || data?.closePrice || data?.nowVal) || price;
    if (price && source === "none") source = "naver-realtime";
  } catch (e) {}

  try {
    const j = await fetchJson(`https://api.finance.naver.com/service/itemSummary.naver?itemcode=${encodeURIComponent(code)}`);
    price = cleanNumber(j.now || j.closePrice) || price;
    high52 = cleanNumber(j.high52wPrice || j.fiftyTwoWeekHighPrice || j.yearHighPrice || j.highPriceOf52Weeks || j.high52WeekPrice) || high52;
    if (price && source === "none") source = "naver-summary";
  } catch (e) {}

  try {
    const txt = await fetchText(`https://finance.naver.com/item/sise.naver?code=${encodeURIComponent(code)}`);
    const priceMatch =
      txt.match(/id=["']?_nowVal["']?[^>]*>\s*([0-9,]+)/) ||
      txt.match(/class=["']?no_today["']?[\s\S]*?<span[^>]*>\s*([0-9,]+)/);
    price = cleanNumber(priceMatch && priceMatch[1]) || price;

    const highMatch =
      txt.match(/52주 최고[\s\S]{0,300}?([0-9][0-9,]+)/) ||
      txt.match(/52주최고[\s\S]{0,300}?([0-9][0-9,]+)/) ||
      txt.match(/주 최고[\s\S]{0,300}?([0-9][0-9,]+)/);
    high52 = cleanNumber(highMatch && highMatch[1]) || high52;
    if (price && source === "none") source = "naver-html";
  } catch (e) {}

  try {
    const j = await fetchJson(`https://finance.daum.net/api/quotes/A${encodeURIComponent(code)}?summary=false`, {
      referer: "https://finance.daum.net/",
      headers: { "Accept": "application/json, text/plain, */*" }
    });
    price = cleanNumber(j.tradePrice || j.closePrice) || price;
    high52 = cleanNumber(j.high52wPrice || j.high52WeekPrice || j.yearHighPrice) || high52;
    if (price && source === "none") source = "daum";
  } catch (e) {}

  return { id: item.id, price, high52, time: nowStamp(), source };
}

async function quoteYahoo(item) {
  const symbol = String(item.code || "").trim().toUpperCase();

  let price = null;
  let high52 = null;
  let source = "none";

  try {
    const j = await fetchJson(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`, {
      referer: "https://finance.yahoo.com/"
    });
    const q = j?.quoteResponse?.result?.[0];
    price = cleanNumber(q?.regularMarketPrice || q?.postMarketPrice || q?.preMarketPrice) || price;
    high52 = cleanNumber(q?.fiftyTwoWeekHigh) || high52;
    if (price) source = "yahoo-quote-usd";
  } catch (e) {}

  try {
    const j = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`, {
      referer: "https://finance.yahoo.com/"
    });
    const r = j?.chart?.result?.[0];
    const closes = (r?.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
    const highs = (r?.indicators?.quote?.[0]?.high || []).filter(Number.isFinite);
    const close = closes.length ? closes[closes.length - 1] : null;
    const maxHigh = highs.length ? Math.max(...highs) : null;
    price = cleanNumber(price || close) || price;
    high52 = cleanNumber(high52 || maxHigh) || high52;
    if (price && source === "none") source = "yahoo-chart-usd";
  } catch (e) {}

  return {
    id: item.id,
    price: price || null,
    high52: high52 || null,
    currency: "USD",
    time: nowStamp(),
    source
  };
}

async function quoteUpbit(item) {
  const code = item.code || "KRW-MVL";

  try {
    const j = await fetchJson(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(code)}`, {
      referer: "https://upbit.com/"
    });
    const price = cleanNumber(j?.[0]?.trade_price);
    return { id: item.id, price, high52: null, time: nowStamp(), source: price ? "upbit" : "none" };
  } catch (e) {}

  return { id: item.id, price: null, high52: null, time: nowStamp(), source: "none" };
}
