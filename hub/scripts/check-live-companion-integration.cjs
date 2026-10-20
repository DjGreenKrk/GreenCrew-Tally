// E0/E4 process-level contract check. Uses real Hub, HTTP, Socket.IO and UDP.
// Only the mixer source is emulated by the HTTP Companion protocol (no physical gear).
'use strict'
const assert=require('node:assert/strict')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const net=require('node:net')
const dgram=require('node:dgram')
const {spawn}=require('node:child_process')
const io=require('socket.io-client')
const { hasFrameSince }=require('./udp-phase-assertions.cjs')
const root=path.resolve(__dirname,'..')
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vtally-e2e-'))
const configFile=path.join(tmp,'config.json')
fs.writeFileSync(configFile,JSON.stringify({mixer:'companion'}))
const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms))
const deadline=(promise,ms,name)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(name+' timed out')),ms))])
const waitFor=async(fn,ms,name)=>{
 const end=Date.now()+ms
 while(Date.now()<end){const value=fn();if(value)return value;await delay(70)}
 throw Error('Timed out waiting for '+name)
}
let child,client,udp
let output=''
async function getFreePort(){
 const server=net.createServer()
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve))
 const port=server.address().port
 await new Promise(resolve=>server.close(resolve))
 return port
}
async function run(){
 const port=await getFreePort(), base='http://127.0.0.1:'+port
 const prod=path.join(root,'dist/server.js')
 assert.ok(fs.existsSync(prod),'Run npm run build:backend first')
 child=spawn(process.execPath,[prod,'--env=production'],{
  cwd:root,env:{...process.env,CONFIG_FILE:configFile,PORT:String(port),NODE_ENV:'production'},stdio:['ignore','pipe','pipe']
 })
 child.stdout.on('data',data=>{output+=data.toString()})
 child.stderr.on('data',data=>{output+=data.toString()})
 await waitFor(()=>output.includes('Web Server available')&&!output.includes('Using mixer configuration "undefined"'),8000,'Hub startup: '+output)
 const state=async()=>{const r=await fetch(base+'/api/companion/tally');assert.equal(r.status,200);return r.json()}
 assert.equal((await state()).active,true)
 assert.equal((await state()).receiving,false)
 const seen={program:[],mixer:[],web:[],tallies:[],udp:[]}
 client=io(base,{transports:['websocket'],reconnection:false,timeout:6000})
 client.on('program.state',m=>seen.program.push(m))
 client.on('mixer.state',m=>seen.mixer.push(m))
 client.on('webTally.state',m=>seen.web.push(m))
 client.on('tally.state',m=>seen.tallies.push(m))
 await deadline(new Promise((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject)}),7000,'socket')
 client.emit('events.program.subscribe')
 client.emit('events.mixer.subscribe')
 client.emit('events.tally.subscribe')
 await waitFor(()=>seen.program.some(x=>x.programs===null&&x.previews===null),3500,'initial UNKNOWN state')
 client.emit('tally.create','BrowserCam',['1'])
 await waitFor(()=>seen.tallies.some(x=>x.tallies.some(t=>t.name==='BrowserCam'&&t.type==='web')),3500,'web tally create')
 client.emit('events.webTally.subscribe','BrowserCam')
 await waitFor(()=>seen.web.some(x=>x.command==='unknown'),3500,'initial WebTally unknown')
 udp=dgram.createSocket('udp4')
 udp.on('message',packet=>seen.udp.push(packet.toString()))
 await new Promise(resolve=>udp.bind(0,'127.0.0.1',resolve))
 await new Promise((resolve,reject)=>udp.send('tally-ho "UdpCam"',7411,'127.0.0.1',err=>err?reject(err):resolve()))
 await waitFor(()=>seen.tallies.some(x=>x.tallies.some(t=>t.name==='UdpCam'&&t.type==='udp')),4000,'UDP tally discovery')
 client.emit('tally.patch','UdpCam','udp',['1'])
 await waitFor(()=>hasFrameSince(seen.udp,0,'O000/000/255 S000/000/000 0x80 250'),2500,'initial UDP UNKNOWN after patch')
 const snapshot=async(data)=>{
  const r=await fetch(base+'/api/companion/tally',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
  assert.equal(r.status,200,'Companion POST: '+(await r.text()))
 }
 const programOffset=seen.program.length, webProgramOffset=seen.web.length, udpProgramOffset=seen.udp.length
 await snapshot({programs:['1'],previews:['2']})
 await waitFor(()=>seen.program.slice(programOffset).some(s=>s.programs?.length===1&&s.programs[0]==='1'&&s.previews?.length===1&&s.previews[0]==='2'),2500,'program socket broadcast')
 await waitFor(()=>seen.web.slice(webProgramOffset).some(s=>s.command==='on-air'),2500,'WebTally on-air')
 await waitFor(()=>hasFrameSince(seen.udp,udpProgramOffset,'O255/000/000 S255/000/000'),2500,'UDP PROGRAM red frame')
 assert.equal((await state()).receiving,true)
 const first=seen.program.length, firstWeb=seen.web.length
 await delay(1200)
 await snapshot({programs:['1'],previews:['2']})
 assert.equal(seen.program.length,first,'heartbeat must not broadcast duplicate state')
 assert.equal(seen.web.length,firstWeb,'heartbeat must not broadcast duplicate WebTally state')
 await delay(2000)
 assert.equal((await state()).receiving,true,'heartbeat must extend timeout')
 const timeoutProgramOffset=seen.program.length, timeoutWebOffset=seen.web.length, timeoutUdpOffset=seen.udp.length
 await waitFor(()=>seen.program.slice(timeoutProgramOffset).some(s=>s.programs===null&&s.previews===null),6500,'timeout UNKNOWN')
 await waitFor(()=>seen.web.slice(timeoutWebOffset).some(s=>s.command==='unknown'),2500,'WebTally unknown after timeout')
 assert.equal((await state()).receiving,false)
 await waitFor(()=>hasFrameSince(seen.udp,timeoutUdpOffset,'O000/000/255 S000/000/000 0x80 250'),2500,'new UDP UNKNOWN after timeout')
 const recoverProgramOffset=seen.program.length, recoverWebOffset=seen.web.length, recoverUdpOffset=seen.udp.length
 await snapshot({programs:['2'],previews:['1']})
 await waitFor(()=>seen.program.slice(recoverProgramOffset).some(s=>s.programs?.length===1&&s.programs[0]==='2'&&s.previews?.length===1&&s.previews[0]==='1'),2500,'recovery socket broadcast')
 await waitFor(()=>seen.web.slice(recoverWebOffset).some(s=>s.command==='preview'),2500,'WebTally recovery to preview')
 await waitFor(()=>hasFrameSince(seen.udp,recoverUdpOffset,'O000/255/000 S000/255/000'),2500,'UDP PREVIEW green recovery frame')
 assert.equal((await state()).receiving,true)
 assert.ok(seen.udp.length>2,'UDP updates must continue')
 const auxProgramOffset=seen.program.length, auxWebOffset=seen.web.length, auxUdpOffset=seen.udp.length
 await snapshot({programs:['2'],previews:['1'],auxes:['1']})
 await waitFor(()=>seen.program.slice(auxProgramOffset).some(s=>s.auxes?.length===1&&s.auxes[0]==='1'),2500,'AUX socket broadcast')
 await waitFor(()=>seen.web.slice(auxWebOffset).some(s=>s.command==='aux'),2500,'WebTally AUX beats preview')
 await waitFor(()=>hasFrameSince(seen.udp,auxUdpOffset,'O255/080/000 S000/000/000'),2500,'UDP AUX orange frame')
 assert.deepEqual((await state()).auxes,['1'])
 console.log('PASS real Hub HTTP Companion heartbeat/timeout/UNKNOWN/recovery/AUX → Socket.IO, Web Tally and UDP')
 console.log('Socket events: '+seen.program.length+' program, '+seen.web.length+' WebTally; UDP frames: '+seen.udp.length)
}
async function cleanup(){
 if(client)client.close()
 if(udp)await new Promise(resolve=>udp.close(resolve))
 if(child&&!child.killed){child.kill('SIGKILL')}
 fs.rmSync(tmp,{recursive:true,force:true})
}
run().catch(e=>{console.error(e);console.error('Hub logs: '+output.slice(-9000));process.exitCode=1}).finally(cleanup)
