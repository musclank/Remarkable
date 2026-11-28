const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*'}});
const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const addressOf=value=>String(value?.address||value?.contract_address||value?.tokenAddress||value?.token_address||value?.contractAddress||value?.token?.address||value?.token?.contract_address||value?.baseToken?.address||'').toLowerCase();
const imageFields=['image','imageUrl','imageURL','image_url','imageUri','imageURI','image_uri','img','imgUrl','img_url','icon','iconUrl','icon_url','logo','logoUrl','logo_url','tokenImage','tokenImageUrl','token_image','avatar','metadataImage','metadata_image'];
const collectImages=(value,out=[],depth=0)=>{
 if(!value||depth>8)return out;
 if(typeof value==='string'){if(/^(https?:\/\/|ipfs:\/\/|data:image\/)/i.test(value.trim()))out.push(value.trim());return out}
 if(Array.isArray(value)){for(const item of value)collectImages(item,out,depth+1);return out}
 if(typeof value==='object'){for(const key of imageFields){const v=value[key];if(typeof v==='string')collectImages(v,out,depth+1);else if(v&&typeof v==='object')collectImages(v,out,depth+1)}for(const [key,v] of Object.entries(value)){if(!imageFields.includes(key))collectImages(v,out,depth+1)}}
 return out;
};
const findMatchingImages=(payload,address)=>{
 const matches=[];
 const walk=(value,depth=0)=>{
  if(!value||depth>10)return;
  if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return}
  if(typeof value!=='object')return;
  const addr=addressOf(value);
  if(addr===address){matches.push(...collectImages(value))}
  for(const child of Object.values(value))if(child&&typeof child==='object')walk(child,depth+1);
 };
 walk(payload);
 return [...new Set(matches)];
};
const resolveGateway=value=>/^ipfs:\/\//i.test(value)?'https://ipfs.io/ipfs/'+value.replace(/^ipfs:\/\/(?:ipfs\/)?/i,''):value;
export async function onRequest({request}){
 const url=new URL(request.url);const address=url.searchParams.get('address')||'';
 if(!ADDRESS.test(address))return json({error:'Valid token address is required'},400);
 const normalized=address.toLowerCase();
 const endpoints=[
  'https://www.clanker.world/api/tokens?q='+encodeURIComponent(address)+'&chainId=8453&limit=20',
  'https://www.clanker.world/api/tokens/search?q='+encodeURIComponent(address)
 ];
 for(const endpoint of endpoints){
  try{
   const response=await fetch(endpoint,{headers:{Accept:'application/json','User-Agent':'Remarkable-Token-Explorer/1.0'}});
   if(!response.ok)continue;
   const payload=await response.json();
   const images=findMatchingImages(payload,normalized);
   for(const candidate of images){
    const resolved=resolveGateway(candidate);
    if(/\.(?:json|metadata)(?:[?#]|$)/i.test(resolved)){
     try{const metaResponse=await fetch(resolved,{headers:{Accept:'application/json'}});if(metaResponse.ok){const metadata=await metaResponse.json();const nested=collectImages(metadata);if(nested.length)return json({image:resolveGateway(nested[0]),source:'clanker-token-metadata'});}}catch{}
    }else return json({image:resolved,source:'clanker-api'});
   }
  }catch{}
 }
 try{
  const page=await fetch('https://www.clanker.world/clanker/'+address,{headers:{Accept:'text/html','User-Agent':'Remarkable-Token-Explorer/1.0'}});
  if(page.ok){
   const html=await page.text();
   const tags=html.match(/<meta\b[^>]*>/gi)||[];
   for(const tag of tags){
    const property=(tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
    const value=(tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)||[])[1]||'';
    if(/^(?:og:image|twitter:image)$/i.test(property)&&value&&/^https?:\/\//i.test(value))return json({image:value.replace(/&amp;/g,'&'),source:'clanker-page-meta'});
   }
   const embedded=html.match(/["'](?:imageUrl|image_url|imageURI|image_uri|tokenImage|logoUrl|logo_url)["']\s*:\s*["']([^"']+)["']/gi)||[];
   for(const entry of embedded){const value=entry.match(/["']([^"']+)["']\s*$/)?.[1];if(value&&/^(https?:\/\/|ipfs:\/\/)/i.test(value))return json({image:resolveGateway(value.replace(/\\u0026/g,'&')),source:'clanker-page-data'});}
  }
 }catch{}
 return json({image:'',source:'clanker',message:'Clanker did not return a public logo for this token'},404);
}
