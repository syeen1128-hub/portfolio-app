
function guessSector(name, code, market) {
  const t = String((name || '') + ' ' + (code || '')).replace(/\s/g, '').toLowerCase();
  if (market === 'us') {
    if (/aapl|msft|nvda|googl|amzn|meta|tsla|apple|microsoft|nvidia|alphabet|amazon|tesla|애플|마이크로소프트|엔비디아|알파벳|아마존|테슬라|테슬레/.test(t)) return '미국 빅테크';
    if (/ko|coca|pep|jnj|pg|코카콜라/.test(t)) return '방어·배당';
    return '미국 관심주';
  }
  if (/000120|cj대한통운|cj통운|대한통운/.test(t)) return '국내 물류';
  if (/047810|한국항공우주|kai|카이|012450|한화에어로|한화에어로스페이스|042660|한화오션|272210|한화시스템/.test(t)) return '국내 방산·우주';
  if (/005930|009150|000660|삼성전자|삼성전기|sk하이닉스|하이닉스/.test(t)) return '국내 반도체';
  if (/006400|삼성sdi|2차전지|배터리/.test(t)) return '국내 2차전지';
  if (/035420|035720|naver|네이버|카카오/.test(t)) return '국내 플랫폼';
  if (/323410|377300|카카오뱅크|카카오페이|은행|금융/.test(t)) return '국내 금융';
  if (/005380|000270|현대차|기아/.test(t)) return '국내 자동차';
  if (/009830|한화솔루션|화학|에너지/.test(t)) return '국내 에너지·화학';
  return '국내 관심주';
}



