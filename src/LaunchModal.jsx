import React,{useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,ImagePlus,LoaderCircle,Wallet,X,ExternalLink,Copy} from 'lucide-react';
import {createPublicClient,createWalletClient,custom,http} from 'viem';
import {base} from 'viem/chains';
import {Clanker} from 'clanker-sdk/v5';

const BASE_CHAIN='0x2105';
const ZERO_ADDRESS='0x0000000000000000000000000000000000000000';
const shortAddress=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';

export default function LaunchModal({onClose}){
  const [name,setName]=useState('');
  const [symbol,setSymbol]=useState('');
  const [description,setDescription]=useState('');
  const [website,setWebsite]=useState('');
  const [social,setSocial]=useState('');
  const [image,setImage]=useState('');
  const [imageName,setImageName]=useState('');
  const [imageFile,setImageFile]=useState(null);
  const [wallet,setWallet]=useState('');
  const [chainId,setChainId]=useState('');
  const [connecting,setConnecting]=useState(false);
  const [launching,setLaunching]=useState(false);
  const [step,setStep]=useState('edit');
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');
  const [txHash,setTxHash]=useState('');
  const [tokenAddress,setTokenAddress]=useState('');
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
    if(!provider){setError('No wallet detected. Open REMARKABLE in MetaMask, Coinbase Wallet, or another EVM wallet browser.');return}
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
      if(current.toLowerCase()!==BASE_CHAIN)throw new Error('Switch your wallet to Base mainnet to launch.');
    }catch(err){setError(err?.shortMessage||err?.message||'Wallet connection failed.')}
    finally{setConnecting(false)}
  };

  const chooseImage=event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type)){setError('Use a PNG, JPG, or WebP image.');return}
    if(file.size>2*1024*1024){setError('Logo must be 2 MB or smaller.');return}
    const reader=new FileReader();
    reader.onload=()=>{setImage(String(reader.result||''));setImageName(file.name);setImageFile(file);setError('')};
    reader.onerror=()=>setError('Could not read this image file.');
    reader.readAsDataURL(file);
  };

  const validate=()=>{
    if(name.trim().length<2||name.trim().length>50)return 'Token name must be 2–50 characters.';
    if(!/^[a-zA-Z0-9]{2,25}$/.test(symbol.trim()))return 'Ticker must be 2–25 letters or numbers.';
    if(!imageFile)return 'Choose a token logo to upload to IPFS.';
    if(!baseConnected)return 'Connect a wallet on Base mainnet first.';
    if(website&&!/^https?:\/\//i.test(website))return 'Website must start with https:// or http://.';
    if(social&&!/^https?:\/\//i.test(social))return 'Social link must start with https:// or http://.';
    return '';
  };
  const review=event=>{event.preventDefault();const issue=validate();if(issue){setError(issue);return}setError('');setStep('review')};

  const copy=async value=>{try{await navigator.clipboard.writeText(value);setCopied(true)}catch{setError('Clipboard access was blocked.')}};
  const launch=async()=>{
    setError('');
    if(!provider||!baseConnected){setError('Connect your wallet on Base before launching.');return}
    setLaunching(true);
    try{
      setStatus('Uploading token logo to IPFS…');
      const form=new FormData();
      form.append('file',imageFile);
      form.append('name',name.trim()+'-'+symbol.trim().toUpperCase());
      const upload=await fetch('/api/launch/upload',{method:'POST',body:form});
      const uploadBody=await upload.json().catch(()=>({}));
      if(!upload.ok||!uploadBody?.image)throw new Error(uploadBody?.error||'Logo upload failed. Configure the IPFS upload secret in Cloudflare Pages.');
      const imageUri=uploadBody.image;
      const publicClient=createPublicClient({chain:base,transport:http()});
      const walletClient=createWalletClient({account:wallet,chain:base,transport:custom(provider)});
      const sdk=new Clanker({wallet:walletClient,publicClient,chainId:8453});
      const socialMediaUrls=[];
      if(website.trim())socialMediaUrls.push({platform:'website',url:website.trim()});
      if(social.trim())socialMediaUrls.push({platform:'x',url:social.trim()});
      const tokenConfig={
        name:name.trim(),
        symbol:symbol.trim().toUpperCase(),
        image:imageUri,
        tokenAdmin:wallet,
        chainId:8453,
        metadata:{description:description.trim(),socialMediaUrls},
        context:{interface:'Remarkable',platform:'Remarkable',messageId:'Web launch',id:symbol.trim().toUpperCase()},
        metadataEditable:true,
        buyFee:1,
        sellFee:1,
        pool:{pairedToken:ZERO_ADDRESS},
        rewards:{recipients:[{recipient:wallet,admin:wallet,bps:10000}]},
        antiSnipeEnabled:true
      };
      setStatus('Preparing Clanker v5 launch. Confirm the transaction in your wallet…');
      const submission=await sdk.deploy(tokenConfig);
      if(submission.error)throw submission.error;
      setTxHash(submission.txHash);
      setStatus('Transaction submitted. Waiting for Base confirmation…');
      const result=await submission.waitForTransaction();
      if(result.error)throw result.error;
      setTokenAddress(result.address);
      setStatus('Token deployed and confirmed on Base.');
      setStep('success');
    }catch(err){
      const message=err?.shortMessage||err?.message||String(err);
      setError(message.includes('User rejected')||message.includes('denied')?'Transaction was rejected in your wallet.':message);
      setStatus('');
    }finally{setLaunching(false)}
  };

  return <div className="modal-backdrop launch-backdrop" onClick={launching?undefined:onClose}><section className="modal launch-modal" role="dialog" aria-modal="true" aria-labelledby="launch-title" onClick={event=>event.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="Close launch form" disabled={launching}><X size={18}/></button>
    <div className="launch-topline"><span className="launch-step">{step==='edit'?'01 / TOKEN DETAILS':step==='review'?'02 / REVIEW':'03 / DEPLOYED'}</span><span className="launch-network"><span className="live-dot"/> BASE MAINNET · CLANKER V5</span></div>
    {step==='edit'?<>
      <div className="launch-heading"><div className="modal-icon"><ImagePlus size={22}/></div><div><h3 id="launch-title">Make it <em>remarkable.</em></h3><p>Create and deploy directly with the official Clanker SDK.</p></div></div>
      <form className="launch-form" onSubmit={review}>
        <label className="launch-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/>{image?<img src={image} alt="Token logo preview"/>:<span className="launch-upload-placeholder"><ImagePlus size={22}/><strong>Upload token logo</strong><small>PNG, JPG, or WebP · max 2 MB</small></span>}<span className="upload-edit">{image?'Change image':'Choose image'}</span></label>
        {imageName&&<div className="launch-file-name">{imageName}</div>}
        <div className="launch-fields"><label><span>Token name</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={50} placeholder="e.g. Remarkable" required/><small>{name.length}/50</small></label><label><span>Ticker</span><input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={25} placeholder="e.g. RMK" required/><small>{symbol.length}/25</small></label></div>
        <label className="launch-field"><span>Description <small>OPTIONAL</small></span><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} rows={3} placeholder="What is your token about?"/></label>
        <div className="launch-fields"><label><span>Website <small>OPTIONAL</small></span><input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://"/></label><label><span>X / social link <small>OPTIONAL</small></span><input type="url" value={social} onChange={e=>setSocial(e.target.value)} placeholder="https://x.com/"/></label></div>
        <div className="launch-wallet-row"><div><small>DEPLOY WALLET</small><strong>{wallet?shortAddress(wallet):'Not connected'}</strong><span>{wallet?(baseConnected?'Connected · Base mainnet':'Connected · switch to Base'):'Connect to continue'}</span></div><button type="button" className="launch-connect" onClick={connect} disabled={connecting||launching}>{connecting?<LoaderCircle size={15} className="spin"/>:<Wallet size={15}/>} {connecting?'Connecting':wallet?(baseConnected?'Base connected':'Switch network'):'Connect wallet'}</button></div>
        {error&&<div className="launch-error" role="alert">{error}</div>}
        <div className="launch-disclaimer">Clanker v5 launch settings: 1% buy tax, 1% sell tax, native ETH pool, 100% creator rewards, editable metadata and anti-sniping enabled. Review fees and network details before confirming.</div>
        <button className="primary-cta launch-next" type="submit">Review launch <ArrowUpRight size={16}/></button>
      </form>
    </>:step==='review'?<>
      <div className="launch-heading"><div className="modal-icon">{image?<img src={image} alt=""/>:<ImagePlus size={22}/>}</div><div><h3 id="launch-title">Review your <em>launch.</em></h3><p>Logo and metadata will be uploaded and sent to Clanker SDK.</p></div></div>
      <div className="launch-review-card"><div className="launch-token-preview">{image&&<img src={image} alt=""/>}<div><strong>{name}</strong><span>${symbol.toUpperCase()}</span></div></div><p>{description||'No description added.'}</p><dl><div><dt>Network</dt><dd>Base mainnet</dd></div><div><dt>Protocol</dt><dd>Clanker v5 SDK</dd></div><div><dt>Pool pair</dt><dd>ETH</dd></div><div><dt>Buy / sell tax</dt><dd>1% / 1%</dd></div><div><dt>Creator rewards</dt><dd>100% to your wallet</dd></div><div><dt>Anti-sniping</dt><dd>Enabled</dd></div></dl>{website&&<a href={website} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Website</a>}{social&&<a href={social} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Social</a>}</div>
      {error&&<div className="launch-error" role="alert">{error}</div>}
      {status&&<div className="launch-status" role="status">{launching&&<LoaderCircle size={15} className="spin"/>}{status}</div>}
      <div className="launch-review-actions"><button className="launch-back" onClick={()=>{setStep('edit');setError('');setStatus('')}} disabled={launching}><ArrowLeft size={15}/> Edit details</button><button className="primary-cta" onClick={launch} disabled={launching}>{launching?<LoaderCircle size={15} className="spin"/>:<ArrowUpRight size={16}/>} {launching?'Launching…':'Deploy with Clanker SDK'}</button></div>
      <p className="launch-disclaimer">Your wallet will ask you to sign and submit a real Base transaction. Never share your recovery phrase or private key.</p>
    </>:<>
      <div className="launch-heading"><div className="modal-icon"><Check size={22}/></div><div><h3 id="launch-title">Token <em>deployed.</em></h3><p>Clanker v5 launch confirmed on Base.</p></div></div>
      <div className="launch-review-card launch-success"><div><small>CONTRACT ADDRESS</small><strong>{tokenAddress}</strong></div><button className="launch-copy" onClick={()=>copy(tokenAddress)}><Copy size={14}/>{copied?'Copied':'Copy address'}</button>{txHash&&<a href={'https://basescan.org/tx/'+txHash} target="_blank" rel="noreferrer"><ExternalLink size={14}/> View transaction on BaseScan</a>}<a href={'https://www.clanker.world/clanker/'+tokenAddress} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open token on Clanker</a></div>
      <button className="primary-cta launch-next" onClick={onClose}>Done <Check size={16}/></button>
    </>}
  </section></div>;
}
