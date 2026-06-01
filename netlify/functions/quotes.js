exports.handler = async function(event) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const items = Array.isArray(body.items) ? body.items : [];
    const quotes = [];

    for (const item of items) {
      const q = await getQuote(item).catch(() => ({
        id: item.id,
        price: null,
        time: nowStamp(),
        source: "error"
      }));
      quotes.push(q);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ quotes })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ quotes: [], error: String(err && err.message || err) })
    };
  }
};

function nowStamp() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function cleanNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[,\s원]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function getQuote(item) {
  if (item.market === "coin") return await quoteUpbit(item);
  if (item.market === "us") return await quoteYahoo(item);
  return await quoteKr(item);
}

async function quoteKr(item) {
  const code = item.code;

  try {
    const res = await fetch(`https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${encodeURIComponent(code)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (res.ok) {
      const j = await res.json();
      const data = j && j.result && j.result.areas && j.result.areas[0] && j.result.areas[0].datas && j.result.areas[0].datas[0];
      const price = cleanNumber(data && (data.nv || data.closePrice || data.nowVal));
      if (price) {
        return {
          id: item.id,
          price,
          time: nowStamp(),
          source: "naver-realtime"
        };
      }
    }
  } catch (e) {}

  try {
    const res = await fetch(`https://api.finance.naver.com/service/itemSummary.naver?itemcode=${encodeURIComponent(code)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (res.ok) {
      const j = await res.json();
      const price = cleanNumber(j.now || j.closePrice);
      if (price) {
        return {
          id: item.id,
          price,
          time: nowStamp(),
          source: "naver-summary"
        };
      }
    }
  } catch (e) {}

  return {
    id: item.id,
    price: null,
    time: nowStamp(),
    source: "none"
  };
}

async function quoteYahoo(item) {
  const symbol = item.code;

  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (res.ok) {
      const j = await res.json();
      const q = j && j.quoteResponse && j.quoteResponse.result && j.quoteResponse.result[0];
      const price = cleanNumber(q && (q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice));

      if (price) {
        return {
          id: item.id,
          price: Math.round(price * 1350),
          time: nowStamp(),
          source: "yahoo-krw"
        };
      }
    }
  } catch (e) {}

  return {
    id: item.id,
    price: null,
    time: nowStamp(),
    source: "none"
  };
}

async function quoteUpbit(item) {
  const code = item.code || "KRW-MVL";

  try {
    const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(code)}`, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (res.ok) {
      const j = await res.json();
      const price = cleanNumber(j && j[0] && j[0].trade_price);

      if (price) {
        return {
          id: item.id,
          price,
          time: nowStamp(),
          source: "upbit"
        };
      }
    }
  } catch (e) {}

  return {
    id: item.id,
    price: null,
    time: nowStamp(),
    source: "none"
  };
}
