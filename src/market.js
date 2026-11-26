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

export function normalizeMarketToken(raw, index = 0) {
  const token = raw.token || raw;
  const pool = raw.pool || (Array.isArray(raw.pools) ? raw.pools[0] : {}) || {};
  const market = raw.marketData || raw.market || raw.stats || {};
  const pick = (...values) => values.find(v => v !== undefined && v !== null && v !== '');
  const name = pick(token.name, raw.name, token.tokenName, raw.tokenName, token.symbol, raw.symbol, 'Unknown token');
  const symbol = String(pick(token.symbol, raw.symbol, raw.ticker, name)).replace(/^\\$/, '').toUpperCase();
  const cap = pick(raw.marketCap, raw.market_cap, raw.fdv, token.marketCap, token.market_cap, pool.marketCap, pool.market_cap, market.marketCap, market.market_cap, market.fdv);
  const volume = pick(raw.volume24h, raw.volume_24h, raw.volume24H, raw.volume?.h24, raw.volume, token.volume24h, pool.volume24h, pool.volume_24h, market.volume24h, market.volume_24h, market.volume);
  let change = pick(raw.priceChange24h, raw.price_change_24h, raw.change24h, raw.change_24h, raw.priceChangePercent24h, raw.price_change_percent_24h, raw.priceChange?.h24, token.priceChange24h, pool.priceChange24h, pool.priceChange?.h24, market.priceChange24h, market.change24h, market.priceChangePercent24h);
  if (change && typeof change === 'object') change = pick(change.percent, change.percentage, change.value);
  const address = pick(token.address, token.tokenAddress, token.contractAddress, token.mint, raw.address, raw.tokenAddress, raw.contractAddress, raw.mint, pool.tokenAddress, pool.baseTokenAddress, '');
  const chain = String(pick(token.chain, raw.chain, token.network, raw.network, token.chainName, raw.chainName, token.chainId, raw.chainId, 'BASE')).toUpperCase();
  const color = raw.color || ['#b5ff6d','#a78bfa','#ffb8dc','#75d8ff','#ff9e68','#d4d7e3'][index % 6];
  return { id:String(pick(raw.id, token.id, address, symbol + '-' + index)), name, symbol, desc:pick(token.description, raw.description, raw.desc, 'Clanker token · onchain culture, moving in real time.'), chain:chain.includes('BASE') || chain === '8453' ? 'BASE' : chain, cap:money(cap), vol:money(volume), change:change === null || change === undefined ? '—' : (Number(change) > 0 ? '+' : '') + Number(change).toFixed(2) + '%', color, icon:pick(token.icon, raw.icon, raw.info?.imageUrl, '✦'), type:pick(raw.type, raw.category, 'Trending'), address:address || 'Address not supplied by Clanker API', raw };
}
export async function loadMarketTokens(endpoint = '/api/clanker/trending', signal) {
  const response = await fetch(endpoint, {signal, headers:{Accept:'application/json'}});
  if (!response.ok) throw new Error('Clanker API responded with ' + response.status);
  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : payload.tokens || payload.data || payload.results || payload.pools;
  if (!Array.isArray(list) || !list.length) throw new Error('Clanker API returned no token records');
  return {tokens:list.slice(0,10).map(normalizeMarketToken), live:true, source:payload.source || 'Clanker'};
}
