export default async function handler(req, res) {
  const q = String(req.query.q || '').trim();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (!q) {
    return res.status(200).json({ results: [] });
  }

  const clean = q.replace(/\s/g, '');
  const results = [];

  const krNameMap = [
    { key: '한화에어로스페이스', code: '012450', name: '한화에어로스페이스', sector: '국내 방산·우주' },
    { key: '한화에어로', code: '012450', name: '한화에어로스페이스', sector: '국내 방산·우주' },
    { key: '한국항공우주산업', code: '047810', name: '한국항공우주', sector: '국내 방산·우주' },
    { key: '한국항공우주', code: '047810', name: '한국항공우주', sector: '국내 방산·우주' },
    { key: 'kai', code: '047810', name: '한국항공우주', sector: '국내 방산·우주' },
    { key: '카이', code: '047810', name: '한국항공우주', sector: '국내 방산·우주' },
    { key: '한화오션', code: '042660', name: '한화오션', sector: '국내 방산·조선' },
    { key: '한화솔루션', code: '009830', name: '한화솔루션', sector: '국내 에너지·화학' },
    { key: '한화시스템', code: '272210', name: '한화시스템', sector: '국내 방산·ICT' },
    { key: '한화', code: '000880', name: '한화', sector: '국내 지주' },
    { key: '삼성전기', code: '009150', name: '삼성전기', sector: '국내 반도체' },
    { key: '삼성전자', code: '005930', name: '삼성전자', sector: '국내 반도체' },
    { key: '삼성sdi', code: '006400', name: '삼성SDI', sector: '국내 2차전지' },
    { key: '카카오뱅크', code: '323410', name: '카카오뱅크', sector: '국내 금융' },
    { key: '카카오페이', code: '377300', name: '카카오페이', sector: '국내 금융' },
    { key: '네이버', code: '035420', name: 'NAVER', sector: '국내 플랫폼' },
    { key: 'naver', code: '035420', name: 'NAVER', sector: '국내 플랫폼' },
    { key: '현대차', code: '005380', name: '현대차', sector: '국내 대표주' },
    { key: '기아', code: '000270', name: '기아', sector: '국내 대표주' }
  ];

  const normalizedQ = q.replace(/\s/g, '').toLowerCase();

  for (const m of krNameMap) {
    if (normalizedQ.includes(m.key.toLowerCase()) || m.key.toLowerCase().includes(normalizedQ)) {
      results.push({
        symbol: m.code + '.KS',
        code: m.code,
        name: m.name,
        market: 'kr',
        exchange: 'KRX',
        type: 'stock',
        sector: m.sector,
        memo: '국내 종목명 검색 결과'
      });
    }
  }

  if (/^\d{6}$/.test(clean)) {
    results.push({
      symbol: clean + '.KS',
      code: clean,
      name: clean,
      market: 'kr',
      exchange: 'KRX',
      type: 'stock',
      sector: '국내 관심주',
      memo: '종목코드로 검색한 국내 주식'
    });
  }

  try {
    const url = 'https://query2.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=12&newsCount=0&enableFuzzyQuery=true&lang=ko-KR&region=KR';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    const data = await r.json();
    const quotes = Array.isArray(data.quotes) ? data.quotes : [];

    for (const it of quotes) {
      const symbol = it.symbol || '';
      const type = it.quoteType || it.typeDisp || '';
      const exchange = it.exchange || it.exchDisp || '';
      if (!symbol) continue;

      const isKr = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
      const code = isKr ? symbol.replace(/\.(KS|KQ)$/, '') : symbol;
      const market = isKr ? 'kr' : 'us';

      results.push({
        symbol,
        code,
        name: it.shortname || it.longname || it.name || symbol,
        market,
        exchange,
        type,
        sector: market === 'kr' ? '국내 관심주' : '미국 관심주',
        memo: '검색으로 찾은 종목'
      });
    }
  } catch (e) {}

  const seen = new Set();
  const unique = [];

  for (const r of results) {
    const key = r.symbol || r.code;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }

  return res.status(200).json({ results: unique.slice(0, 12) });
}
