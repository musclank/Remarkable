export const demoTokens = [
  {id:'1',name:'MOLT',symbol:'MOLT',desc:'The internet is evolving. So are we.',chain:'SOLANA',cap:'$4.8M',vol:'$812K',change:'+24.8%',color:'#b5ff6d',icon:'🐚',type:'Trending',address:'Demo address · not onchain'},
  {id:'2',name:'VOID CLUB',symbol:'VOID',desc:'A little darkness never hurt.',chain:'SOLANA',cap:'$1.3M',vol:'$428K',change:'+18.2%',color:'#a78bfa',icon:'◉',type:'New',address:'Demo address · not onchain'},
  {id:'3',name:'PEARL',symbol:'PRL',desc:'Find your rare thing.',chain:'BASE',cap:'$12.8M',vol:'$1.1M',change:'+12.6%',color:'#ffb8dc',icon:'✦',type:'Trending',address:'Demo address · not onchain'},
  {id:'4',name:'DEGEN DOLPHIN',symbol:'DDOL',desc:'Born to swim against the tide.',chain:'SOLANA',cap:'$720K',vol:'$205K',change:'+9.4%',color:'#75d8ff',icon:'🐬',type:'New',address:'Demo address · not onchain'},
  {id:'5',name:'SLOWBURN',symbol:'SLOW',desc:'Good things take time.',chain:'BASE',cap:'$8.1M',vol:'$640K',change:'+7.1%',color:'#ff9e68',icon:'☼',type:'Trending',address:'Demo address · not onchain'},
  {id:'6',name:'LIL GHOST',symbol:'GHOST',desc:'Here, but not really.',chain:'SOLANA',cap:'$910K',vol:'$188K',change:'+5.7%',color:'#d4d7e3',icon:'♧',type:'New',address:'Demo address · not onchain'}
];

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
  const name = raw.name || raw.tokenName || raw.symbol || 'Unknown token';
  const symbol = String(raw.symbol || raw.ticker || name).replace(/^\$/, '').toUpperCase();
  const cap = raw.marketCap ?? raw.market_cap ?? raw.fdv ?? raw.fullyDilutedValuation;
  const volume = raw.volume24h ?? raw.volume_24h ?? raw.volume;
  const change = raw.priceChange24h ?? raw.change24h ?? raw.change_24h ?? raw.price_change_24h;
  const address = raw.address || raw.mint || raw.contractAddress || '';
  return {
    id: String(raw.id || address || symbol + '-' + index),
    name, symbol,
    desc: raw.description || raw.desc || 'Onchain culture, moving in real time.',
    chain: String(raw.chain || raw.network || 'SOLANA').toUpperCase(),
    cap: money(cap), vol: money(volume),
    change: change === null || change === undefined ? '—' : (Number(change) > 0 ? '+' : '') + Number(change).toFixed(2) + '%',
    color: raw.color || demoTokens[index % demoTokens.length].color,
    icon: raw.icon || '✦',
    type: raw.type || raw.category || 'Trending',
    address: address || 'Address not supplied by market API',
    raw
  };
}

export async function loadMarketTokens(endpoint, signal) {
  if (!endpoint) return {tokens:demoTokens, live:false};
  const response = await fetch(endpoint, {signal, headers:{Accept:'application/json'}});
  if (!response.ok) throw new Error('Market API responded with ' + response.status);
  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : payload.tokens || payload.data || payload.results;
  if (!Array.isArray(list)) throw new Error('Expected an array or { tokens: [] } from market API');
  return {tokens:list.map(normalizeMarketToken), live:true};
}
