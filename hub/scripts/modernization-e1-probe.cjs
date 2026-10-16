// E1 exploration ONLY. No edits to Hub lockfile or production configuration.
'use strict'
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process')
const out=path.resolve(__dirname,'../dist/e1-probe')
fs.mkdirSync(out,{recursive:true})
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vtally-e1-'))
const report={platform:process.platform,node:process.version,at:new Date().toISOString(),checks:[]}
const npm=process.platform==='win32'?'npm.cmd':'npm'
// Node 24 on Windows does not reliably spawn .cmd files directly (EINVAL).
// Invoke the Windows command interpreter explicitly, as in the Hub's CI packaging scripts.
function run(bin,args,cwd=tmp,timeout=600000){
 const shellArgs=(process.platform==='win32' && bin===npm) ? ['/d','/c','npm',...args] : args
 const executable=(process.platform==='win32' && bin===npm) ? (process.env.ComSpec||'cmd.exe') : bin
 const r=cp.spawnSync(executable,shellArgs,{cwd,encoding:'utf8',timeout,maxBuffer:1024*1024*4,windowsHide:true})
 return {command:[bin,...args].join(' '),code:r.status,error:r.error&&String(r.error),stdout:(r.stdout||'').slice(-9000),stderr:(r.stderr||'').slice(-9000)}
}
function add(name,r){report.checks.push({name,...r});console.log(name+': '+(r.code===0?'OK':'BLOCKED'))}
function install(dir,packages){
 fs.mkdirSync(dir,{recursive:true})
 fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'vtally-e1',version:'0.0.0',private:true}))
 return run(npm,['install','--save-exact','--no-audit','--no-fund',...packages],dir)
}
try{
 for(const p of ['typescript','typescript-eslint','eslint','@yao-pkg/pkg','serialport','midi','react-full-screen','jest','vite','express','socket.io','obs-websocket-js']){
  add('npm metadata '+p,run(npm,['view',p+'@latest','version','engines','peerDependencies','--json']))
 }
 add('TS7 peer experiment',install(path.join(tmp,'ts7'),['typescript@latest','eslint@latest','typescript-eslint@latest','@eslint/js@latest']))
 const ts=path.join(tmp,'ts6')
 const ti=install(ts,['typescript@6','eslint@latest','typescript-eslint@latest','@eslint/js@latest','jest@latest','babel-jest@latest','@babel/core@latest','@babel/preset-env@latest','@babel/preset-typescript@latest','react@latest','@types/react@latest'])
 add('TS6 lint Jest Babel install',ti)
 if(ti.code===0){
  fs.writeFileSync(path.join(ts,'probe.tsx'),"import * as React from 'react'; type Item={n:number};const item:Item={n:1};export const v=<span>{item.n}</span>;\n")
  fs.writeFileSync(path.join(ts,'eslint.config.cjs'),"module.exports=require('typescript-eslint').configs.recommended;\n")
  fs.writeFileSync(path.join(ts,'test.test.ts'),'test("TS",()=>{const n:number=3;expect(n).toBe(3)})\n')
  fs.writeFileSync(path.join(ts,'jest.config.cjs'),"module.exports={testEnvironment:'node',testMatch:['<rootDir>/test.test.ts'],transform:{'^.+\\\\.tsx?$':['babel-jest',{presets:['@babel/preset-env','@babel/preset-typescript']}]}};\n")
  add('TS6 TSX compile',run(process.execPath,[path.join(ts,'node_modules/typescript/bin/tsc'),'--noEmit','--jsx','react-jsx','--moduleResolution','nodenext','--module','nodenext','--target','ES2022','--skipLibCheck','probe.tsx'],ts))
  add('ESLint flat TypeScript',run(process.execPath,[path.join(ts,'node_modules/eslint/bin/eslint.js'),'probe.tsx'],ts))
  add('Jest Babel TS',run(process.execPath,[path.join(ts,'node_modules/jest/bin/jest.js'),'--config','jest.config.cjs','--runInBand'],ts))
 }
 const nat=path.join(tmp,'native')
 const ni=install(nat,['serialport@latest','midi@latest','escape-string-regexp@latest','@yao-pkg/pkg@latest','esbuild@latest'])
 add('native ESM packer install',ni)
 if(ni.code===0){
  fs.writeFileSync(path.join(nat,'probe.cjs'),[
  "'use strict';",
  "(async()=>{",
  "const e=(await import('escape-string-regexp')).default;",
  "const s=require('serialport'),m=require('midi');",
  "const ports=await s.SerialPort.list();",
  "const input=new m.Input(),count=input.getPortCount();",
  "if(input.closePort)input.closePort();",
  "console.log('E1_RESULT='+JSON.stringify({runtime:process.version,esm:e('a+b'),ports:ports.map(p=>p.path),midi:count,packaged:!!process.pkg}))",
  "})().catch(e=>{console.error(e.stack||e);process.exitCode=1})"
  ].join('\n'))
  add('Node24 ESM+native enumeration',run(process.execPath,['probe.cjs'],nat))
  // Distinguish ESM-in-snapshot failure from native addon failure: package
  // independent native-only and prebundled ESM+native candidates.
  if(process.platform==='win32'){
   const pkgCli=path.join(nat,'node_modules/@yao-pkg/pkg/lib-es5/bin.js')
   const isolated=path.join(tmp,'native-only-isolated')
   fs.mkdirSync(isolated)
   fs.writeFileSync(path.join(nat,'native-only.cjs'), [
    "'use strict';",
    "(async()=>{",
    "const serial=require('serialport'),midi=require('midi');",
    "const ports=await serial.SerialPort.list();",
    "const input=new midi.Input(),count=input.getPortCount();",
    "if(input.closePort)input.closePort();",
    "console.log('E1_NATIVE='+JSON.stringify({runtime:process.version,ports:ports.map(x=>x.path),midi:count,packaged:!!process.pkg}))",
    "})().catch(e=>{console.error(e.stack||e);process.exitCode=1})"
   ].join('\n'))
   const nativeExe=path.join(nat,'native-only.exe')
   const nativeBuild=run(process.execPath,[pkgCli,'native-only.cjs','--targets','node24-win-x64','--output',nativeExe],nat)
   add('pkg native-only build',nativeBuild)
   if(nativeBuild.code===0){
    fs.copyFileSync(nativeExe,path.join(isolated,'native-only.exe'))
    add('isolated EXE native-only enumerations',run(path.join(isolated,'native-only.exe'),[],isolated,90000))
   }
   const bundled=path.join(nat,'bundled.cjs')
   const bundle=run(process.execPath,[
     path.join(nat,'node_modules/esbuild/bin/esbuild'),'probe.cjs',
     '--bundle','--platform=node','--format=cjs','--target=node24',
     '--external:serialport','--external:midi','--outfile=bundled.cjs'
   ],nat)
   add('bundle ESM-only dependency into CommonJS backend',bundle)
   if(bundle.code===0){
    const bundExe=path.join(nat,'bundled.exe')
    const pack=run(process.execPath,[pkgCli,'bundled.cjs','--targets','node24-win-x64','--output',bundExe],nat)
    add('pkg prebundled ESM+native build',pack)
    if(pack.code===0){
     const iso=path.join(tmp,'bundled-isolated')
     fs.mkdirSync(iso)
     fs.copyFileSync(bundExe,path.join(iso,'bundled.exe'))
     add('isolated EXE prebundled ESM+native',run(path.join(iso,'bundled.exe'),[],iso,90000))
    }
   }
  }
  if(process.platform==='win32'){
   const exe=path.join(nat,'probe.exe')
   const pk=run(process.execPath,[path.join(nat,'node_modules/@yao-pkg/pkg/lib-es5/bin.js'),'probe.cjs','--targets','node24-win-x64','--output',exe],nat)
   add('Node24 EXE build',pk)
   if(pk.code===0){
    const iso=path.join(tmp,'isolated')
    fs.mkdirSync(iso)
    fs.copyFileSync(exe,path.join(iso,'probe.exe'))
    add('Isolated EXE ESM native enumeration',run(path.join(iso,'probe.exe'),[],iso,90000))
   }
  }
 }
}catch(e){add('unhandled probe error',{code:1,error:String(e.stack||e)})}
finally{
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2))
 const md=['# E1 exploratory result','Diagnostic only; not release acceptance.','| Probe | Result |','|---|---|']
 for(const c of report.checks)md.push('| '+c.name+' | '+(c.code===0?'PASS (probe)':'BLOCKED / inspect JSON')+' |')
 fs.writeFileSync(path.join(out,'summary.md'),md.join('\n'))
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md.join('\n')+'\n')
 fs.rmSync(tmp,{force:true,recursive:true})
}
