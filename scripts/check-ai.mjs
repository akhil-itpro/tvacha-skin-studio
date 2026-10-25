// Read a credential without putting it in shell arguments, history, files or output.
const input = await new Promise(resolve => {
  let value = '';
  const terminal = process.stdin.isTTY;
  const finish = () => {
    process.stdin.removeListener('data', onData);
    process.stdin.removeListener('end', finish);
    if(terminal)process.stdin.setRawMode(false);
    process.stdin.pause(); resolve(value.trim());
  };
  const onData = chunk => {
    value += chunk;
    if(value.includes('\u0003'))process.exit(130);
    if(value.includes('\n') || value.includes('\r'))finish();
  };
  if(terminal)process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');process.stdin.on('data',onData);process.stdin.once('end',finish);process.stdin.resume();
  process.stderr.write('Ready for hidden credential JSON on stdin.\n');
});
try {
  const key=JSON.parse(input);
  if(typeof key!=='string'||!key.startsWith('gsk_'))throw new Error();
  const response=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10_000)});
  const data=await response.json();
  const available=Array.isArray(data.data)&&data.data.some(model=>model.id==='qwen/qwen3.8-27b');
  process.stdout.write(JSON.stringify({status:response.status,modelAvailable:available,note:'Metadata connection check only. No photo or generation request was sent.'})+'\n');
  if(response.ok && available && (process.argv.includes('--vision-test') || process.argv.includes('--quality-test'))) {
    // This optional live check uses a solid-colour image, never a human face.
    const fs=await import('node:fs/promises');const {default:ts}=await import('typescript');const modules={};
    for(const [name,file] of [['types','../src/domain/types.ts'],['safety','../src/domain/safety.ts'],['analysis','../src/server/analysis-client.ts']]) {
      const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
      let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
      code=code.replace(/from ['"](?:\.\/|\.\.\/domain\/)([^'"]+)['"]/g,(_,dependency)=>`from '${modules[dependency]}'`);
      modules[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
    }
    const {requestPhotoAnalysis,completePhotoResult}=await import(modules.analysis);const {default:sharp}=await import('sharp');
    // Optional quality regression uses a deliberately degraded public MediaPipe test portrait.
    const qualityTest=process.argv.includes('--quality-test');
    const clearTest=process.argv.includes('--clear-test');
    const jpeg=qualityTest?await fs.readFile(new URL(clearTest?'../outputs/photo-qa/portrait-clear.jpg':'../outputs/photo-qa/portrait-low-quality.jpg',import.meta.url)):await sharp({create:{width:200,height:240,channels:3,background:'#e9f1ee'}}).jpeg().toBuffer();
    const diagnostics=[];
    const result=await requestPhotoAnalysis(jpeg.toString('base64'),{PHOTO_AI_PROVIDER:'groq',GROQ_API_KEY:key,GROQ_ZDR_ENABLED:'true'},async(url,options)=>{
      const started=Date.now();
      try {
        const r=await fetch(url,options);const diagnostic={status:r.status,elapsedMs:Date.now()-started};
        if(r.ok){
          const data=await r.clone().json();const content=data.choices?.[0]?.message?.content;
          diagnostic.finish=data.choices?.[0]?.finish_reason;diagnostic.characters=content?.length??0;
          try{const raw=JSON.parse(content);const {validateAnalysis}=await import(modules.safety);diagnostic.valid=!!validateAnalysis(raw);diagnostic.imageOkay=raw.image_ok;if(qualityTest)diagnostic.fixturePhotoTips=raw.retake_reasons;diagnostic.concernCount=raw.concerns?.length??null;diagnostic.unknowns=raw.concerns?.filter(item=>item.level===null).length??null;diagnostic.noteWordCounts=raw.concerns?.map(item=>typeof item.note==='string'?item.note.trim().split(/\s+/).length:null);}catch{diagnostic.validJSON=false;}
        }
        diagnostics.push(diagnostic);return r;
      }catch(error){diagnostics.push({error:error?.name||'RequestError',elapsedMs:Date.now()-started});throw error;}
    });
    process.stdout.write(JSON.stringify({visionCheck:!!result.analysis,fixture:qualityTest?clearTest?'clear-public-portrait':'degraded-public-portrait':'synthetic-solid-colour',imageOkay:result.analysis?.image_ok??null,unreadableConcerns:result.analysis?.concerns.filter(item=>item.level===null).length??null,limitedConcerns:result.analysis?.concerns.filter(item=>item.confidence==='low').length??null,outcome:completePhotoResult(result).analysis?'photo-observations':'quiz-routine',model:result.model,diagnostics})+'\n');
    if(!result.analysis||(qualityTest?!result.analysis.image_ok:result.analysis.image_ok)||(clearTest&&result.analysis?.concerns.every(item=>item.level===null||item.confidence==='low')))process.exitCode=1;
  }
  if(!response.ok||!available)process.exitCode=1;
}catch{process.stderr.write('The connection could not be verified. No credential or response content was logged.\n');process.exitCode=1;}
