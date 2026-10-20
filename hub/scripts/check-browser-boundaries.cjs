// Prevent browser runtime from importing Node, hardware or backend dependencies.
// Parse emitted JS from every reachable TS/TSX file, so type-only imports do not
// falsely trigger and the check survives TS module syntax refactoring.
'use strict'
const fs=require('node:fs')
const path=require('node:path')
const ts=require('typescript')
const {builtinModules}=require('node:module')
const root=path.resolve(__dirname,'../src')
const entry=path.join(root,'index.tsx')
const checked=new Set()
const forbidden=new Set([...builtinModules.map(x=>x.replace(/^node:/,'')),'obs-websocket-js','nodemcu-tool','midi','socket.io','forever-monitor'])
const issues=[]
const resolve=(p,from)=>{
 const rootPath=path.resolve(path.dirname(from),p)
 for(const candidate of [rootPath+'.ts',rootPath+'.tsx',rootPath+'.js',rootPath+'.jsx',rootPath+'/index.ts',rootPath+'/index.tsx']){
  if(fs.existsSync(candidate))return candidate
 }
 return null
}
function check(file,via=[]){
 if(checked.has(file))return
 checked.add(file)
 const source=fs.readFileSync(file,'utf8')
 const js=ts.transpileModule(source,{fileName:file,compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
 }}).outputText
 const ast=ts.createSourceFile(file+'.js',js,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS)
 const imports=[]
 function visit(node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text)
  if(ts.isCallExpression(node)&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0])){
   if(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))imports.push(node.arguments[0].text)
  }
  ts.forEachChild(node,visit)
 }
 visit(ast)
 for(const name of imports){
  const base=name.replace(/^node:/,'').split('/')[0]
  if(forbidden.has(name.replace(/^node:/,''))||forbidden.has(base)){
   issues.push(file.replace(root,'src')+' imports '+name+' via '+via.concat(file.replace(root,'src')).join(' → '))
  }else if(name.startsWith('.')){
   const resolved=resolve(name,file)
   if(resolved)check(resolved,via.concat(file.replace(root,'src')))
   else issues.push('Cannot resolve browser-side import '+name+' from '+file.replace(root,'src'))
  }
 }
}
check(entry)
if(issues.length){
 console.error('Browser/server dependency boundary violations:\n'+issues.join('\n'))
 process.exitCode=1
}else{
 console.log('PASS: '+checked.size+' browser-reachable project modules are free of runtime Node/hardware imports')
}
