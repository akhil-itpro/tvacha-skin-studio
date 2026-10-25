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
  if(response.ok && available && process.argv.includes('--vision-test')) {
    // This optional live check uses a solid-colour image, never a human face.
    const fs=await import('node:fs/promises');const {default:ts}=await import('typescript');const modules={};
    for(const [name,file] of [['types','../src/domain/types.ts'],['safety','../src/domain/safety.ts'],['analysis','../src/server/analysis-client.ts']]) {
      const source=await fs.readFile(new URL(file,import.meta.url),'utf8');
      let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
      code=code.replace(/from ['"](?:\.\/|\.\.\/domain\/)([^'"]+)['"]/g,(_,dependency)=>`from '${modules[dependency]}'`);
      modules[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
    }
    const {requestPhotoAnalysis}=await import(modules.analysis);const {default:sharp}=await import('sharp');
    const jpeg=await sharp({create:{width:200,height:240,channels:3,background:'#e9f1ee'}}).jpeg().toBuffer();
    const result=await requestPhotoAnalysis(jpeg.toString('base64'),{PHOTO_AI_PROVIDER:'groq',GROQ_API_KEY:key,GROQ_ZDR_ENABLED:'true'});
    process.stdout.write(JSON.stringify({syntheticVisionCheck:!!result.analysis,imageOkay:result.analysis?.image_ok??null,retakeRequested:result.analysis?.image_ok===false,model:result.model})+'\n');
    if(!result.analysis||result.analysis.image_ok)process.exitCode=1;
  }
  if(!response.ok||!available)process.exitCode=1;
}catch{process.stderr.write('The connection could not be verified. No credential or response content was logged.\n');process.exitCode=1;}
