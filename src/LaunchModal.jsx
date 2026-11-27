import React,{useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,ImagePlus,LoaderCircle,Wallet,X,ExternalLink,Copy} from 'lucide-react';
import {createPublicClient,createWalletClient,custom,http,parseEventLogs} from 'viem';
import {base,bsc} from 'viem/chains';
import {Clanker} from 'clanker-sdk/v5';

const BASE_CHAIN='0x2105';
const BSC_CHAIN='0x38';
const FOUR_MEME_MANAGER='0x5c952063c7fc8610FFDB798152D69F0B9550762b';
const FOUR_MEME_API='https://four.meme/meme-api/v1';
const FOUR_MEME_CREATE_ABI=[{type:'function',name:'_launchFee',stateMutability:'view',inputs:[],outputs:[{type:'uint256'}]},{type:'function',name:'createToken',stateMutability:'payable',inputs:[{name:'args',type:'bytes'},{name:'signature',type:'bytes'}],outputs:[]},{type:'event',name:'TokenCreate',anonymous:false,inputs:[{name:'creator',type:'address',indexed:true},{name:'token',type:'address',indexed:true},{name:'requestId',type:'uint256',indexed:false},{name:'name',type:'string',indexed:false},{name:'symbol',type:'string',indexed:false},{name:'totalSupply',type:'uint256',indexed:false},{name:'launchTime',type:'uint256',indexed:false},{name:'launchFee',type:'uint256',indexed:false}]}];
const ZERO_ADDRESS='0x0000000000000000000000000000000000000000';
const WETH_BASE='0x4200000000000000000000000000000000000006';
const USDC_BASE='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const shortAddress=value=>value?value.slice(0,6)+'…'+value.slice(-4):'';

