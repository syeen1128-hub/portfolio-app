export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).send("");
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const items = Array.isArray(body.items) ? body.items : [];

    const results = await Promise.allSettled(
      items.map((item) => withTimeout(getQuote(item), 6500, item))
    );

    const quotes = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;

      const item = items[i] || {};
      return {
        id: item.id,
        price: null,
        time: nowStamp(),
        source: "error",
        error: String((r.reason && r.reason.message) || r.reason || "unknown"),
      };
    });

    return res.status(200).json({
      quotes,
      time: nowStamp(),
    });
  } catch (err) {
    return res.status(200).json({
      quotes: [],
      error: String((err && err.message) || err),
    });
  }
}

function withTimeout(promise, ms, item) {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            id: item.id,
            price: null,
            time: nowStamp(),
            source: "timeout",
          }),
        ms
      )
    ),
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
  const n = Number(String(v).replace(/[,\s원]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchText(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: opts.accept || "*/*",
      Referer: opts.referer || "https://finance.naver.com/",
      ...(opts.headers || {}),
    },
  });

  if (!response.ok) throw new Error("http " + response.status);
  return await response.text();
}

async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, {
    ...opts,
    accept: "application/json",
  });

  return JSON.parse(text);
}

async function quoteKr(item) {
  const code = String(item.code || "").padStart(6, "0");

  try {
    const j = await fetchJson(
      `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/basic`
    );

    const price = cleanNumber(
      j.closePrice || j.now || j.price || j.nv || j.lastPrice
    );

    if (price) {
      return {
        id: item.id,
        price,
        time: nowStamp(),
        source: "naver-basic",
      };
    }
  } catch (e) {}

  try {
    const j = await fetchJson(
      `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${encodeURIComponent(
        code
      )}`
    );

    const data = j?.result?.areas?.[0]?.datas?.[0];
    const price = cleanNumber(data?.nv || data?.closePrice || data?.nowVal);

    if (price) {
      return {
        id: item.id,
        price,
        time: nowStamp(),
        source: "naver-realtime",
      };
    }
  } catch (e) {}

  try {
    const j = await fetchJson(
      `https://api.finance.naver.com/service/itemSummary.naver?itemcode=${encodeURIComponent(
        code
      )}`
    );

    const price = cleanNumber(j.now || j.closePrice);

    if (price) {
      return {
        id: item.id,
        price,
        time: nowStamp(),
        source: "naver-summary",
      };
    }
  } catch (e) {}

  try {
    const txt = await fetchText(
      `https://finance.naver.com/item/sise.naver?code=${encodeURIComponent(
        code
      )}`
    );

    const m =
      txt.match(/id=["']?_nowVal["']?[^>]*>\s*([0-9,]+)/) ||
      txt.match(/class=["']?no_today["']?[\s\S]*?<span[^>]*>\s*([0-9,]+)/);

    const price = cleanNumber(m && m[1]);

    if (price) {
      return {
        id: item.id,
        price,
        time: nowStamp(),
        source: "naver-html",
      };
    }
  } catch (e) {}

  try {
    const j = await fetchJson(
      `https://finance.daum.net/api/quotes/A${encodeURIComponent(
        code
      )}?summary=false`,
      {
        referer: "https://finance.daum.net/",
        headers: {
          Accept: "application/json, text/plain, */*",
        },
      }
    );

    const price = cleanNumber(j.tradePrice || j.closePrice);

    if (price) {
      return {
        id: item.id,
        price,
        time: nowStamp(),
        source: "daum",
      };
    }
  } catch (e) {}

  return {
    id: item.id,
    price: null,
    time: nowStamp(),
    source: "none",
  };
}

async function quoteYahoo(item) {
  const symbol = String(item.code || "").trim().toUpperCase();

  try {
    const j = await fetchJson(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
        symbol
      )}`,
      {
        referer: "https://finance.yahoo.com/",
      }
    );

    const q = j?.quoteResponse?.result?.[0];
    const price = cleanNumber(
      q?.regularMarketPrice || q?.postMarketPrice || q?.preMarketPrice
    );

    if (price) {
      return {
        id: item.id,
        price: Math.round(price * 1350),
        time: nowStamp(),
        source: "yahoo-quote-krw",
      };
    }
  } catch (e) {}

  try {
    const j = await fetchJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=5d&interval=1d`,
      {
        referer: "https://finance.yahoo.com/",
      }
    );

    const r = j?.chart?.result?.[0];
    const close = r?.indicators?.quote?.[0]?.close
      ?.filter(Number.isFinite)
      .pop();

    if (close) {
      return {
        id: item.id,
        price: Math.round(close * 1350),
        time: nowStamp(),
        source: "yahoo-chart-krw",
      };
    }
  } catch (e) {}

  return {
    id: item.id,
    price: null,
    time: nowStamp(),
    source: "none",
  };
}

async function quoteUpbit(item) {
  const code = item.code || "KRW-MVL";

  try {
    const j = await fetchJson(
      `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(code)}`,
      {
        referer: "https://upbit.com/",
      }
    );

    const price = cleanNumber(j?.[0]?.trade_price);

    if (price) {
      return {
        id: item.id,
        price,
        time: nowStamp(),
        source: "upbit",
      };
    }
  } catch (e) {}

  return {
    id: item.id,
    price: null,
    time: nowStamp(),
    source: "none",
  };
}
