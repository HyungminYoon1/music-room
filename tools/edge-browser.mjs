import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {createRequire} from "node:module";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const config={"key":"score-lab-project-v1","open":"#open","state":"#save-state","status":"#status","limit":2000000,"seed":"const m=await import('./src/model.js');const p=m.exerciseProject();p.title='EDGE fixture';return JSON.stringify(p);","edit":"#title","new":"#new"};
const app="score-lab";
// Each context is disposable. Storage/File shims are explicitly synthetic fixtures.
export async function runEdges(browser,baseURL,tag="final"){
  const out=resolve(root,"output/playwright/edge-20261013");await mkdir(out,{recursive:true});
  const results=[];
  let raw;
  const bootstrap=await browser.newContext();const seedPage=await bootstrap.newPage();
  await seedPage.goto(baseURL);await seedPage.locator("#title").waitFor();
  raw=await seedPage.evaluate(async()=>{const m=await import('./src/model.js');const p=m.exerciseProject();p.title='EDGE fixture';return JSON.stringify(p);});
  await bootstrap.close();
  const renamed=(name)=>{const p=JSON.parse(raw);p.title=name;if(p.objects)p.objects[0].title=name;return JSON.stringify(p);};
  async function fresh(mode="normal"){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    await ctx.addInitScript(({key,raw,mode})=>{
      const originalGet=Storage.prototype.getItem,originalSet=Storage.prototype.setItem;
      originalSet.call(localStorage,key,mode==="corrupt"?"{EDGE corrupt fixture":raw);
      for(const sibling of ["draw-desk-project-v1","score-lab-project-v1","clay-room-project-v1","web-lab-progress-v1"])
        if(sibling!==key)originalSet.call(localStorage,sibling,"EDGE sibling sentinel");
      window.__edgeRead=()=>originalGet.call(localStorage,key);
      window.__edgeSiblings=()=>["draw-desk-project-v1","score-lab-project-v1","clay-room-project-v1","web-lab-progress-v1"].filter(k=>k!==key).map(k=>originalGet.call(localStorage,k));
      if(mode==="denied")Storage.prototype.getItem=function(k){if(k===key)throw new DOMException("EDGE denied fixture","SecurityError");return originalGet.call(this,k);};
      if(mode==="quota")Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException("EDGE quota fixture","QuotaExceededError");return originalSet.call(this,k,v);};
      if(mode==="readback"){let written=false;Storage.prototype.setItem=function(k,v){if(k===key){written=true;return;}return originalSet.call(this,k,v);};Storage.prototype.getItem=function(k){if(k===key&&written)return "EDGE mismatch";return originalGet.call(this,k);};}
      const text=File.prototype.text;window.__edgeReads={};
      File.prototype.text=function(){if(this.name.startsWith("delayed-"))return new Promise(resolve=>{window.__edgeReads[this.name]=resolve;});return text.call(this);};
    },{key:config.key,raw,mode});
    const page=await ctx.newPage();page.setDefaultTimeout(8000);const errors=[];page.on("pageerror",e=>errors.push(e.message));
    page.on("dialog",d=>page.__dismiss?d.dismiss():d.accept());
    await page.goto(baseURL);await page.locator("#title").waitFor();await page.waitForFunction(()=>document.querySelector("#title").value.length>0);
    return {ctx,page,errors};
  }
  const upload=(page,name,contents)=>page.locator(config.open).setInputFiles({name,mimeType:"application/json",buffer:Buffer.from(contents)});
  const field=async(page,id,value)=>{await page.locator(id).fill(value);await page.locator(id).press("Tab");};
  async function check(name,fn,mode="normal"){
    const {ctx,page,errors}=await fresh(mode);
    try{await fn(page);assert.equal(JSON.stringify(await page.evaluate(()=>window.__edgeSiblings())),JSON.stringify(Array(3).fill("EDGE sibling sentinel")));assert.equal(errors.length,0,errors.join("; "));results.push({name,status:"PASS",fixture:mode});}
    catch(e){results.push({name,status:"FAIL",error:e.message,fixture:mode});}
    finally{await ctx.close();}
  }
  await check("corrupt and oversize imports are atomic",async page=>{
    const before=await page.evaluate(()=>window.__edgeRead());
    await upload(page,"bad.json","{");await page.waitForFunction(sel=>document.querySelector(sel).textContent.length>0,config.status);
    assert.equal(await page.evaluate(()=>window.__edgeRead()),before);
    const oversize=resolve(out,"oversize-fixture.json");await writeFile(oversize," ".repeat(config.limit+1));
    await page.locator(config.open).setInputFiles(oversize,{timeout:30000});
    await page.waitForFunction(sel=>document.querySelector(sel).textContent.includes("MB"),config.status);
    assert.equal(await page.evaluate(()=>window.__edgeRead()),before);
    assert.equal(await page.locator("#title").inputValue(),"EDGE fixture");
  });
  await check("cancel import and new leaves project and history intact",async page=>{
    await field(page,"#title","EDGE edited");const before=await page.evaluate(()=>window.__edgeRead());
    page.__dismiss=true;await upload(page,"valid.json",renamed("not accepted"));await page.waitForTimeout(100);
    assert.equal(await page.locator("#title").inputValue(),"EDGE edited");
    await page.locator(config.new).click();
    if(app==="draw-desk")await page.locator("#canvas-dialog").press("Escape");
    if(app==="clay-room")await page.locator("#new-dialog").press("Escape");
    assert.equal(await page.evaluate(()=>window.__edgeRead()),before);
    await page.locator("#undo").click();assert.equal(await page.locator("#title").inputValue(),"EDGE fixture");
    await page.locator("#redo").click();assert.equal(await page.locator("#title").inputValue(),"EDGE edited");
  });
  for(const mode of ["denied","quota","readback","corrupt"])await check("storage "+mode+" reports failure and retains old bytes",async page=>{
    const before=await page.evaluate(()=>window.__edgeRead());await field(page,"#title","EDGE unsaved");
    assert.equal(await page.locator("#title").inputValue(),"EDGE unsaved");assert.equal(await page.evaluate(()=>window.__edgeRead()),before);
    assert.match(await page.locator(config.state).textContent(),/불가|보존|필요/);
    const promise=page.waitForEvent("download");await page.locator(app==="draw-desk"?"#save-file":"#save").click();
    const d=await promise,path=resolve(out,tag+"-"+mode+".json");await d.saveAs(path);
    const data=JSON.parse(await readFile(path,"utf8"));assert.equal(data.objects?data.objects.find(o=>o.id===data.activeId).title:data.title,"EDGE unsaved");
  },mode);
  await check("later file wins when reads complete out of order",async page=>{
    await upload(page,"delayed-A.json","{}");await upload(page,"delayed-B.json","{}");
    await page.evaluate(raw=>window.__edgeReads["delayed-B.json"](raw),renamed("EDGE B"));await page.waitForFunction(()=>document.querySelector("#title").value==="EDGE B");
    await page.evaluate(raw=>window.__edgeReads["delayed-A.json"](raw),renamed("EDGE A"));await page.waitForTimeout(150);
    assert.equal(await page.locator("#title").inputValue(),"EDGE B","late A must not replace accepted B");
  });
  await check("edit invalidates pending import",async page=>{
    await upload(page,"delayed-edit.json","{}");await field(page,"#title","EDGE newer edit");
    await page.evaluate(raw=>window.__edgeReads["delayed-edit.json"](raw),renamed("EDGE stale"));await page.waitForTimeout(150);
    assert.equal(await page.locator("#title").inputValue(),"EDGE newer edit","late file must not replace newer edit");
  });
  await check("new document invalidates pending import",async page=>{
    await upload(page,"delayed-new.json","{}");await page.locator(config.new).click();
    if(app==="draw-desk")await page.locator("#apply-canvas").click();
    if(app==="clay-room"){await page.locator("#quality").selectOption("low");await page.locator("#create").click();}
    await page.waitForFunction(()=>document.querySelector("#title").value!=="EDGE fixture");
    const title=await page.locator("#title").inputValue();
    await page.evaluate(raw=>window.__edgeReads["delayed-new.json"](raw),renamed("EDGE stale"));await page.waitForTimeout(150);
    assert.equal(await page.locator("#title").inputValue(),title,"late file must not replace new document");
  });
  await check("typing before blur invalidates pending import",async page=>{
    await upload(page,"delayed-typing.json","{}");await page.locator("#title").fill("EDGE uncommitted typing");
    await page.evaluate(raw=>window.__edgeReads["delayed-typing.json"](raw),renamed("EDGE stale"));await page.waitForTimeout(150);
    assert.equal(await page.locator("#title").inputValue(),"EDGE uncommitted typing","late file must not discard text before blur");
    await page.locator("#title").press("Tab");
  });
  await check("text focus preserves shortcuts; real narrow edits and screenshot fit",async page=>{
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:resolve(out,tag+"-initial-"+width+".png")});
      await field(page,"#title","EDGE "+width);await page.locator("#title").focus();await page.keyboard.press("Home");await page.keyboard.press("Delete");
      assert.equal(await page.locator("#title").inputValue(),"DGE "+width);await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.locator("#undo").click();assert.equal(await page.locator("#title").inputValue(),"EDGE "+width);
      await page.locator("#redo").click();assert.equal(await page.locator("#title").inputValue(),"DGE "+width);
      const surface=page.locator(app==="draw-desk"?"#canvas":app==="score-lab"?"#roll-scroll":"#viewport canvas");
      await surface.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,tag+"-edited-"+width+".png")});
    }
  });
  await check("autosave 1.9MB cap uses UTF-8 bytes without dropping editable project",async page=>{
    const p=JSON.parse(renamed("EDGE large UTF-8"));p.fixturePadding="가".repeat(640000);
    const before=await page.evaluate(()=>window.__edgeRead());
    await upload(page,"large-utf8-fixture.json",JSON.stringify(p));
    await page.waitForFunction(()=>document.querySelector("#title").value==="EDGE large UTF-8");
    assert.equal(await page.locator("#save-state").textContent(),"파일 저장 필요");
    assert.equal(await page.evaluate(()=>window.__edgeRead()),before);
  });
  await writeFile(resolve(out,tag+"-browser.json"),JSON.stringify({app,baseURL,results},null,2));
  return results;
}
// Reuse every pre-existing UI/export assertion with this session's browser/port/output.
export async function runExisting(browser,baseURL){
  const vm=await import("node:vm");
  const model=app==="clay-room"?await import("../dist/src/scene-model.js"):{};
  const outputDir=resolve(root,"output/playwright/edge-20261013/existing");
  let source=await readFile(resolve(root,"tools/verify-browser.mjs"),"utf8");
  source=source.replace(/^import .*;\r?\n/gm,"")
    .replace(/const \{ chromium \}=createRequire[^;]+;/,"")
    .replace("root=resolve(import.meta.dirname,'..'),out=resolve(root,'output/playwright/qa-20261013')","root=appRoot,out=outputDir")
    .replace(/const browser=await chromium.launch\([^\n]+\);/,"")
    .replaceAll("http://127.0.0.1:4292/",baseURL)
    .replace("await browser.close()","await context.close()");
  const read=async(file,...args)=>{
    const content=await readFile(file,...args);
    return String(file).endsWith("browser-regression.js")?content.replaceAll("http://127.0.0.1:4292/",baseURL):content;
  };
  // Node REPL and browser objects have distinct prototypes; compare serialized values.
  const checks=Object.assign((...args)=>assert(...args),assert,{deepEqual:(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b))});
  const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
  await new AsyncFunction("browser","appRoot","outputDir","readFile","mkdir","writeFile","resolve","vm","assert","parse","encode","active","transformPoint",source)(
    browser,root,outputDir,read,mkdir,writeFile,resolve,vm,checks,model.parse,model.encode,model.active,model.transformPoint);
  return JSON.parse(await readFile(resolve(outputDir,"report.json"),"utf8"));
}
if(typeof process!=="undefined"&&process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const {chromium}=createRequire(resolve(process.argv[2]))("playwright");
  const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--mute-audio"]});
  try{if(process.argv[4]==="existing")console.log(await runExisting(browser,process.argv[3]));else{const results=await runEdges(browser,process.argv[3],process.argv[4]||"final");console.log(JSON.stringify(results));if(results.some(r=>r.status==="FAIL"))process.exitCode=1;}}finally{await browser.close();}
}