export default function LaunchModal({onClose}){
  const [network,setNetwork]=useState('base');
  const [bscTaxEnabled,setBscTaxEnabled]=useState(false);
  const [bscTaxRate,setBscTaxRate]=useState('5');
  const [bscBurnRate,setBscBurnRate]=useState('0');
  const [bscDivideRate,setBscDivideRate]=useState('0');
  const [bscLiquidityRate,setBscLiquidityRate]=useState('100');
  const [bscRecipientRate,setBscRecipientRate]=useState('0');
  const [bscRecipientAddress,setBscRecipientAddress]=useState('');
  const [bscMinSharing,setBscMinSharing]=useState('100000');
  const [name,setName]=useState('');
  const [symbol,setSymbol]=useState('');
  const [description,setDescription]=useState('');
  const [website,setWebsite]=useState('');
  const [social,setSocial]=useState('');
  const [buyTax,setBuyTax]=useState('1');
  const [sellTax,setSellTax]=useState('1');
  const [poolToken,setPoolToken]=useState(ZERO_ADDRESS);
  const [rewardRecipients,setRewardRecipients]=useState([]);
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
  const targetChain=network==='bsc'?BSC_CHAIN:BASE_CHAIN;
  const networkConnected=Boolean(wallet&&chainId?.toLowerCase()===targetChain);
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
      const target=network==='bsc'?BSC_CHAIN:BASE_CHAIN;
      const chainConfig=network==='bsc'?{chainId:BSC_CHAIN,chainName:'BNB Smart Chain',nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},rpcUrls:['https://bsc-dataseed.binance.org/'],blockExplorerUrls:['https://bscscan.com']}:{chainId:BASE_CHAIN,chainName:'Base',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:['https://mainnet.base.org'],blockExplorerUrls:['https://basescan.org']};
      if(current.toLowerCase()!==target){
        try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:target}]})}
        catch(switchError){
          if(switchError?.code===4902){
            await provider.request({method:'wallet_addEthereumChain',params:[chainConfig]});
          }else throw switchError;
        }
        current=await provider.request({method:'eth_chainId'});
      }
      setChainId(current);
      if(current.toLowerCase()!==target)throw new Error(`Switch your wallet to ${network==='bsc'?'BNB Smart Chain':'Base'} mainnet to launch.`);
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

  const addRewardRecipient=()=>setRewardRecipients(items=>items.length<6?[...items,{recipient:'',admin:'',percent:'0'}]:items);
  const updateRewardRecipient=(index,key,value)=>setRewardRecipients(items=>items.map((item,i)=>i===index?{...item,[key]:value}:item));
  const removeRewardRecipient=index=>setRewardRecipients(items=>items.filter((_,i)=>i!==index));
  const additionalRewardPercent=rewardRecipients.reduce((sum,item)=>sum+(Number(item.percent)||0),0);
  const creatorRewardPercent=100-additionalRewardPercent;
  const validate=()=>{
    if(name.trim().length<2||name.trim().length>50)return 'Token name must be 2–50 characters.';
    if(!/^[a-zA-Z0-9]{2,25}$/.test(symbol.trim()))return 'Ticker must be 2–25 letters or numbers.';
    if(!imageFile)return 'Choose a token logo before launching.';
    if(!networkConnected)return `Connect a wallet on ${network==='bsc'?'BNB Smart Chain':'Base'} mainnet first.`;
    if(website&&!/^https?:\/\//i.test(website))return 'Website must start with https:// or http://.';
    if(social&&!/^https?:\/\//i.test(social))return 'Social link must start with https:// or http://.';
    if(network==='base'){
      const buy=Number(buyTax),sell=Number(sellTax);
      if(buyTax===''||!Number.isFinite(buy)||buy<1||buy>10)return 'Buy tax must be between 1% and 10%.';
      if(sellTax===''||!Number.isFinite(sell)||sell<1||sell>10)return 'Sell tax must be between 1% and 10%.';
    }else if(bscTaxEnabled){
      if(!['1','3','5','10'].includes(bscTaxRate))return 'Four.meme tax rate must be 1%, 3%, 5%, or 10%.';
      const allocations=[bscBurnRate,bscDivideRate,bscLiquidityRate,bscRecipientRate].map(Number);
      if(allocations.some(v=>!Number.isFinite(v)||v<0)||allocations.reduce((a,b)=>a+b,0)!==100)return 'BSC tax allocations must total exactly 100%.';
      if(Number(bscRecipientRate)>0&&!/^0x[a-fA-F0-9]{40}$/.test(bscRecipientAddress))return 'Enter a valid tax recipient wallet address.';
      if(!/^\d+$/.test(bscMinSharing)||Number(bscMinSharing)<100000)return 'Minimum holder balance must be at least 100000 token base units.';
    }
    if(rewardRecipients.some(item=>!/^0x[a-fA-F0-9]{40}$/.test(item.recipient)||!/^0x[a-fA-F0-9]{40}$/.test(item.admin)))return 'Enter valid admin and recipient wallet addresses for every reward split.';
    if(rewardRecipients.some(item=>item.percent===''||!Number.isFinite(Number(item.percent))||Number(item.percent)<=0||Number(item.percent)>100))return 'Each additional reward share must be above 0% and up to 100%.';
    if(additionalRewardPercent>100)return 'Reward shares cannot exceed 100%.';
    return '';  
  };
  const review=event=>{event.preventDefault();const issue=validate();if(issue){setError(issue);return}setError('');setStep('review')};

  const copy=async value=>{try{await navigator.clipboard.writeText(value);setCopied(true)}catch{setError('Clipboard access was blocked.')}};
  const launch=async()=>{
    setError('');
    if(!provider||!networkConnected){setError(`Connect your wallet on ${network==='bsc'?'BNB Smart Chain':'Base'} before launching.`);return}
    setLaunching(true);
    try{
      if(network==='bsc'){
        setStatus('Requesting Four.meme wallet authentication…');
        const apiPost=async(path,body,headers={})=>{const response=await fetch(`${FOUR_MEME_API}${path}`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});const json=await response.json().catch(()=>({}));if(!response.ok||String(json.code)!=='0')throw new Error(json.msg||json.message||`Four.meme request failed (${response.status}).`);return json.data;};
        const nonce=await apiPost('/private/user/nonce/generate',{accountAddress:wallet,verifyType:'LOGIN',networkCode:'BSC'});
        const walletClient=createWalletClient({account:wallet,chain:bsc,transport:custom(provider)});
        const loginSignature=await walletClient.signMessage({account:wallet,message:`You are sign in Meme ${nonce}`});
        const accessToken=await apiPost('/private/user/login/dex',{region:'WEB',langType:'EN',loginIp:'',inviteCode:'',verifyInfo:{address:wallet,networkCode:'BSC',signature:loginSignature,verifyType:'LOGIN'},walletName:'MetaMask'});
        setStatus('Uploading token logo to Four.meme…');
        const uploadForm=new FormData();uploadForm.append('file',imageFile);
        const uploadResponse=await fetch(`${FOUR_MEME_API}/private/token/upload`,{method:'POST',headers:{'meme-web-access':accessToken},body:uploadForm});const uploadJson=await uploadResponse.json().catch(()=>({}));
        if(!uploadResponse.ok||String(uploadJson.code)!=='0'||!uploadJson.data)throw new Error(uploadJson.msg||uploadJson.message||'Four.meme image upload failed.');
        const configResponse=await fetch(`${FOUR_MEME_API}/public/config`);const configJson=await configResponse.json();
        if(!configResponse.ok||String(configJson.code)!=='0')throw new Error('Could not load Four.meme public launch configuration.');
        const raisedToken=configJson.data?.raisedToken;if(!raisedToken)throw new Error('Four.meme public config did not include raisedToken; launch stopped safely.');
        const createBody={name:name.trim(),shortName:symbol.trim().toUpperCase(),desc:description.trim(),imgUrl:uploadJson.data,launchTime:Date.now(),label:'Meme',lpTradingFee:0.0025,raisedAmount:24,raisedToken,webUrl:website.trim(),twitterUrl:social.trim(),preSale:0,feePlan:false};
        if(bscTaxEnabled)createBody.tokenTaxInfo={feeRate:Number(bscTaxRate),burnRate:Number(bscBurnRate),divideRate:Number(bscDivideRate),liquidityRate:Number(bscLiquidityRate),recipientRate:Number(bscRecipientRate),recipientAddress:Number(bscRecipientRate)>0?bscRecipientAddress:'',minSharing:Number(bscMinSharing)};
        setStatus('Preparing Four.meme signed launch request…');const signed=await apiPost('/private/token/create',createBody,{'meme-web-access':accessToken});
        if(!signed?.createArg||!signed?.signature)throw new Error('Four.meme did not return a signed create payload.');
        let txValue=signed.creationFeeWei??signed.launchFeeWei??signed.value;
        if(txValue===undefined||txValue===null){const feeClient=createPublicClient({chain:bsc,transport:http()});txValue=await feeClient.readContract({address:FOUR_MEME_MANAGER,abi:FOUR_MEME_CREATE_ABI,functionName:'_launchFee'});}
        if((await provider.request({method:'eth_chainId'})).toLowerCase()!==BSC_CHAIN)throw new Error('Wallet network changed. Switch back to BNB Smart Chain and retry.');
        setStatus('Submit the Four.meme token creation transaction in your wallet…');const txHash=await walletClient.writeContract({address:FOUR_MEME_MANAGER,abi:FOUR_MEME_CREATE_ABI,functionName:'createToken',args:[signed.createArg,signed.signature],value:BigInt(txValue)});
        setTxHash(txHash);setStatus('Transaction submitted. Waiting for BSC confirmation…');const publicClient=createPublicClient({chain:bsc,transport:http()});const receipt=await publicClient.waitForTransactionReceipt({hash:txHash});
        if(receipt.status!=='success')throw new Error('Four.meme launch transaction reverted. Check BscScan for details.');
        let created='';try{const events=parseEventLogs({abi:FOUR_MEME_CREATE_ABI,logs:receipt.logs,strict:false});created=events.find(event=>event.eventName==='TokenCreate')?.args?.token||''}catch{}
        setTokenAddress(created);setStatus('Four.meme launch confirmed on BNB Smart Chain.');setStep('success');return;
      }
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
        buyFee:Number(buyTax),
        sellFee:Number(sellTax),
        pool:{pairedToken:poolToken},
        rewards:{recipients:[{recipient:wallet,admin:wallet,bps:Math.round(creatorRewardPercent*100)},...rewardRecipients.map(item=>({recipient:item.recipient,admin:item.admin,bps:Math.round(Number(item.percent)*100)}))]},
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
    <div className="launch-topline"><span className="launch-step">{step==='edit'?'01 / TOKEN DETAILS':step==='review'?'02 / REVIEW':'03 / DEPLOYED'}</span><span className="launch-network"><span className="live-dot"/> {network==='bsc'?'BNB SMART CHAIN · FOUR.MEME':'BASE MAINNET · CLANKER V5'}</span></div>
    {step==='edit'?<>
      <div className="launch-heading"><div className="modal-icon"><ImagePlus size={22}/></div><div><h3 id="launch-title">Make it <em>remarkable.</em></h3><p>Create and deploy directly with the official Clanker SDK.</p></div></div>
      <form className="launch-form" onSubmit={review}>
        <label className="launch-field"><span>Launch network</span><select value={network} onChange={e=>{setNetwork(e.target.value);setChainId('');setError('');setStatus('')}}><option value="base">Base · Clanker v5</option><option value="bsc">BNB Smart Chain · Four.meme</option></select><small>Network selection changes the launch protocol and token settings.</small></label>
        <label className="launch-upload"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage}/>{image?<img src={image} alt="Token logo preview"/>:<span className="launch-upload-placeholder"><ImagePlus size={22}/><strong>Upload token logo</strong><small>PNG, JPG, or WebP · max 2 MB</small></span>}<span className="upload-edit">{image?'Change image':'Choose image'}</span></label>
        {imageName&&<div className="launch-file-name">{imageName}</div>}
        <div className="launch-fields"><label><span>Token name</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={50} placeholder="e.g. Remarkable" required/><small>{name.length}/50</small></label><label><span>Ticker</span><input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} maxLength={25} placeholder="e.g. RMK" required/><small>{symbol.length}/25</small></label></div>
        <label className="launch-field"><span>Description <small>OPTIONAL</small></span><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} rows={3} placeholder="What is your token about?"/></label>
        <div className="launch-fields"><label><span>Website <small>OPTIONAL</small></span><input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://"/></label><label><span>X / social link <small>OPTIONAL</small></span><input type="url" value={social} onChange={e=>setSocial(e.target.value)} placeholder="https://x.com/"/></label></div>
        {network==='base'&&<div className="launch-pool-section"><div className="launch-tax-heading"><strong>Liquidity pool</strong><small>Choose the quote asset for your Clanker v5 pool</small></div><label className="launch-field"><span>Pool pair</span><select value={poolToken} onChange={e=>setPoolToken(e.target.value)}><option value={ZERO_ADDRESS}>Native ETH</option><option value={WETH_BASE}>WETH</option><option value={USDC_BASE}>USDC</option></select></label><p>The pool is created by Clanker. Pair availability follows Clanker's supported quote tokens on Base.</p></div>}
        <div className="launch-rewards-section" style={{display:network==='base'?'grid':'none'}}><div className="launch-tax-heading"><strong>Reward distribution</strong><small>Split creator rewards between wallets</small></div><div className="launch-reward-row"><div><strong>Your wallet</strong><small>{wallet?shortAddress(wallet):'Connect wallet'} · creator/admin slot</small></div><label><span>Share (%)</span><input type="number" min="0" max="100" step="0.1" value={Math.max(0,creatorRewardPercent).toFixed(1)} readOnly/><small>Auto remainder</small></label></div>{rewardRecipients.map((item,index)=><div className="launch-reward-recipient" key={index}><div className="launch-reward-fields"><label><span>Recipient wallet</span><input value={item.recipient} onChange={e=>updateRewardRecipient(index,'recipient',e.target.value.trim())} placeholder="0x..."/></label><label><span>Admin wallet</span><input value={item.admin} onChange={e=>updateRewardRecipient(index,'admin',e.target.value.trim())} placeholder="0x..."/></label><label><span>Share (%)</span><input type="number" min="0.1" max="100" step="0.1" value={item.percent} onChange={e=>updateRewardRecipient(index,'percent',e.target.value)}/></label><button type="button" className="launch-remove-recipient" onClick={()=>removeRewardRecipient(index)}>Remove</button></div></div>)}<div className="launch-reward-total"><span>Creator wallet</span><strong>{Math.max(0,creatorRewardPercent).toFixed(1)}%</strong><span>Other recipients</span><strong>{additionalRewardPercent.toFixed(1)}%</strong></div><button type="button" className="launch-add-recipient" onClick={addRewardRecipient} disabled={rewardRecipients.length>=6}>+ Add reward recipient ({rewardRecipients.length}/6)</button><p>Up to 7 reward slots total. Shares must add up to 100%. Rewards are paid in the selected pool pair.</p></div>
        {network==='base'&&<div className="launch-tax-section"><div className="launch-tax-heading"><strong>Tax settings</strong><small>Set token buy and sell tax</small></div><div className="launch-fields"><label><span>Buy tax (%)</span><input type="number" min="1" max="10" step="0.1" inputMode="decimal" value={buyTax} onChange={e=>setBuyTax(e.target.value)} required/><small>1–10%</small></label><label><span>Sell tax (%)</span><input type="number" min="1" max="10" step="0.1" inputMode="decimal" value={sellTax} onChange={e=>setSellTax(e.target.value)} required/><small>1–10%</small></label></div><p>Tax values are passed to Clanker v5 as buyFee and sellFee. Confirm the final fee behavior in your wallet before deploying.</p></div>}
        {network==='bsc'&&<div className="launch-tax-section"><div className="launch-tax-heading"><strong>Four.meme Tax Token</strong><small>Optional tax after graduation. Set a supported rate and allocate 100% of tax proceeds.</small></div><label className="launch-field"><span>Enable tax token</span><select value={bscTaxEnabled?'yes':'no'} onChange={e=>setBscTaxEnabled(e.target.value==='yes')}><option value="no">No tax token</option><option value="yes">Enable tax token</option></select></label>{bscTaxEnabled&&<><label className="launch-field"><span>Tax rate</span><select value={bscTaxRate} onChange={e=>setBscTaxRate(e.target.value)}><option value="1">1%</option><option value="3">3%</option><option value="5">5%</option><option value="10">10%</option></select></label><div className="launch-fields"><label><span>Burn allocation (%)</span><input type="number" min="0" max="100" value={bscBurnRate} onChange={e=>setBscBurnRate(e.target.value)}/></label><label><span>Holder dividends (%)</span><input type="number" min="0" max="100" value={bscDivideRate} onChange={e=>setBscDivideRate(e.target.value)}/></label><label><span>Liquidity (%)</span><input type="number" min="0" max="100" value={bscLiquidityRate} onChange={e=>setBscLiquidityRate(e.target.value)}/></label><label><span>Recipient allocation (%)</span><input type="number" min="0" max="100" value={bscRecipientRate} onChange={e=>setBscRecipientRate(e.target.value)}/></label></div>{Number(bscRecipientRate)>0&&<label className="launch-field"><span>Tax recipient wallet</span><input value={bscRecipientAddress} onChange={e=>setBscRecipientAddress(e.target.value)} placeholder="0x..."/></label>}<label className="launch-field"><span>Minimum holder balance (base units)</span><input type="number" min="100000" value={bscMinSharing} onChange={e=>setBscMinSharing(e.target.value)}/></label><p>Burn + dividends + liquidity + recipient must total 100%. Tax applies after graduation, not during the bonding curve.</p></>}</div>}
        <div className="launch-wallet-row"><div><small>DEPLOY WALLET</small><strong>{wallet?shortAddress(wallet):'Not connected'}</strong><span>{wallet?(networkConnected?`Connected · ${network==='bsc'?'BNB Smart Chain':'Base'} mainnet`:`Connected · switch to ${network==='bsc'?'BSC':'Base'}`):'Connect to continue'}</span></div><button type="button" className="launch-connect" onClick={connect} disabled={connecting||launching}>{connecting?<LoaderCircle size={15} className="spin"/>:<Wallet size={15}/>} {connecting?'Connecting':wallet?(networkConnected?'Network connected':'Switch network'):'Connect wallet'}</button></div>
        {error&&<div className="launch-error" role="alert">{error}</div>}
        <div className="launch-disclaimer">{network==='bsc'?`Four.meme launch on BNB Smart Chain${bscTaxEnabled?` with ${bscTaxRate}% tax and allocation ${bscBurnRate}% burn / ${bscDivideRate}% dividends / ${bscLiquidityRate}% liquidity / ${bscRecipientRate}% recipient`:' without a tax token'}. The signed launch payload and transaction value come from Four.meme.`:`Clanker v5 launch settings: ${buyTax}% buy tax, ${sellTax}% sell tax, ${poolToken===ZERO_ADDRESS?'native ETH':poolToken===WETH_BASE?'WETH':'USDC'} pool, rewards split ${Math.max(0,creatorRewardPercent).toFixed(1)}% to creator and ${additionalRewardPercent.toFixed(1)}% to other recipients, editable metadata and anti-sniping enabled.`} Review network and fees before confirming.</div>
        <button className="primary-cta launch-next" type="submit">Review launch <ArrowUpRight size={16}/></button>
      </form>
    </>:step==='review'?<>
      <div className="launch-heading"><div className="modal-icon">{image?<img src={image} alt=""/>:<ImagePlus size={22}/>}</div><div><h3 id="launch-title">Review your <em>launch.</em></h3><p>Logo and metadata will be uploaded and sent to Clanker SDK.</p></div></div>
      <div className="launch-review-card"><div className="launch-token-preview">{image&&<img src={image} alt=""/>}<div><strong>{name}</strong><span>${symbol.toUpperCase()}</span></div></div><p>{description||'No description added.'}</p><dl><div><dt>Network</dt><dd>{network==='bsc'?'BNB Smart Chain':'Base mainnet'}</dd></div><div><dt>Protocol</dt><dd>{network==='bsc'?'Four.meme':'Clanker v5 SDK'}</dd></div><div><dt>Pool pair</dt><dd>{poolToken===ZERO_ADDRESS?'Native ETH':poolToken===WETH_BASE?'WETH':'USDC'}</dd></div><div><dt>Creator rewards</dt><dd>{Math.max(0,creatorRewardPercent).toFixed(1)}%</dd></div>{rewardRecipients.map((item,index)=><div key={index}><dt>Reward recipient {index+1}</dt><dd>{item.recipient} · {item.percent}%</dd></div>)}<div><dt>Buy / sell tax</dt><dd>{buyTax}% / {sellTax}%</dd></div><div><dt>Creator rewards</dt><dd>{Math.max(0,creatorRewardPercent).toFixed(1)}% to your wallet</dd></div><div><dt>Anti-sniping</dt><dd>Enabled</dd></div></dl>{website&&<a href={website} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Website</a>}{social&&<a href={social} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Social</a>}</div>
      {error&&<div className="launch-error" role="alert">{error}</div>}
      {status&&<div className="launch-status" role="status">{launching&&<LoaderCircle size={15} className="spin"/>}{status}</div>}
      <div className="launch-review-actions"><button className="launch-back" onClick={()=>{setStep('edit');setError('');setStatus('')}} disabled={launching}><ArrowLeft size={15}/> Edit details</button><button className="primary-cta" onClick={launch} disabled={launching}>{launching?<LoaderCircle size={15} className="spin"/>:<ArrowUpRight size={16}/>} {launching?'Launching…':'Deploy with Clanker SDK'}</button></div>
      <p className="launch-disclaimer">Your wallet will ask you to sign and submit a real {network==='bsc'?'BNB Smart Chain':'Base'} transaction. Never share your recovery phrase or private key.</p>
    </>:<>
      <div className="launch-heading"><div className="modal-icon"><Check size={22}/></div><div><h3 id="launch-title">Token <em>deployed.</em></h3><p>{network==='bsc'?'Four.meme launch confirmed on BNB Smart Chain.':'Clanker v5 launch confirmed on Base.'}</p></div></div>
      <div className="launch-review-card launch-success"><div><small>CONTRACT ADDRESS</small><strong>{tokenAddress}</strong></div><button className="launch-copy" onClick={()=>copy(tokenAddress)}><Copy size={14}/>{copied?'Copied':'Copy address'}</button>{txHash&&<a href={(network==='bsc'?'https://bscscan.com/tx/':'https://basescan.org/tx/')+txHash} target="_blank" rel="noreferrer"><ExternalLink size={14}/> View transaction on {network==='bsc'?'BscScan':'BaseScan'}</a>}{tokenAddress&&<a href={network==='bsc'?'https://four.meme/':'https://www.clanker.world/clanker/'+tokenAddress} target="_blank" rel="noreferrer"><ExternalLink size={14}/> {network==='bsc'?'Open Four.meme':'Open token on Clanker'}</a>}</div>
      <button className="primary-cta launch-next" onClick={onClose}>Done <Check size={16}/></button>
    </>}
  </section></div>;
}
