import React,{useEffect,useMemo,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,Check,Copy,ExternalLink,LoaderCircle,QrCode,ShieldCheck,Wallet} from 'lucide-react';

const TRANSFER_NETWORKS={
  ethereum:{chainId:1,explorer:'https://etherscan.io/tx/'},
  base:{chainId:8453,explorer:'https://basescan.org/tx/'},
  bsc:{chainId:56,explorer:'https://bscscan.com/tx/'}
};
const TRANSFER_RPCS={ethereum:'https://ethereum-rpc.publicnode.com',base:'https://base-rpc.publicnode.com',bsc:'https://bsc-rpc.publicnode.com'};
const ADDRESS_RE=/^0x[a-fA-F0-9]{40}$/;
const toUnits=(value,decimals)=>{
  if(!/^\d+(?:\.\d*)?$/.test(value)||!value.trim())throw new Error('Enter a valid amount');
  const [whole,fraction='']=value.split('.');
  if(fraction.length>decimals)throw new Error('Too many decimal places for this asset');
  return BigInt(whole)*10n**BigInt(decimals)+BigInt((fraction+'0'.repeat(decimals)).slice(0,decimals)||'0');
};
const hexQuantity=value=>'0x'+value.toString(16);
async function rpc(network,method,params){
  const response=await fetch(TRANSFER_RPCS[network],{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  if(!response.ok)throw new Error('Blockchain RPC is unavailable');
  const data=await response.json();if(data.error)throw new Error(data.error.message||'Blockchain request failed');return data.result;
}
export default function PortfolioTransferActions({address,network,networks,wallet,trackedTokens=[]}){
  const [mode,setMode]=useState('');
  const [asset,setAsset]=useState('native');
  const [recipient,setRecipient]=useState('');
  const [amount,setAmount]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [txHash,setTxHash]=useState('');
  const [copied,setCopied]=useState(false);
  const [fee,setFee]=useState('');
  const [available,setAvailable]=useState(null);
  const [balanceLoading,setBalanceLoading]=useState(false);
  const tokens=useMemo(()=>trackedTokens.filter(item=>item.network===network),[trackedTokens,network]);
  const selectedToken=tokens.find(item=>item.address.toLowerCase()===asset);
  const native=asset==='native';
  const symbol=native?(networks[network]?.symbol||'ETH'):(selectedToken?.symbol||'TOKEN');
  const explorer=TRANSFER_NETWORKS[network]?.explorer||TRANSFER_NETWORKS.base.explorer;
  useEffect(()=>{setAsset('native');setFee('');setError('');setTxHash('');setAmount('');setAvailable(null)},[network]);
  useEffect(()=>{
    if(mode!=='send'||!address||!TRANSFER_RPCS[network]){setAvailable(null);return}
    let cancelled=false;setBalanceLoading(true);setAvailable(null);
    (async()=>{
      try{
        let raw,decimals=selectedToken?.decimals??18;
        if(native){raw=await rpc(network,'eth_getBalance',[address,'latest']);
          const price=BigInt(await rpc(network,'eth_gasPrice',[]));
          const reserve=price*21000n;
          const balance=BigInt(raw);raw=hexQuantity(balance>reserve?balance-reserve:0n);
        }else{raw=await rpc(network,'eth_call',[{to:selectedToken.address,data:'0x70a08231'+address.slice(2).toLowerCase().padStart(64,'0')},'latest']);}
        if(!cancelled)setAvailable({units:BigInt(raw),decimals});
      }catch{if(!cancelled)setAvailable(null)}finally{if(!cancelled)setBalanceLoading(false)}
    })();
    return()=>{cancelled=true}
  },[mode,address,network,asset,native,selectedToken]);
  const choosePercent=percent=>{
    if(!available)return;
    const units=available.units*BigInt(percent)/100n;
    const base=10n**BigInt(available.decimals);
    const whole=units/base;const fraction=(units%base).toString().padStart(available.decimals,'0').replace(/0+$/,'');
    setAmount(fraction?whole.toString()+'.'+fraction:whole.toString());
  };
  const receiveCopy=async()=>{try{await navigator.clipboard.writeText(address);setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{setError('Copy failed. Select and copy your wallet address manually')}};
  const send=async()=>{
    setError('');setTxHash('');
    if(!wallet||!address) return setError('Your wallet is not available. Reconnect and try again');
    if(!ADDRESS_RE.test(recipient.trim()))return setError('Enter a valid recipient wallet address');
    if(recipient.trim().toLowerCase()===address.toLowerCase())return setError('Recipient address is the same as your wallet');
    let units;try{units=toUnits(amount,selectedToken?.decimals??18);if(units<=0n)throw new Error('Amount must be greater than zero')}catch(e){return setError(e.message)}
    setBusy(true);
    try{
      const provider=await wallet.getEthereumProvider();
      const chainId=TRANSFER_NETWORKS[network].chainId;
      try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:hexQuantity(BigInt(chainId))}]})}
      catch(switchError){
        if(wallet.switchChain)await wallet.switchChain(chainId);
        else throw new Error('Please switch your wallet to '+networks[network].name+' and try again');
      }
      const tx={from:address,to:native?recipient.trim():selectedToken.address,value:native?hexQuantity(units):'0x0'};
      if(!native)tx.data='0xa9059cbb'+recipient.trim().slice(2).toLowerCase().padStart(64,'0')+units.toString(16).padStart(64,'0');
      const gas=BigInt(await rpc(network,'eth_estimateGas',[tx]));
      const gasPrice=BigInt(await rpc(network,'eth_gasPrice',[]));
      const feeWei=gas*gasPrice;
      setFee((Number(feeWei)/1e18).toLocaleString(undefined,{maximumFractionDigits:8})+' '+networks[network].symbol);
      const hash=await provider.request({method:'eth_sendTransaction',params:[{...tx,gas:hexQuantity(gas),gasPrice:hexQuantity(gasPrice)}]});
      setTxHash(hash);setAmount('');setRecipient('');
    }catch(e){setError(e?.message||'Transaction failed. Check your wallet and try again')}
    finally{setBusy(false)}
  };
  return <section className="portfolio-transfer">
    <div className="portfolio-transfer-actions">
      <button type="button" onClick={()=>{setMode('send');setError('');setTxHash('')}}><ArrowUpRight size={16}/> Send</button>
      <button type="button" onClick={()=>{setMode('receive');setError('')}}><ArrowDownLeft size={16}/> Receive</button>
    </div>
    {mode==='receive'&&<div className="portfolio-transfer-card">
      <div className="portfolio-transfer-title"><QrCode size={17}/> Receive assets <button type="button" onClick={()=>setMode('')} aria-label="Close receive"><span>×</span></button></div>
      <p>Share this address to receive assets on <strong>{networks[network]?.name}</strong>. Only send assets on this network.</p>
      <img className="portfolio-receive-qr" src={'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(address)} alt="Wallet receive address QR code"/>
      <code className="portfolio-receive-address">{address}</code>
      <button type="button" className="portfolio-transfer-primary" onClick={receiveCopy}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?'Copied address':'Copy wallet address'}</button>
    </div>}
    {mode==='send'&&<div className="portfolio-transfer-card">
      <div className="portfolio-transfer-title"><ArrowUpRight size={17}/> Send assets <button type="button" onClick={()=>setMode('')} aria-label="Close send"><span>×</span></button></div>
      <label>ASSET<select value={asset} onChange={e=>{setAsset(e.target.value);setFee('')}}><option value="native">{networks[network]?.symbol} · Native</option>{tokens.map(token=><option key={token.address} value={token.address.toLowerCase()}>{token.symbol} · Token</option>)}</select></label>
      <label>RECIPIENT ADDRESS<input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck="false"/></label>
      <label>AMOUNT ({symbol})<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label>
      <div className="portfolio-transfer-percent" aria-label="Choose percentage of available balance">{[10,20,30,40,50,60,70,80,90,100].map(percent=><button key={percent} type="button" disabled={!available||balanceLoading} onClick={()=>choosePercent(percent)}>{percent}%</button>)}</div>
      <div className="portfolio-transfer-balance">{balanceLoading?'Loading available balance…':available?`Available: ${(Number(available.units)/10**available.decimals).toLocaleString(undefined,{maximumFractionDigits:6})} ${symbol}`:'Available balance unavailable'}</div>
      {fee&&<div className="portfolio-transfer-fee">Estimated network fee <strong>{fee}</strong></div>}
      <p className="portfolio-transfer-safe"><ShieldCheck size={14}/> Review the address, network and amount carefully. Your wallet will ask you to approve the transaction.</p>
      {error&&<p className="portfolio-transfer-error" role="alert">{error}</p>}
      {txHash&&<div className="portfolio-transfer-success"><Check size={15}/> Transaction submitted <a href={explorer+txHash} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13}/></a><small>{txHash}</small></div>}
      <button type="button" className="portfolio-transfer-primary" onClick={send} disabled={busy||!recipient.trim()||!amount.trim()}>{busy?<><LoaderCircle size={15} className="spin"/> Preparing transaction…</>:<>Review & send <ArrowUpRight size={15}/></>}</button>
    </div>}
  </section>;
}
