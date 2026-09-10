// Loaded only by the isolated test server, never by the application.
import { writeFile } from 'node:fs/promises';
const original = globalThis.fetch;
globalThis.fetch = async (input, options={}) => {
  const url = String(input);
  const json = data => Response.json(data);
  if(url.startsWith('https://api.telegram.org/file/')) return new Response(new Uint8Array([255,216,255,224,0,0,0]),{headers:{'Content-Type':'image/jpeg'}});
  if(url.startsWith('https://api.telegram.org/bot')) {
    const method = url.split('/').at(-1);
    const body = JSON.parse(options.body || '{}');
    if(method === 'getMe') return json({ok:true,result:{id:12345,username:'kopi_test_bot'}});
    if(method === 'getWebhookInfo') return json({ok:true,result:{url:''}});
    if(method === 'setWebhook') await writeFile(process.env.TEST_WEBHOOK_FILE, JSON.stringify(body));
    if(method === 'getFile') return json({ok:true,result:{file_path:'photos/test.jpg'}});
    if(method === 'sendMessage') await writeFile(process.env.TEST_MESSAGE_FILE,JSON.stringify(body));
    return json({ok:true,result:true});
  }
  if(url === 'https://api.groq.com/openai/v1/models') {
    const auth = options.headers.Authorization;
    if(auth === 'Bearer invalid-key') return new Response('',{status:401});
    if(auth === 'Bearer denied-key') return new Response('',{status:403});
    if(auth === 'Bearer limited-key') return new Response('',{status:429});
    if(auth === 'Bearer unavailable-key') return new Response('',{status:503});
    return json({data:[{id:'qwen/qwen3.6-27b'}]});
  }
  if(url === 'https://api.groq.com/openai/v1/chat/completions') {
    const body = JSON.parse(options.body);
    const caption = body.messages[1].content[1].text;
    if(!body.messages[1].content[0].image_url.url.startsWith('data:image/jpeg;base64,') || body.response_format.type !== 'json_object') throw new Error('Invalid Groq vision request');
    if(caption.includes('provider-error')) return new Response('',{status:429});
    const receipt = {is_receipt:true,details_clear:true,currency:caption.includes('foreign')?'USD':'PHP',date:'2026-09-10',amount:'234.50',description:'Test meal',category:'Food',direction:caption.includes('credit')?'credit':'debit',direction_clear:!caption.includes('unclear')};
    return json({choices:[{message:{content:JSON.stringify(receipt)}}]});
  }
  return original(input,options);
};
