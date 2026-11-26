import React,{useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,ImagePlus,LoaderCircle,Wallet,X,ExternalLink} from 'lucide-react';

const BASE_CHAIN='0x2105';
const CLANKER_URL='https://www.clanker.world/';
const shortAddress=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';

export default function LaunchModal({onClose}){
  const [name,setName]=useState('');
  const [symbol,setSymbol]=useState('');
  const [description,setDescription]=useState('');
  const [website,setWebsite]=useState('');
  const [social,setSocial]=useState('');
  const [image,setImage]=useState('');
  const [imageName,setImageName]=useState('');
  const [wallet,setWallet]=useState('');
  const [chainId,setChainId]=useState('');
  const [connecting,setConnecting]=useState(false);
  const [step,setStep]=useState('edit');
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);

  const provider=typeof window!=='undefined'?window.ethereum:null;
  const baseConnected=Boolean(wallet&&chainId?.toLowerCase()===BASE_CHAIN);

  useEffect(()=>{
    if(!provider)return;
    provider.request({method:'eth_accounts'}).then(accounts=>{if(accounts?.[0])setWallet(accounts[0])}).catch(()=>{});
    provider.request({method:'eth_chainId'}).then(setChainId).catch(()=>{});
    const accountsChanged=accounts=>setWallet(accounts?.[0]||'');
    const chainChanged=chain=>setChainId(chain);
    provider.on?.('accountsChanged',accountsChanged);
    provider.on?.('chainChanged',chainChanged);
    return()=>{provider.removeListener?.('accountsChanged',accountsChanged);provider.removeListener?.('chainChanged',chainChanged)};
  },[provider]);

  const connect=async()=>{
    setError('');
    if(!provider){setError('No browser wallet detected. Open this site in a wallet-enabled browser, such as MetaMask or Coinbase Wallet.');return}
    setConnecting(true);
    try{
      const accounts=await provider.request({method:'eth_requestAccounts'});
      const account=accounts?.[0];
      if(!account)throw new Error('Wallet did not return an account.');
      setWallet(account);
      let current=await provider.request({method:'eth_chainId'});
      if(current.toLowerCase()!==BASE_CHAIN){
        try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:BASE_CHAIN}]})}
        catch(switchError){
          if(switchError?.code===4902){
            await provider.request({method:'wallet_addEthereumChain',params:[{chainId:BASE_CHAIN,chainName:'Base',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:['https://mainnet.base.org'],blockExplorerUrls:['https://basescan.org']}]});
          }else throw switchError;
        }
        current=await provider.request({method:'eth_chainId'});
      }
      setChainId(current);
      if(current.toLowerCase()!==BASE_CHAIN)throw new Error('Please switch your wallet to Base mainnet.');
    }catch(err){setError(err?.message||'Wallet connection failed.')}
    finally{setConnecting(false)}
  };

  const chooseImage=event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type)){setError('Use a PNG, JPG or WebP image.');return}
    if(file.size>2*1024*1024){setError('Image must be 2 MB or smaller.');return}
    const reader=new FileReader();
    reader.onload=()=>{setImage(String(reader.result||''));setImageName(file.name);setError('')};
    reader.onerror=()=>setError('Could not read this image file.');
    reader.readAsDataURL(file);
  };

  const validate=()=>{
    if(name.trim().length<2||name.trim().length>32)return 'Token name must be 2–32 characters.';
    if(!/^[a-zA-Z0-9]{2,10}$/.test(symbol.trim()))return 'Ticker must be 2–10 letters or numbers.';
    if(!image)return 'Add a token logo before reviewing the launch.';
    if(!baseConnected)return 'Connect a wallet on Base mainnet first.';
    return '';
  };
  const review=event=>{event.preventDefault();const issue=validate();if(issue){setError(issue);return}setError('');setStep('review')};
  const launchDetails=[name.trim(),'$'+symbol.trim().toUpperCase(),description.trim(),website.trim(),social.trim()].filter(Boolean).join('\n');
  const copyDetails=async()=>{try{await navigator.clipboard.writeText(launchDetails);setCopied(true)}catch{setError('Clipboard access was blocked.')}};

  return <div className="modal-backdrop launch-backdrop" onClick={onClose}><section className="modal launch-modal" role="dialog" aria-modal="true" aria-labelledby="launch-title" onClick={event=>event.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="Close launch form"><X size={18}/></button>
    <div className="launch-topline"><span className="launch-step">{step==='edit'?'01 / TOKEN DETAILS':'02 / REVIEW'}</span><span className="launch-network"><span className="live-dot"/> BASE MAINNET</span></div>
    {step==='edit'?<>
      <div className="launch-heading"><div className="modal-icon"><ImagePlus size={22}/></div><div><h3 id="launch-title">Make it <em>remarkable.</em></h3><p>Prepare your token details before deploying.</p></div></div>
      <form className="launch-form" onSubmit={review}>
        <label className="launch-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/>{image?<img src={image} alt="Token logo preview"/>:<span className="launch-upload-placeholder"><ImagePlus size={22}/><strong>Upload token logo</strong><small>PNG, JPG or WebP · max 2 MB</small></span>}<span className="upload-edit">{image?'Change image':'Choose image'}</span></label>
        {imageName&&<div className="launch-file-name">{imageName}</div>}
        <div className="launch-fields"><label><span>Token name</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={32} placeholder="e.g. Remarkable" required/><small>{name.length}/32</small></label><label><span>Ticker</span><input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={10} placeholder="e.g. RMK" required/><small>{symbol.length}/10</small></label></div>
        <label className="launch-field"><span>Description <small>OPTIONAL</small></span><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} rows={3} placeholder="What is your token about?"/></label>
        <div className="launch-fields"><label><span>Website <small>OPTIONAL</small></span><input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://"/></label><label><span>X / social link <small>OPTIONAL</small></span><input type="url" value={social} onChange={e=>setSocial(e.target.value)} placeholder="https://x.com/"/></label></div>
        <div className="launch-wallet-row"><div><small>DEPLOY WALLET</small><strong>{wallet?shortAddress(wallet):'Not connected'}</strong><span>{wallet?(baseConnected?'Connected · Base mainnet':'Connected · switch to Base'):'Connect to continue'}</span></div><button type="button" className="launch-connect" onClick={connect} disabled={connecting}>{connecting?<LoaderCircle size={15} className="spin"/>:<Wallet size={15}/>} {connecting?'Connecting':wallet?(baseConnected?'Base connected':'Switch network'):'Connect wallet'}</button></div>
        {error&&<div className="launch-error" role="alert">{error}</div>}
        <div className="launch-disclaimer">Launching creates a real onchain token. You will review the final settings and approve the transaction in your wallet. Never share your recovery phrase.</div>
        <button className="primary-cta launch-next" type="submit">Review launch <ArrowUpRight size={16}/></button>
      </form>
    </>:<>
      <div className="launch-heading"><div className="modal-icon">{image?<img src={image} alt="" />:<ImagePlus size={22}/>}</div><div><h3 id="launch-title">Review your <em>token.</em></h3><p>Check the details before continuing.</p></div></div>
      <div className="launch-review-card"><div className="launch-token-preview">{image&&<img src={image} alt=""/>}<div><strong>{name}</strong><span>$${symbol.toUpperCase()}</span></div></div><p>{description||'No description added.'}</p><dl><div><dt>Network</dt><dd>Base mainnet</dd></div><div><dt>Wallet</dt><dd>{shortAddress(wallet)}</dd></div><div><dt>Supply</dt><dd>1,000,000,000</dd></div><div><dt>Launch protocol</dt><dd>Clanker v5</dd></div></dl>{website&&<a href={website} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Website</a>}{social&&<a href={social} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Social</a>}</div>
      <div className="launch-review-note">Your token has not been deployed yet. Clanker will show the live launch settings, fees and wallet transaction for final approval.</div>
      {error&&<div className="launch-error" role="alert">{error}</div>}
      <div className="launch-review-actions"><button className="launch-back" onClick={()=>{setStep('edit');setError('')}}><ArrowLeft size={15}/> Edit details</button><button className="primary-cta" onClick={()=>window.open(CLANKER_URL,'_blank','noopener,noreferrer')}>Continue to Clanker <ArrowUpRight size={16}/></button></div>
      <button className="launch-copy" onClick={copyDetails}>{copied?<Check size={14}/>:null}{copied?'Details copied':'Copy token details'}</button>
    </>}
  </section></div>;
}
