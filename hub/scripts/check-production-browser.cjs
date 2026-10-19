// Execute the built production JS in actual Chrome; HTTP 200/#root is insufficient.
const assert=require('node:assert/strict')
const {spawn,spawnSync}=require('node:child_process')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const host='127.0.0.1',port=4183,base='http://'+host+':'+port
const chrome=process.env.CHROME_BIN||'google-chrome'
const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--virtual-time-budget=8000']
const vite=path.join(root,'node_modules/vite/bin/vite.js')
if(!fs.existsSync(vite))throw Error('Install project dependencies before browser smoke')
const child=spawn(process.execPath,[vite,'preview','--host',host,'--port',String(port),'--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'})
let serverLogs=''
child.stdout.on('data',x=>{serverLogs+=x.toString()})
child.stderr.on('data',x=>{serverLogs+=x.toString()})
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms))
function stop(){
 if(process.platform!=='win32'&&child.pid){
  try{process.kill(-child.pid,'SIGKILL')}catch{/* process group already exited */}
 }else if(child.pid){child.kill('SIGKILL')}
}
async function main(){
 const version=spawnSync(chrome,['--version'],{encoding:'utf8',timeout:10000})
 assert.equal(version.status,0,'A real Chrome/Chromium binary is required: '+String(version.error||version.stderr))
 console.log('Browser: '+version.stdout.trim())
 const deadline=Date.now()+30000
 while(Date.now()<deadline){
  if(child.exitCode!==null)throw Error('Vite preview exited early: '+serverLogs)
  try{const r=await fetch(base+'/');if(r.ok)break}catch{/* server not accepting connections yet; retry */}
  await delay(200)
 }
 if(Date.now()>=deadline)throw Error('Vite preview did not start: '+serverLogs)
 const cases=[['/','page-index'],['/config','page-config'],['/flasher','page-flasher'],['/tally/demo','page-tally-web']]
 for(const [route,required] of cases){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'vtally-chrome-'))
  try{
   const result=spawnSync(chrome,[...args,'--user-data-dir='+profile,'--dump-dom',base+route],{encoding:'utf8',timeout:45000,maxBuffer:16*1024*1024})
   assert.equal(result.status,0,'Chromium failed to run '+route+': '+result.stderr)
   const html=result.stdout||''
   assert.ok(html.includes('data-testid="'+required+'"'),
     'Production React did NOT render '+required+' on '+route+'. Chrome stderr: '+(result.stderr||'').slice(-1500)+'; HTML: '+html.slice(-3000))
   assert.ok(!html.includes('Class extends value #<Object> is not a constructor'), 'Known OBS bundle runtime error')
   console.log('PASS: production JS rendered '+required+' on '+route)
  }finally{fs.rmSync(profile,{recursive:true,force:true})}
 }
 console.log('Production Chrome browser smoke PASS (without physical backend acceptance)')
}
const watchdog=setTimeout(()=>{console.error('Browser smoke watchdog hit');stop();process.exit(1)},180000)
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{clearTimeout(watchdog);stop()})
