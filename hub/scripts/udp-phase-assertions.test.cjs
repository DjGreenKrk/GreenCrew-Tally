'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const {hasFrameSince}=require('./udp-phase-assertions.cjs')
const UNKNOWN='O000/000/255 S000/000/000 0x80 250'
const PROGRAM='O255/000/000 S255/000/000'
const PREVIEW='O000/255/000 S000/255/000'
test('constant UNKNOWN cannot satisfy PROGRAM or PREVIEW',()=>{
 const frames=[UNKNOWN,UNKNOWN,UNKNOWN]
 assert.equal(hasFrameSince(frames,0,PROGRAM),false)
 assert.equal(hasFrameSince(frames,0,PREVIEW),false)
})
test('earlier UNKNOWN cannot satisfy later timeout',()=>{
 const frames=[UNKNOWN,PROGRAM]
 const checkpoint=frames.length
 assert.equal(hasFrameSince(frames,checkpoint,UNKNOWN),false)
 frames.push(UNKNOWN)
 assert.equal(hasFrameSince(frames,checkpoint,UNKNOWN),true)
})
test('incorrect and malformed payloads cannot pass exact frame check',()=>{
 const frames=['O255/000/000 S000/000/000','O255/000/000 S255/000/000 garbage','0x80 250','O000/000/255 S000/000/000 0x80 250 garbage']
 assert.equal(hasFrameSince(frames,0,PROGRAM),false)
 assert.equal(hasFrameSince(frames,0,UNKNOWN),false)
 assert.equal(hasFrameSince([PROGRAM,PREVIEW],1,PROGRAM),false)
 assert.equal(hasFrameSince([PROGRAM,PREVIEW],1,PREVIEW),true)
})
test('invalid checkpoints are rejected',()=>{
 assert.throws(()=>hasFrameSince([],1,UNKNOWN),RangeError)
 assert.throws(()=>hasFrameSince([PROGRAM],-1,PROGRAM),RangeError)
})
