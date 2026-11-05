// Deploy this as a Cloudflare Worker. Configure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION as encrypted secrets.
// Set ALLOWED_ORIGIN to the GitHub Pages origin. Never commit the Azure key.
const escapeXml=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export default {
 async fetch(request,env){
  const origin='https://petrmalatnhl19.github.io';
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers});
  if(request.headers.get('Origin')!==origin)return new Response('Forbidden',{status:403,headers});
  if(!env.AZURE_SPEECH_KEY||!env.AZURE_SPEECH_REGION)return new Response('Azure Speech is not configured',{status:503,headers});
  const length=Number(request.headers.get('Content-Length')||0);
  if(length>16000)return new Response('Payload too large',{status:413,headers});
  let data;try{data=await request.json()}catch{return new Response('Invalid JSON',{status:400,headers})}
  const paragraphs=data?.paragraphs;
  if(!Array.isArray(paragraphs)||paragraphs.length<1||paragraphs.length>30||paragraphs.some(x=>typeof x!=='string'||x.length>1200)||paragraphs.join('').length>7500)return new Response('Invalid narration',{status:400,headers});
  const safe=paragraphs.map(p=>'<p>'+escapeXml(p)+'</p>').join('<break time="500ms"/>');
  const ssml='<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="cs-CZ"><voice name="cs-CZ-AntoninNeural"><prosody rate="-7%" pitch="-2%">'+safe+'</prosody></voice></speak>';
  const azure=await fetch('https://'+env.AZURE_SPEECH_REGION+'.tts.speech.microsoft.com/cognitiveservices/v1',{method:'POST',headers:{'Ocp-Apim-Subscription-Key':env.AZURE_SPEECH_KEY,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'BangerNhlLive'},body:ssml});
  if(!azure.ok)return new Response('Speech generation unavailable',{status:502,headers});
  return new Response(azure.body,{headers:{...headers,'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=600'}});
 }
};