const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});

export async function onRequest({request,env}){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const jwt=env.PINATA_JWT;
  if(!jwt)return json({error:'IPFS upload is not configured. Add PINATA_JWT to Cloudflare Pages environment variables.'},503);
  let form;
  try{form=await request.formData()}catch{return json({error:'Invalid multipart upload.'},400)}
  const file=form.get('file');
  const name=String(form.get('name')||'Remarkable token logo').slice(0,100);
  if(!file||typeof file.arrayBuffer!=='function')return json({error:'Token logo file is required.'},400);
  if(file.size<1||file.size>2*1024*1024)return json({error:'Logo must be between 1 byte and 2 MB.'},413);
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))return json({error:'Only PNG, JPG, and WebP images are accepted.'},415);
  const upload=new FormData();
  upload.append('file',file,file.name||'token-logo');
  upload.append('pinataMetadata',JSON.stringify({name}));
  upload.append('pinataOptions',JSON.stringify({cidVersion:1}));
  try{
    const response=await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS',{method:'POST',headers:{Authorization:'Bearer '+jwt},body:upload});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)return json({error:'IPFS provider rejected the upload.',detail:String(body.error||body.message||response.statusText).slice(0,300)},502);
    if(!body.IpfsHash)return json({error:'IPFS provider returned no CID.'},502);
    return json({image:'ipfs://'+body.IpfsHash,cid:body.IpfsHash});
  }catch(error){return json({error:'Could not upload logo to IPFS.',detail:String(error?.message||error).slice(0,300)},502)}
}
