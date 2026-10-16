// One bounded E1 test based on pkg's documented native-asset inclusion.
// No mocks: the compiled EXE must enumerate serial and MIDI from an isolated folder.
'use strict'
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process')
const output=path.resolve(__dirname,'../dist/e1-pkg-assets')
fs.mkdirSync(output,{recursive:true})
const work=fs.mkdtempSync(path.join(os.tmpdir(),'vtally-pkg-assets-'))
const res={at:new Date().toISOString(),node:process.version,platform:process.platform,results:[],nativeFiles:[]}
function execute(name,exe,args,cwd=work,timeout=600000){
 const command=process.platform==='win32'&&exe==='npm'?process.env.ComSpec||'cmd.exe':exe
 const commandArgs=process.platform==='win32'&&exe==='npm'?['/d','/c','npm',...args]:args
 const r=cp.spawnSync(command,commandArgs,{cwd,timeout,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024})
 const step={name,code:r.status,error:r.error&&String(r.error),stdout:(r.stdout||'').slice(-12000),stderr:(r.stderr||'').slice(-12000)}
 res.results.push(step)
 console.log(name+': '+(r.status===0?'PASS':'FAIL'))
 if(r.status!==0)console.error((step.error||'')+' '+step.stderr.slice(-1000))
 return r.status===0
}
function walk(p){
 for(const item of fs.readdirSync(p,{withFileTypes:true})){
  const abs=path.join(p,item.name)
  if(item.isDirectory())walk(abs)
  else if(item.name.endsWith('.node'))res.nativeFiles.push(path.relative(work,abs).replaceAll('\\','/'))
 }
}
try{
 const manifest={
  name:'vtally-e1-native-assets',version:'0.0.0',private:true,
  pkg:{assets:[
    'node_modules/@serialport/bindings-cpp/prebuilds/**/*.node',
    'node_modules/@serialport/bindings-cpp/build/Release/*.node',
    'node_modules/midi/build/Release/*.node'
  ]}
 }
 fs.writeFileSync(path.join(work,'package.json'),JSON.stringify(manifest,null,2))
 if(!execute('npm install native packages without overrides','npm',['install','--no-audit','--no-fund','--save-exact','serialport@13.0.0','midi@2.0.0','@yao-pkg/pkg@6.23.0']))throw Error('Install failed')
 walk(path.join(work,'node_modules','@serialport','bindings-cpp'))
 walk(path.join(work,'node_modules','midi'))
 fs.writeFileSync(path.join(work,'app.cjs'),[
  "'use strict';",
  "(async()=>{",
  "const serial=require('serialport');",
  "const midi=require('midi');",
  "const ports=await serial.SerialPort.list();",
  "const input=new midi.Input();const count=input.getPortCount();",
  "if(input.closePort)input.closePort();",
  "console.log('E1_NATIVE_OK='+JSON.stringify({runtime:process.version,serial:ports.map(p=>p.path),midi:count,insideExe:!!process.pkg}));",
  "})().catch(e=>{console.error(e.stack||e);process.exitCode=1})"
 ].join('\n'))
 const pkgBin=path.join(work,'node_modules/@yao-pkg/pkg/lib-es5/bin.js')
 if(!execute('build pkg with declared native assets',process.execPath,[pkgBin,'app.cjs','--targets','node24-win-x64','--output',path.join(work,'native-assets.exe')]))throw Error('pkg compilation failed')
 const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'vtally-no-repo-'))
 try{
  fs.copyFileSync(path.join(work,'native-assets.exe'),path.join(isolated,'native-assets.exe'))
  if(!execute('isolated native enumeration INSIDE published EXE',path.join(isolated,'native-assets.exe'),[],isolated,90000))throw Error('Native addon missing inside EXE')
 }finally{fs.rmSync(isolated,{recursive:true,force:true})}
}catch(e){
 res.error=String(e.stack||e)
 process.exitCode=1
}finally{
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(res,null,2))
 console.log('Native binaries collected: '+JSON.stringify(res.nativeFiles))
 fs.rmSync(work,{recursive:true,force:true})
}
