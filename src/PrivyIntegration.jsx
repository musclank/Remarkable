import React,{useState} from 'react';
import {PrivyProvider,usePrivy,useWallets,useCreateWallet,getEmbeddedConnectedWallet} from '@privy-io/react-auth';
import {ArrowUpRight,Check,LogOut,Wallet,X} from 'lucide-react';
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
  const linkedWalletAddress=user?.linkedAccounts?.find(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')?.address||user?.wallet?.address||'';
  const embeddedWallet=getEmbeddedConnectedWallet(wallets)||wallets.find(item=>linkedWalletAddress&&item.address?.toLowerCase()===linkedWalletAddress.toLowerCase())||wallets.find(item=>item.walletClientType==='privy'&&item.chainType==='ethereum');
  const hasEmbeddedEthereumWallet=!!embeddedWallet||!!user?.linkedAccounts?.some(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')||(user?.wallet?.walletClientType==='privy'&&user?.wallet?.chainType==='ethereum');
  const address=embeddedWallet?.address||user?.linkedAccounts?.find(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')?.address||user?.wallet?.address||'';
  const short=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';
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
    {!ready?<div className="launch-status">Initializing Privy…</div>:authenticated?<><div className="launch-wallet-row"><div><small>CONNECTED WALLET</small><strong>{short(address)||'Wallet created'}</strong><span>{embeddedWallet?'Privy embedded wallet':'Privy account active'}</span></div><button className="launch-connect" onClick={doLogout} disabled={busy}><LogOut size={15}/>{busy?'Please wait':'Sign out'}</button></div>{hasEmbeddedEthereumWallet&&<div className="privy-export-area"><button className="primary-cta launch-next" onClick={doExport} disabled={busy}>{busy?'Opening secure export…':'Export private key'} <ArrowUpRight size={16}/></button><p className="launch-disclaimer">Privy will open its secure export flow. Never share your private key with anyone.</p>{exportError&&<div className="launch-error" role="alert">{exportError}</div>}</div>}</>:<button className="primary-cta launch-next" onClick={doLogin} disabled={busy}>{busy?'Opening Privy…':'Create wallet with email'} <ArrowUpRight size={16}/></button>}
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

export function PrivyPortfolioPanel({onClose}){
  const {ready,authenticated,user,login}=usePrivy();
  const {wallets}=useWallets();
  const [network,setNetwork]=useState('base'),[refreshTick,setRefreshTick]=useState(0),[balance,setBalance]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const linkedAddress=user?.linkedAccounts?.find(item=>item.type==='wallet'&&item.walletClientType==='privy'&&item.chainType==='ethereum')?.address||user?.wallet?.address||'';
  const wallet=getEmbeddedConnectedWallet(wallets)||wallets.find(item=>linkedAddress&&item.address?.toLowerCase()===linkedAddress.toLowerCase())||wallets.find(item=>item.walletClientType==='privy'&&item.chainType==='ethereum');
  const address=wallet?.address||linkedAddress;
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
  const short=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';
  return <div className="privy-portfolio-panel"><div className="modal-icon"><Wallet size={24}/></div><div className="eyebrow"><span className="live-dot"/> MY PORTFOLIO</div><h3>Your onchain<br/><em>balance.</em></h3><p className="swap-intro">Read-only wallet balance. This panel never requests permission to move your funds.</p>{!ready?<div className="launch-status">Initializing wallet…</div>:!authenticated?<><p className="portfolio-empty">Connect your Privy wallet to view your native balance.</p><button className="primary-cta launch-next" onClick={()=>login()}>Connect wallet <ArrowUpRight size={16}/></button></>:<><div className="portfolio-wallet-address"><small>WALLET ADDRESS</small><strong>{short(address)}</strong></div><label className="portfolio-network">NETWORK<select value={network} onChange={event=>setNetwork(event.target.value)}>{Object.entries(networks).map(([key,item])=><option key={key} value={key}>{item.name}</option>)}</select></label><div className="portfolio-balance"><small>NATIVE BALANCE · {networks[network].symbol}</small><strong>{loading?'Loading…':balance?Number(balance).toLocaleString(undefined,{maximumFractionDigits:6}):'—'} <em>{networks[network].symbol}</em></strong><span>{loading?'Reading balance from public RPC':error||'Live onchain balance · read-only'}</span></div>{error&&<button className="how-secondary" onClick={()=>setRefreshTick(value=>value+1)}>Try again</button>}</>}<button className="swap-cancel" onClick={onClose}><X size={14}/> Close</button></div>;
}