function pickText(obj, keys) {
  for (const k of keys) {
    const v = obj && obj[k];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function collectObjects(input, out = []) {
  if (!input) return out;
  if (Array.isArray(input)) {
    for (const v of input) collectObjects(v, out);
  } else if (typeof input === 'object') {
    const code = pickText(input, ['itemCode', 'stockCode', 'code', 'symbol', 'cd']);
    const name = pickText(input, ['stockName', 'itemName', 'name', 'nm', 'korName', 'companyName']);
    if (code || name) out.push(input);
    for (const v of Object.values(input)) {
      if (typeof v === 'object') collectObjects(v, out);
    }
  }
  return out;
}

async function searchNaverStock(q) {
  const urls = [
    'https://m.stock.naver.com/api/search/all?keyword=' + encodeURIComponent(q),
    'https://m.stock.naver.com/api/search/stocks?keyword=' + encodeURIComponent(q)
  ];

  const found = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
          'Referer': 'https://m.stock.naver.com/'
        }
      });
      if (!r.ok) continue;
      const data = await r.json();
      const objs = collectObjects(data, []);
      for (const o of objs) {
        const rawCode = pickText(o, ['itemCode', 'stockCode', 'code', 'symbol', 'cd']).replace(/[^0-9A-Za-z.]/g, '');
        const rawName = pickText(o, ['stockName', 'itemName', 'name', 'nm', 'korName', 'companyName']);
        if (!rawCode || !rawName) continue;
        const code = rawCode.replace(/\.(KS|KQ)$/i, '');
        if (!/^\d{6}$/.test(code)) continue;
        found.push({
          symbol: code + '.KS',
          code,
          name: rawName,
          market: 'kr',
          exchange: 'KRX',
          type: 'stock',
          sector: guessSector(rawName, code, 'kr'),
          memo: '네이버 종목 검색 결과'
        });
      }
    } catch (e) {}
  }
  return found;
}


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
    { key: 'SK하이닉스', code: '000660', name: 'SK하이닉스', sector: '국내 반도체' },
    { key: 'LG이노텍', code: '011070', name: 'LG이노텍', sector: '국내 IT부품' },
    { key: '한미반도체', code: '042700', name: '한미반도체', sector: '국내 반도체장비' },
    { key: '이오테크닉스', code: '039030', name: '이오테크닉스', sector: '국내 반도체장비' },
    { key: '원익IPS', code: '240810', name: '원익IPS', sector: '국내 반도체장비' },
    { key: '주성엔지니어링', code: '036930', name: '주성엔지니어링', sector: '국내 반도체장비' },
    { key: '리노공업', code: '058470', name: '리노공업', sector: '국내 반도체부품' },
    { key: '에코프로', code: '086520', name: '에코프로', sector: '국내 2차전지' },
    { key: '에코프로비엠', code: '247540', name: '에코프로비엠', sector: '국내 2차전지' },
    { key: '메디톡스', code: '086900', name: '메디톡스', sector: '국내 바이오' },
    { key: '솔브레인', code: '357780', name: '솔브레인', sector: '국내 반도체소재' },
    { key: 'HPSP', code: '403870', name: 'HPSP', sector: '국내 반도체장비' },
    { key: 'LX세미콘', code: '108320', name: 'LX세미콘', sector: '국내 반도체' },
    { key: '심텍', code: '222800', name: '심텍', sector: '국내 반도체기판' },
    { key: '한솔아이원스', code: '114810', name: '한솔아이원스', sector: '국내 반도체부품' },
    { key: '셀트리온헬스케어', code: '091990', name: '셀트리온헬스케어', sector: '국내 바이오' },
    { key: 'LG에너지솔루션', code: '373220', name: 'LG에너지솔루션', sector: '국내 2차전지' },
    { key: 'LG화학', code: '051910', name: 'LG화학', sector: '국내 화학·2차전지' },
    { key: 'LG화학우', code: '051915', name: 'LG화학우', sector: '국내 화학·2차전지' },
    { key: '포스코퓨처엠', code: '003670', name: '포스코퓨처엠', sector: '국내 2차전지소재' },
    { key: 'POSCO홀딩스', code: '005490', name: 'POSCO홀딩스', sector: '국내 철강·2차전지' },
    { key: 'SK이노베이션', code: '096770', name: 'SK이노베이션', sector: '국내 정유·배터리' },
    { key: 'SK이노베이션우', code: '096775', name: 'SK이노베이션우', sector: '국내 정유·배터리' },
    { key: '천보', code: '278280', name: '천보', sector: '국내 2차전지소재' },
    { key: '나노신소재', code: '121600', name: '나노신소재', sector: '국내 2차전지소재' },
    { key: '피엔티', code: '137400', name: '피엔티', sector: '국내 2차전지장비' },
    { key: '하나기술', code: '299030', name: '하나기술', sector: '국내 2차전지장비' },
    { key: '코스모신소재', code: '005070', name: '코스모신소재', sector: '국내 2차전지소재' },
    { key: '태광산업', code: '003240', name: '태광산업', sector: '국내 화학' },
    { key: '현대차2우B', code: '005387', name: '현대차2우B', sector: '국내 자동차' },
    { key: 'HL만도', code: '204320', name: 'HL만도', sector: '국내 자동차부품' },
    { key: '한국타이어앤테크놀로지', code: '161390', name: '한국타이어앤테크놀로지', sector: '국내 타이어' },
    { key: '한온시스템', code: '018880', name: '한온시스템', sector: '국내 자동차부품' },
    { key: '하나투어', code: '039130', name: '하나투어', sector: '국내 여행' },
    { key: 'LIG넥스원', code: '079550', name: 'LIG넥스원', sector: '국내 방산' },
    { key: 'STX엔진', code: '077970', name: 'STX엔진', sector: '국내 조선·방산' },
    { key: '신한지주', code: '055550', name: '신한지주', sector: '국내 금융' },
    { key: 'KB금융', code: '105560', name: 'KB금융', sector: '국내 금융' },
    { key: '하나금융지주', code: '086790', name: '하나금융지주', sector: '국내 금융' },
    { key: '우리금융지주', code: '316140', name: '우리금융지주', sector: '국내 금융' },
    { key: '기업은행', code: '024110', name: '기업은행', sector: '국내 금융' },
    { key: 'BNK금융지주', code: '138930', name: 'BNK금융지주', sector: '국내 금융' },
    { key: 'DGB금융지주', code: '139130', name: 'DGB금융지주', sector: '국내 금융' },
    { key: 'JB금융지주', code: '175330', name: 'JB금융지주', sector: '국내 금융' },
    { key: '한국금융지주', code: '071050', name: '한국금융지주', sector: '국내 증권' },
    { key: '미래에셋증권', code: '006800', name: '미래에셋증권', sector: '국내 증권' },
    { key: 'NH투자증권', code: '005940', name: 'NH투자증권', sector: '국내 증권' },
    { key: '키움증권', code: '039490', name: '키움증권', sector: '국내 증권' },
    { key: '대신증권', code: '003540', name: '대신증권', sector: '국내 증권' },
    { key: '현대차증권', code: '001500', name: '현대차증권', sector: '국내 증권' },
    { key: '한화생명', code: '088350', name: '한화생명', sector: '국내 보험' },
    { key: '현대해상', code: '001450', name: '현대해상', sector: '국내 보험' },
    { key: 'DB손해보험', code: '005830', name: 'DB손해보험', sector: '국내 보험' },
    { key: '엔씨소프트', code: '036570', name: '엔씨소프트', sector: '국내 게임' },
    { key: '넷마블', code: '251270', name: '넷마블', sector: '국내 게임' },
    { key: '크래프톤', code: '259960', name: '크래프톤', sector: '국내 게임' },
    { key: '카카오게임즈', code: '293490', name: '카카오게임즈', sector: '국내 게임' },
    { key: '위메이드', code: '112040', name: '위메이드', sector: '국내 게임' },
    { key: '에스엠', code: '041510', name: '에스엠', sector: '국내 엔터' },
    { key: '하이브', code: '352820', name: '하이브', sector: '국내 엔터' },
    { key: '와이지엔터테인먼트', code: '122870', name: '와이지엔터테인먼트', sector: '국내 엔터' },
    { key: 'JYP Ent.', code: '035900', name: 'JYP Ent.', sector: '국내 엔터' },
    { key: '셀트리온', code: '068270', name: '셀트리온', sector: '국내 바이오' },
    { key: '한미약품', code: '128940', name: '한미약품', sector: '국내 제약' },
    { key: '유한양행', code: '000100', name: '유한양행', sector: '국내 제약' },
    { key: '종근당', code: '185750', name: '종근당', sector: '국내 제약' },
    { key: '휴젤', code: '145020', name: '휴젤', sector: '국내 바이오' },
    { key: '알테오젠', code: '196170', name: '알테오젠', sector: '국내 바이오' },
    { key: '클래시스', code: '214150', name: '클래시스', sector: '국내 의료기기' },
    { key: '리가켐바이오', code: '141080', name: '리가켐바이오', sector: '국내 바이오' },
    { key: '루닛', code: '328130', name: '루닛', sector: '국내 AI의료' },
    { key: '엘앤에프', code: '066970', name: '엘앤에프', sector: '국내 2차전지소재' },
    { key: 'POSCO홀딩스', code: '005490', name: 'POSCO홀딩스', sector: '국내 철강·2차전지' },
    { key: '포스코퓨처엠', code: '003670', name: '포스코퓨처엠', sector: '국내 2차전지소재' },
    { key: '고려아연', code: '010130', name: '고려아연', sector: '국내 비철금속' },
    { key: '동국제강', code: '001230', name: '동국제강', sector: '국내 철강' },
    { key: '금호석유', code: '011780', name: '금호석유', sector: '국내 화학' },
    { key: 'S-Oil', code: '010950', name: 'S-Oil', sector: '국내 정유' },
    { key: 'GS', code: '078930', name: 'GS', sector: '국내 지주·에너지' },
    { key: '롯데케미칼', code: '011170', name: '롯데케미칼', sector: '국내 화학' },
    { key: 'LG생활건강', code: '051900', name: 'LG생활건강', sector: '국내 소비재' },
    { key: '아모레퍼시픽', code: '090430', name: '아모레퍼시픽', sector: '국내 화장품' },
    { key: '오리온', code: '271560', name: '오리온', sector: '국내 식품' },
    { key: '농심', code: '004370', name: '농심', sector: '국내 식품' },
    { key: '오뚜기', code: '007310', name: '오뚜기', sector: '국내 식품' },
    { key: '롯데웰푸드', code: '280360', name: '롯데웰푸드', sector: '국내 식품' },
    { key: '하이트진로', code: '000080', name: '하이트진로', sector: '국내 음료' },
    { key: '이마트', code: '139480', name: '이마트', sector: '국내 유통' },
    { key: '신세계', code: '004170', name: '신세계', sector: '국내 유통' },
    { key: '롯데쇼핑', code: '023530', name: '롯데쇼핑', sector: '국내 유통' },
    { key: 'BGF리테일', code: '282330', name: 'BGF리테일', sector: '국내 유통' },
    { key: 'GS리테일', code: '007070', name: 'GS리테일', sector: '국내 유통' },
    { key: '대우건설', code: '047040', name: '대우건설', sector: '국내 건설' },
    { key: 'GS건설', code: '006360', name: 'GS건설', sector: '국내 건설' },
    { key: 'DL이앤씨', code: '375500', name: 'DL이앤씨', sector: '국내 건설' },
    { key: '삼성물산', code: '028260', name: '삼성물산', sector: '국내 지주·건설' },
    { key: '두산밥캣', code: '241560', name: '두산밥캣', sector: '국내 기계' },
    { key: '두산로보틱스', code: '454910', name: '두산로보틱스', sector: '국내 로봇' },
    { key: '두산에너빌리티', code: '034020', name: '두산에너빌리티', sector: '국내 원전·에너지' },
    { key: 'KT', code: '030200', name: 'KT', sector: '국내 통신' },
    { key: 'LG유플러스', code: '032640', name: 'LG유플러스', sector: '국내 통신' },
    { key: 'HMM', code: '011200', name: 'HMM', sector: '국내 해운' },
    { key: '한진칼', code: '180640', name: '한진칼', sector: '국내 항공·지주' },
    { key: '대한항공', code: '003490', name: '대한항공', sector: '국내 항공' },
    { key: '아시아나항공', code: '020560', name: '아시아나항공', sector: '국내 항공' },
    { key: '한국전력', code: '015760', name: '한국전력', sector: '국내 전력·공기업' },
    { key: '한전', code: '015760', name: '한국전력', sector: '국내 전력·공기업' },
    { key: 'KEPCO', code: '015760', name: '한국전력', sector: '국내 전력·공기업' },
    { key: '전력', code: '015760', name: '한국전력', sector: '국내 전력·공기업' },
    { key: '한전KPS', code: '051600', name: '한전KPS', sector: '국내 전력·정비' },
    { key: '한전기술', code: '052690', name: '한전기술', sector: '국내 전력·엔지니어링' },
    { key: '한국가스공사', code: '036460', name: '한국가스공사', sector: '국내 가스·공기업' },
    { key: '가스공사', code: '036460', name: '한국가스공사', sector: '국내 가스·공기업' },
    { key: 'KOGAS', code: '036460', name: '한국가스공사', sector: '국내 가스·공기업' },
    { key: '지역난방공사', code: '071320', name: '지역난방공사', sector: '국내 열에너지·공기업' },
    { key: '현대글로비스', code: '086280', name: '현대글로비스', sector: '국내 물류' },
    { key: 'HD현대중공업', code: '329180', name: 'HD현대중공업', sector: '국내 조선' },
    { key: 'HD현대미포', code: '010620', name: 'HD현대미포', sector: '국내 조선' },
    { key: 'HD한국조선해양', code: '009540', name: 'HD한국조선해양', sector: '국내 조선' },
    { key: 'HD현대인프라코어', code: '042670', name: 'HD현대인프라코어', sector: '국내 기계' },
    { key: 'HD현대건설기계', code: '267270', name: 'HD현대건설기계', sector: '국내 기계' },
    { key: 'HD현대에너지솔루션', code: '322000', name: 'HD현대에너지솔루션', sector: '국내 에너지' },
    { key: '현대차우', code: '005385', name: '현대차우', sector: '국내 자동차' },
    { key: '현대모비스', code: '012330', name: '현대모비스', sector: '국내 자동차' },
    { key: '현대제철', code: '004020', name: '현대제철', sector: '국내 철강' },
    { key: '현대위아', code: '011210', name: '현대위아', sector: '국내 자동차' },
    { key: '현대백화점', code: '069960', name: '현대백화점', sector: '국내 유통' },
    { key: '현대건설', code: '000720', name: '현대건설', sector: '국내 건설' },
    { key: 'HD현대', code: '267250', name: 'HD현대', sector: '국내 지주' },
    { key: '현대로템', code: '064350', name: '현대로템', sector: '국내 방산·철도' },
    { key: 'LG전자', code: '066570', name: 'LG전자', sector: '국내 가전·전장' },
    { key: 'SK텔레콤', code: '017670', name: 'SK텔레콤', sector: '국내 통신' },
    { key: '두산', code: '000150', name: '두산', sector: '국내 지주' },
    { key: '삼성전자우', code: '005935', name: '삼성전자우', sector: '국내 반도체' },
    { key: '삼성바이오로직스', code: '207940', name: '삼성바이오로직스', sector: '국내 바이오' },
    { key: '삼성에스디에스', code: '018260', name: '삼성에스디에스', sector: '국내 IT서비스' },
    { key: '삼성SDS', code: '018260', name: '삼성에스디에스', sector: '국내 IT서비스' },
    { key: '삼성생명', code: '032830', name: '삼성생명', sector: '국내 금융' },
    { key: '삼성화재', code: '000810', name: '삼성화재', sector: '국내 금융' },
    { key: '삼성증권', code: '016360', name: '삼성증권', sector: '국내 금융' },
    { key: '삼성카드', code: '029780', name: '삼성카드', sector: '국내 금융' },
    { key: '삼성중공업', code: '010140', name: '삼성중공업', sector: '국내 조선' },
    { key: '삼성E&A', code: '028050', name: '삼성E&A', sector: '국내 건설·플랜트' },
    { key: '삼성엔지니어링', code: '028050', name: '삼성E&A', sector: '국내 건설·플랜트' },
    { key: '호텔신라', code: '008770', name: '호텔신라', sector: '국내 소비·면세' },
    { key: '에스원', code: '012750', name: '에스원', sector: '국내 보안' },
    { key: '제일기획', code: '030000', name: '제일기획', sector: '국내 광고' },
    { key: '씨제이', code: '001040', name: 'CJ', sector: '국내 지주' },
    { key: 'CJ제일제당', code: '097950', name: 'CJ제일제당', sector: '국내 식품' },
    { key: '제일제당', code: '097950', name: 'CJ제일제당', sector: '국내 식품' },
    { key: 'CJ ENM', code: '035760', name: 'CJ ENM', sector: '국내 미디어·콘텐츠' },
    { key: 'CJENM', code: '035760', name: 'CJ ENM', sector: '국내 미디어·콘텐츠' },
    { key: 'CJ CGV', code: '079160', name: 'CJ CGV', sector: '국내 엔터·영화관' },
    { key: 'CGV', code: '079160', name: 'CJ CGV', sector: '국내 엔터·영화관' },
    { key: 'CJ씨푸드', code: '011150', name: 'CJ씨푸드', sector: '국내 식품' },
    { key: '스튜디오드래곤', code: '253450', name: '스튜디오드래곤', sector: '국내 미디어·콘텐츠' },
    { key: 'CJ대한통운', code: '000120', name: 'CJ대한통운', sector: '국내 물류' },
    { key: 'CJ 대한통운', code: '000120', name: 'CJ대한통운', sector: '국내 물류' },
    { key: '대한통운', code: '000120', name: 'CJ대한통운', sector: '국내 물류' },
    { key: 'cjlogi', code: '000120', name: 'CJ대한통운', sector: '국내 물류' },
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


  // 한국 6자리 종목코드 직접 입력 대응
  if (/^\d{6}$/.test(clean)) {
    results.push({
      symbol: clean + '.KS',
      code: clean,
      name: clean,
      market: 'kr',
      exchange: 'KRX',
      type: 'stock',
      sector: guessSector('', clean, 'kr'),
      memo: '종목코드로 검색한 국내 주식'
    });
  }

  try {
    // Yahoo Finance 검색: 미국/해외주식 및 일부 국내주식 검색
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
      const code = isKr ? symbol.replace(/\.(KS|KQ)$/,'') : symbol;
      const market = isKr ? 'kr' : 'us';

      results.push({
        symbol,
        code,
        name: it.shortname || it.longname || it.name || symbol,
        market,
        exchange,
        type,
        sector: guessSector(it.shortname || it.longname || it.name || symbol, code, market),
        memo: '검색으로 찾은 종목'
      });
    }
  } catch (e) {
    // ignore and return what we have
  }

  // 중복 제거
  const seen = new Set();
  const unique = [];
  for (const r of results) {
    const key = r.symbol || r.code;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }

  return res.status(200).json({ results: unique.slice(0, 80) });
}
