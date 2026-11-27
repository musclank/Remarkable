import React,{useEffect,useState} from 'react';
import {PrivyProvider,usePrivy,useWallets,useCreateWallet,getEmbeddedConnectedWallet} from '@privy-io/react-auth';
import {ArrowUpRight,Check,Copy,ExternalLink,LogOut,RefreshCw,Wallet,X} from 'lucide-react';
import LaunchModal from './LaunchModal.jsx';

export function PrivyAppProvider({appId,children}){
  return <PrivyProvider appId={appId} config={{
    appearance:{theme:'dark',accentColor:'#b5ff6d',showWalletLoginFirst:false},
    loginMethods:['email'],
    embeddedWallets:{ethereum:{createOnLogin:'all-users'}}
  }}>{children}</PrivyProvider>;
}

export function PrivyLaunchModal({onClose}){
  const {ready,authenticated,login,user}=usePrivy();
  const {wallets,ready:walletsReady}=useWallets();
  const {createWallet}=useCreateWallet();
  const connect=async()=>{
    if(!ready)throw new Error('Privy is still initializing. Please try again.');
    if(!authenticated){await login();return null;}
    const linkedWalletAddress=user?.linkedAccounts?.find(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')?.address||user?.wallet?.address||'';
    let wallet=getEmbeddedConnectedWallet(wallets)||wallets.find(item=>linkedWalletAddress&&item.address?.toLowerCase()===linkedWalletAddress.toLowerCase())||wallets.find(item=>item.walletClientType==='privy'&&item.chainType==='ethereum');
    if(!wallet){
      const existing=user?.linkedAccounts?.some(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')||(user?.wallet?.walletClientType==='privy'&&user?.wallet?.chainType==='ethereum');
      if(!existing){
        try{
          wallet=await createWallet();
        }catch(error){
          throw new Error(error?.message||'Privy could not create your embedded wallet. Check the wallet creation setting in your Privy dashboard and try again.');
        }
      }else{
        throw new Error(walletsReady?'Your Privy wallet exists but is not available in this session yet. Wait a few seconds and tap Use Privy wallet again.':'Privy is still loading your wallet. Wait a few seconds and tap Use Privy wallet again.');
      }
    }
    if(!wallet)throw new Error('Privy wallet creation did not return a wallet. Please try again.');
    const provider=await wallet.getEthereumProvider();
    return {wallet,provider};
  };
  return <LaunchModal onClose={onClose} privyConnect={connect}/>;
}

export function PrivyWalletPanel({onClose}){
  const {ready,authenticated,user,login,logout,exportWallet}=usePrivy();
  const {wallets}=useWallets();
  const [busy,setBusy]=useState(false);
  const [exportError,setExportError]=useState('');
  const [addressCopied,setAddressCopied]=useState(false);
  const [tokenAddressInput,setTokenAddressInput]=useState('');
  const [tokenAdding,setTokenAdding]=useState(false);
  const [tokenError,setTokenError]=useState('');
  const [trackedTokens,setTrackedTokens]=useState(()=>{try{return JSON.parse(localStorage.getItem('remarkable-portfolio-tokens')||'[]')}catch{return []}});
  const [tokenBalances,setTokenBalances]=useState({});
  const [tokensLoading,setTokensLoading]=useState(false);
  useEffect(()=>{try{localStorage.setItem('remarkable-portfolio-tokens',JSON.stringify(trackedTokens))}catch{}},[trackedTokens]);
  const [copyError,setCopyError]=useState('');
  const linkedWalletAddress=user?.linkedAccounts?.find(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')?.address||user?.wallet?.address||'';
  const embeddedWallet=getEmbeddedConnectedWallet(wallets)||wallets.find(item=>linkedWalletAddress&&item.address?.toLowerCase()===linkedWalletAddress.toLowerCase())||wallets.find(item=>item.walletClientType==='privy'&&item.chainType==='ethereum');
  const hasEmbeddedEthereumWallet=!!embeddedWallet||!!user?.linkedAccounts?.some(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')||(user?.wallet?.walletClientType==='privy'&&user?.wallet?.chainType==='ethereum');
  const address=embeddedWallet?.address||user?.linkedAccounts?.find(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')?.address||user?.wallet?.address||'';
  const short=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';
  const doCopyAddress=async()=>{if(!address)return;setCopyError('');try{await navigator.clipboard.writeText(address);setAddressCopied(true);setTimeout(()=>setAddressCopied(false),1800)}catch{setCopyError('Could not copy address. You can select and copy it manually.')}};
  const doLogin=async()=>{setBusy(true);try{await login()}finally{setBusy(false)}};
  const doLogout=async()=>{setBusy(true);try{await logout()}finally{setBusy(false)}};
  const doExport=async()=>{
    if(!hasEmbeddedEthereumWallet)return;
    setBusy(true);setExportError('');
    try{
      await exportWallet();
    }catch{
      setExportError('Wallet export was cancelled or could not be completed. Please try again.');
    }finally{setBusy(false)}
  };
  return <div className="privy-wallet-panel">
    <div className="modal-icon"><Wallet size={24}/></div>
    <div className="eyebrow"><span className="live-dot"/> PRIVY WALLET</div>
    <h3>One wallet.<br/><em>Your onchain identity.</em></h3>
    <p className="swap-intro">Sign in with your email. Privy automatically creates and manages your embedded wallet—no external wallet connection needed.</p>
    {!ready?<div className="launch-status">Initializing Privy…</div>:authenticated?<><div className="launch-wallet-row"><div><small>CONNECTED WALLET</small><strong>{short(address)||'Wallet created'}</strong><span>{embeddedWallet?'Privy embedded wallet':'Privy account active'}</span></div><button className="launch-connect" onClick={doLogout} disabled={busy}><LogOut size={15}/>{busy?'Please wait':'Sign out'}</button></div>{address&&<div className="privy-address-copy"><small>WALLET ADDRESS</small><code>{address}</code><button className="how-secondary" onClick={doCopyAddress}><>{addressCopied?<Check size={14}/>:<Copy size={14}/>} {addressCopied?'Copied':'Copy address'}</></button>{copyError&&<span role="status">{copyError}</span>}</div>}{hasEmbeddedEthereumWallet&&<div className="privy-export-area"><button className="primary-cta launch-next" onClick={doExport} disabled={busy}>{busy?'Opening secure export…':'Export private key'} <ArrowUpRight size={16}/></button><p className="launch-disclaimer">Privy will open its secure export flow. Never share your private key with anyone.</p>{exportError&&<div className="launch-error" role="alert">{exportError}</div>}</div>}</>:<button className="primary-cta launch-next" onClick={doLogin} disabled={busy}>{busy?'Opening Privy…':'Create wallet with email'} <ArrowUpRight size={16}/></button>}
    <p className="launch-disclaimer">Privy manages sign-in and wallet access. Review every transaction in the wallet before approving it.</p>
    <button className="swap-cancel" onClick={onClose}><X size={14}/> Close</button>
  </div>;
}


export function PrivyWalletButton({onClick}){
  const {ready,authenticated,user}=usePrivy();
  const {wallets}=useWallets();
  const linkedAddress=user?.linkedAccounts?.find(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')?.address||user?.wallet?.address||'';
  const wallet=getEmbeddedConnectedWallet(wallets)||wallets.find(item=>linkedAddress&&item.address?.toLowerCase()===linkedAddress.toLowerCase())||wallets.find(item=>item.walletClientType==='privy'&&item.chainType==='ethereum');
  const address=wallet?.address||linkedAddress;
  const short=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';
  const label=!ready?'Loading wallet…':authenticated?(short(address)||'Wallet connected'):'Connect wallet';
  return <button className="wallet-btn" onClick={onClick} aria-label={authenticated?'Open connected wallet':'Connect wallet'} title={address||'Connect wallet'}><Wallet size={16}/><span>{label}</span></button>;
}

async function portfolioRpc(rpc,method,params){
  const response=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  if(!response.ok)throw new Error('Network request failed');
  const data=await response.json();
  if(data.error)throw new Error(data.error.message||'Blockchain request failed');
  return data.result;
}
function decodeErc20Text(hex){
  if(!hex||hex==='0x')return '';
  const body=hex.slice(2);
  let bytes;
  if(body.length>=128){
    const offset=Number(BigInt('0x'+body.slice(0,64)))*2;
    const length=Number(BigInt('0x'+body.slice(offset,offset+64)))*2;
    if(Number.isFinite(length)&&length>0&&offset+64+length<=body.length)bytes=body.slice(offset+64,offset+64+length);
  }
  if(!bytes)bytes=body.replace(/(00)+$/i,'');
  try{return new TextDecoder().decode(Uint8Array.from(bytes.match(/.{1,2}/g)||[],pair=>parseInt(pair,16))).trim()}catch{return ''}
}
function formatTokenUnits(raw,decimals){
  const value=BigInt(raw||'0x0'),scale=10n**BigInt(decimals),whole=value/scale,fraction=(value%scale).toString().padStart(decimals,'0').slice(0,6).replace(/0+$/,'');
  return whole.toString()+(fraction?'.'+fraction:'');
}

export function PrivyPortfolioPanel({onClose}){
  const {ready,authenticated,user,login}=usePrivy();
  const {wallets}=useWallets();
  const [network,setNetwork]=useState('base'),[refreshTick,setRefreshTick]=useState(0),[balance,setBalance]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [addressCopied,setAddressCopied]=useState(false);
  const copyPortfolioAddress=async()=>{if(!address)return;try{await navigator.clipboard.writeText(address);setAddressCopied(true);setTimeout(()=>setAddressCopied(false),1800)}catch{setError('Could not copy address. Select and copy it manually.')}};
  const linkedAddress=user?.linkedAccounts?.find(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')?.address||user?.wallet?.address||'';
  const wallet=getEmbeddedConnectedWallet(wallets)||wallets.find(item=>linkedAddress&&item.address?.toLowerCase()===linkedAddress.toLowerCase())||wallets.find(item=>item.walletClientType==='privy'&&item.chainType==='ethereum');
  const address=wallet?.address||linkedAddress;
  const explorerUrl=network==='base'?'https://basescan.org/address/'+address:network==='ethereum'?'https://etherscan.io/address/'+address:'https://bscscan.com/address/'+address;
  const networks={ethereum:{name:'Ethereum',symbol:'ETH',rpc:'https://ethereum-rpc.publicnode.com'},base:{name:'Base',symbol:'ETH',rpc:'https://base-rpc.publicnode.com'},bsc:{name:'BNB Chain',symbol:'BNB',rpc:'https://bsc-rpc.publicnode.com'}};
  useEffect(()=>{
    if(!ready||!authenticated||!address){setBalance('');return;}
    const networkInfo=networks[network],controller=new AbortController();let active=true;setLoading(true);setError('');
    fetch(networkInfo.rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getBalance',params:[address,'latest']}),signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('RPC request failed');return response.json()})
      .then(result=>{if(result.error)throw new Error(result.error.message||'Unable to read balance');const wei=BigInt(result.result||'0x0'),whole=wei/1000000000000000000n,fraction=(wei%1000000000000000000n).toString().padStart(18,'0').slice(0,6);if(active)setBalance(whole.toString()+'.'+fraction)})
      .catch(err=>{if(active&&err.name!=='AbortError')setError(err.message||'Unable to load balance')})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false;controller.abort()};
  },[ready,authenticated,address,network,refreshTick]);
  useEffect(()=>{
    if(!ready||!authenticated||!address){setTokenBalances({});return;}
    const controller=new AbortController();let active=true;setTokensLoading(true);
    const list=trackedTokens.filter(item=>item.network===network);
    Promise.all(list.map(async token=>{
      try{
        const data='0x70a08231'+address.toLowerCase().replace(/^0x/,'').padStart(64,'0');
        const raw=await portfolioRpc(networks[network].rpc,'eth_call',[{to:token.address,data},'latest']);
        return [token.address.toLowerCase(),{value:formatTokenUnits(raw,token.decimals),error:''}];
      }catch(error){return [token.address.toLowerCase(),{value:'—',error:error.message||'Balance unavailable'}]}
    })).then(entries=>{if(active)setTokenBalances(Object.fromEntries(entries))}).finally(()=>{if(active)setTokensLoading(false)});
    return()=>{active=false;controller.abort()};
  },[ready,authenticated,address,network,refreshTick,trackedTokens]);
  const addPortfolioToken=async()=>{
    const tokenAddress=tokenAddressInput.trim();
    if(!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)){setTokenError('Enter a valid ERC-20 contract address.');return;}
    if(trackedTokens.some(item=>item.network===network&&item.address.toLowerCase()===tokenAddress.toLowerCase())){setTokenError('This token is already in your portfolio list.');return;}
    setTokenAdding(true);setTokenError('');
    try{
      const rpc=networks[network].rpc;
      const code=await portfolioRpc(rpc,'eth_getCode',[tokenAddress,'latest']);
      if(!code||code==='0x')throw new Error('No token contract found at this address on the selected network.');
      const [symbolHex,decimalsHex]=await Promise.all([
        portfolioRpc(rpc,'eth_call',[{to:tokenAddress,data:'0x95d89b41'},'latest']),
        portfolioRpc(rpc,'eth_call',[{to:tokenAddress,data:'0x313ce567'},'latest'])
      ]);
      const symbol=decodeErc20Text(symbolHex)||'TOKEN';
      const decimals=Number(BigInt(decimalsHex));
      if(!Number.isInteger(decimals)||decimals<0||decimals>36)throw new Error('Token returned invalid decimals.');
      setTrackedTokens(items=>[...items,{network,address:tokenAddress,symbol,decimals}]);
      setTokenAddressInput('');
    }catch(error){setTokenError(error.message||'Could not read token contract. Check network and address.')}
    finally{setTokenAdding(false)}
  };
  const removePortfolioToken=token=>setTrackedTokens(items=>items.filter(item=>!(item.network===token.network&&item.address.toLowerCase()===token.address.toLowerCase())));
  const short=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';
  return <div className="privy-portfolio-panel"><div className="modal-icon"><Wallet size={24}/></div><div className="eyebrow"><span className="live-dot"/> MY PORTFOLIO</div><h3>Your onchain<br/><em>balance.</em></h3><p className="swap-intro">Read-only wallet balance. This panel never requests permission to move your funds.</p>{!ready?<div className="launch-status">Initializing wallet…</div>:!authenticated?<><p className="portfolio-empty">Connect your Privy wallet to view your native balance.</p><button className="primary-cta launch-next" onClick={()=>login()}>Connect wallet <ArrowUpRight size={16}/></button></>:<><div className="portfolio-wallet-address"><small>WALLET ADDRESS</small><strong>{short(address)}</strong><div className="portfolio-address-actions"><button type="button" onClick={copyPortfolioAddress}><>{addressCopied?<Check size={13}/>:<Copy size={13}/>} {addressCopied?'Copied':'Copy address'}</></button><a href={explorerUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/> View on explorer</a></div></div><label className="portfolio-network">NETWORK<select value={network} onChange={event=>setNetwork(event.target.value)}>{Object.entries(networks).map(([key,item])=><option key={key} value={key}>{item.name}</option>)}</select></label><div className="portfolio-balance"><small>NATIVE BALANCE · {networks[network].symbol}</small><strong>{loading?'Loading…':balance?Number(balance).toLocaleString(undefined,{maximumFractionDigits:6}):'—'} <em>{networks[network].symbol}</em></strong><span>{loading?'Reading balance from public RPC':error||'Live onchain balance · read-only'}</span><button type="button" className="portfolio-refresh" onClick={()=>setRefreshTick(value=>value+1)} disabled={loading}><RefreshCw size={13} className={loading?'spin':''}/> {loading?'Refreshing…':'Refresh balance'}</button></div>{error&&<button className="how-secondary" onClick={()=>setRefreshTick(value=>value+1)}>Try again</button>}<section className="portfolio-token-section"><div className="portfolio-token-heading"><strong>ERC-20 TOKENS</strong><span>{trackedTokens.filter(item=>item.network===network).length} tracked</span></div><form className="portfolio-token-add" onSubmit={event=>{event.preventDefault();addPortfolioToken()}}><input value={tokenAddressInput} onChange={event=>setTokenAddressInput(event.target.value)} placeholder="Token contract address" aria-label="ERC-20 token contract address" autoComplete="off"/><button type="submit" disabled={tokenAdding||!tokenAddressInput.trim()}>{tokenAdding?'Checking…':'Add token'}</button></form>{tokenError&&<p className="portfolio-token-error" role="alert">{tokenError}</p>}{tokensLoading&&<p className="portfolio-token-note">Loading token balances…</p>}{trackedTokens.filter(item=>item.network===network).length===0&&!tokensLoading&&<p className="portfolio-token-note">Add an ERC-20 contract address to track its balance on this network.</p>}<div className="portfolio-token-list">{trackedTokens.filter(item=>item.network===network).map(token=><div className="portfolio-token-row" key={token.network+token.address}><div><strong>{token.symbol}</strong><small>{short(token.address)}</small>{tokenBalances[token.address.toLowerCase()]?.error&&<small className="portfolio-token-error">{tokenBalances[token.address.toLowerCase()].error}</small>}</div><strong>{tokensLoading?'…':tokenBalances[token.address.toLowerCase()]?.value??'—'} <em>{token.symbol}</em></strong><button type="button" aria-label={'Remove '+token.symbol} onClick={()=>removePortfolioToken(token)}><X size={13}/></button></div>)}</div><p className="portfolio-token-note">Balances are read directly from the selected chain. Token prices and USD valuation are not included.</p></section></>}<button className="swap-cancel" onClick={onClose}><X size={14}/> Close</button></div>;
}
