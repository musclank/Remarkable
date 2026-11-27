import React,{useState} from 'react';
import {PrivyProvider,usePrivy,useWallets} from '@privy-io/react-auth';
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
  const {ready,authenticated,login}=usePrivy();
  const {wallets}=useWallets();
  const connect=async()=>{
    if(!ready)throw new Error('Privy is still initializing. Please try again.');
    if(!authenticated){await login();return null;}
    const wallet=wallets.find(item=>item.chainType==='ethereum'&&item.walletClientType==='privy');
    if(!wallet)throw new Error('Your Privy embedded wallet is still being created. Please close and reopen the wallet panel in a moment.');
    const provider=await wallet.getEthereumProvider();
    return {wallet,provider};
  };
  return <LaunchModal onClose={onClose} privyConnect={connect}/>;
}

export function PrivyWalletPanel({onClose}){
  const {ready,authenticated,user,login,logout}=usePrivy();
  const {wallets}=useWallets();
  const [busy,setBusy]=useState(false);
  const embeddedWallet=wallets.find(item=>item.chainType==='ethereum'&&item.walletClientType==='privy');
  const address=embeddedWallet?.address||user?.wallet?.address||'';
  const short=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';
  const doLogin=async()=>{setBusy(true);try{await login()}finally{setBusy(false)}};
  const doLogout=async()=>{setBusy(true);try{await logout()}finally{setBusy(false)}};
  return <div className="privy-wallet-panel">
    <div className="modal-icon"><Wallet size={24}/></div>
    <div className="eyebrow"><span className="live-dot"/> PRIVY WALLET</div>
    <h3>One wallet.<br/><em>Your onchain identity.</em></h3>
    <p className="swap-intro">Sign in with your email. Privy automatically creates and manages your embedded wallet—no external wallet connection needed.</p>
    {!ready?<div className="launch-status">Initializing Privy…</div>:authenticated?<div className="launch-wallet-row"><div><small>CONNECTED WALLET</small><strong>{short(address)||'Wallet created'}</strong><span>{embeddedWallet?'Privy embedded wallet':'Privy account active'}</span></div><button className="launch-connect" onClick={doLogout} disabled={busy}><LogOut size={15}/>{busy?'Please wait':'Sign out'}</button></div>:<button className="primary-cta launch-next" onClick={doLogin} disabled={busy}>{busy?'Opening Privy…':'Create wallet with email'} <ArrowUpRight size={16}/></button>}
    <p className="launch-disclaimer">Privy manages sign-in and wallet access. Review every transaction in the wallet before approving it.</p>
    <button className="swap-cancel" onClick={onClose}><X size={14}/> Close</button>
  </div>;
}
