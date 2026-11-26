const money = value => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && value.includes('$')) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toLocaleString(undefined, {maximumFractionDigits:2});
};

const pick = (...values) => values.find(v => v !== undefined && v !== null && v !== '');
const imageUrl = value => {
  if (value && typeof value === 'object') value = pick(value.url, value.imageUrl, value.src, value.uri);
  if (typeof value !== 'string') return '';
  const valueTrimmed = value.trim();
  if (/^ipfs:\/\//i.test(valueTrimmed)) {
    const path = valueTrimmed.replace(/^ipfs:\/\//i, '').replace(/^ipfs\//i, '');
    return 'https://ipfs.io/ipfs/' + path;
  }
  if (valueTrimmed.startsWith('//')) return 'https:' + valueTrimmed;
  if (/^https?:\/\//i.test(valueTrimmed) || /^data:image\//i.test(valueTrimmed)) return valueTrimmed;
  return '';
};

export function normalizeMarketToken(raw, index = 0) {
  const token = raw.baseToken || raw.token || raw;
  const pool = raw.pool || raw;
  const metadata = token.metadata || raw.metadata || raw.tokenMetadata || raw;
  const market = raw.marketData || raw.market || raw.stats || {};
  const name = pick(token.name, raw.name, token.tokenName, raw.tokenName, token.symbol, raw.symbol, 'Unknown token');
  const symbol = String(pick(token.symbol, raw.symbol, raw.ticker, name)).replace(/^\$/, '').toUpperCase();
  const cap = pick(raw.marketCap, raw.market_cap, raw.fdv, token.marketCap, token.market_cap, pool.marketCap, pool.market_cap, market.marketCap, market.market_cap, market.fdv);
  const volume = pick(raw.volume24h, raw.volume_24h, raw.volume24H, raw.volume?.h24, raw.volume, token.volume24h, pool.volume24h, pool.volume_24h, pool.volume?.h24, market.volume24h, market.volume_24h, market.volume);
  let change = pick(raw.priceChange24h, raw.price_change_24h, raw.change24h, raw.change_24h, raw.priceChangePercent24h, raw.price_change_percent_24h, raw.priceChange?.h24, token.priceChange24h, pool.priceChange24h, pool.priceChange?.h24, market.priceChange24h, market.change24h, market.priceChangePercent24h);
  if (change && typeof change === 'object') change = pick(change.percent, change.percentage, change.value);
  const address = pick(token.address, token.tokenAddress, token.contractAddress, token.mint, raw.address, raw.tokenAddress, raw.contractAddress, raw.mint, pool.tokenAddress, pool.baseTokenAddress, '');
  const chain = String(pick(token.chain, raw.chain, token.network, raw.network, token.chainName, raw.chainName, token.chainId, raw.chainId, 'BASE')).toUpperCase();
  const color = raw.color || ['#b5ff6d','#a78bfa','#ffb8dc','#75d8ff','#ff9e68','#d4d7e3'][index % 6];
  const icon = imageUrl(pick(
    token.imageUrl, token.image_url, token.logoUrl, token.logo_url, token.logoURI, token.logoUri, token.logo, token.image, token.tokenImage, token.token_image,
    raw.imageUrl, raw.image_url, raw.logoUrl, raw.logo_url, raw.imgUrl, raw.img_url, raw.logoURI, raw.logoUri, raw.logo, raw.image,
    token.info?.imageUrl, raw.info?.imageUrl, token.meta?.image, raw.tokenInfo?.image, metadata.imageUrl, metadata.image_url,
    metadata.logoURI, metadata.logo, metadata.image, raw.media?.image, raw.profile?.image
  ));
  const changeNumber = Number(change);
  return {
    id:String(pick(raw.id, token.id, address, symbol + '-' + index)),
    name, symbol,
    desc:pick(token.description, raw.description, metadata.description, raw.desc, 'Live onchain token market data.'),
    chain:chain.includes('BASE') || chain === '8453' ? 'BASE' : chain,
    cap:money(cap), vol:money(volume),
    change:change === null || change === undefined || change === '' || !Number.isFinite(changeNumber) ? '—' : (changeNumber > 0 ? '+' : '') + changeNumber.toFixed(2) + '%',
    color, icon,
    type:pick(raw.type, raw.category, 'Trending'),
    address:address || 'Address not supplied by live API',
    raw
  };
}

export async function loadMarketTokens(endpoint = '/api/clanker/trending', signal) {
  const response = await fetch(endpoint, {signal, headers:{Accept:'application/json'}});
  if (!response.ok) {
    let message = 'Live market API responded with ' + response.status;
    try { const body = await response.json(); if (body?.error) message = body.error; } catch {}
    throw new Error(message);
  }
  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : payload.tokens || payload.data?.tokens || payload.data || payload.results || payload.pools;
  if (!Array.isArray(list) || !list.length) throw new Error('No live market token records received');
  return {tokens:list.slice(0,20).map(normalizeMarketToken), live:true, source:payload.source || 'Clanker'};
}
