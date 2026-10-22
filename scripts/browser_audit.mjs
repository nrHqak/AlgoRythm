/** Optional real-browser audit. See docs/verification/production-readiness-audit.md. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dev = process.env.AUDIT_DEV_URL || 'http://127.0.0.1:5173';
const production = process.env.AUDIT_PREVIEW_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, channel: process.env.AUDIT_BROWSER_CHANNEL || 'chrome' });
const results = { environment: { browser: browser.version(), platform: process.platform, node: process.version, cloud: 'synthetic, no live credentials' }, checks: [], performance: {} };
const check = (name, condition) => { assert.ok(condition, name); results.checks.push(name); console.log('PASS', name); };
const stats = values => ({ samples: values, n: values.length, mean: values.reduce((a,b)=>a+b,0)/values.length, median: (()=>{const sorted=[...values].sort((a,b)=>a-b);return (sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2;})() });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${dev}/dev/browser-verification.html`);
  results.fixtures = await page.evaluate(() => window.verifyBrowser());
  check('15 real-worker canonical fixtures', results.fixtures.length === 15 && results.fixtures.every(r => r.status === 'PASS'));
  results.runtime = await page.evaluate(async (cases) => {
    const { BrowserEngine } = await import('/src/execution/browserEngine.js');
    const { ComplexityAnalysis } = await import('/src/execution/complexity.js');
    const engine = new BrowserEngine();
    const outcome = { execution: {}, checks: [] };
    const ok = (name, value) => { if (!value) throw Error(name); outcome.checks.push(name); };
    try {
      const start = performance.now(); await engine.initialize(); outcome.initializationMs = performance.now() - start;
      const bubble = cases.find(c => c.name.toLowerCase().includes('bubble'));
      const binary = cases.find(c => c.name.toLowerCase().includes('binary'));
      for (const sample of [bubble, binary]) {
        if(sample===binary) await engine.restart();
        const times = [];
        for (let i=0;i<11;i++) { const start=performance.now(); await engine.execute(sample); times.push(performance.now()-start); }
        outcome.execution[sample.name] = { firstMs: times[0], warmMs: times.slice(1) };
      }
      const original = await engine.execute(bubble); const serialized=JSON.stringify(original);
      await engine.execute({code:'arr = [99]\narr.append(1)'});
      ok('historical snapshots immutable across executions', JSON.stringify(original) === serialized);
      const runtimeError = await engine.execute({code:'arr = [1]\n1 / 0'});
      ok('ZeroDivisionError', runtimeError.error?.type === 'ZeroDivisionError');
      const invalid = await engine.execute({code:'import nonexistent_audit_module'});
      ok('invalid import rejected', !!invalid.error);
      let counts=0; const counter={count: options => { counts++; return engine.count(options); }};
      const analysis=new ComplexityAnalysis(counter); const complexityStart=performance.now();
      const first=await analysis.analyze(bubble.code,'arr'); outcome.complexity={uncachedMs:performance.now()-complexityStart,result:first};
      const cached=[];
      for(let i=0;i<10;i++){const start=performance.now(); const value=await analysis.analyze(bubble.code,'arr');cached.push(performance.now()-start);ok(`cache identity ${i}`,value===first);}
      outcome.complexity.cachedMs=cached; ok('cache has five count dispatches',counts===5);
      await analysis.analyze(bubble.code+'\n# changed','arr'); ok('source cache miss',counts===10);
      try {await analysis.analyze(bubble.code,'other');} catch(e){ok('missing array is insufficient data',e.code==='insufficient');} ok('array variable cache miss',counts===15);
      let ticks=0;const heartbeat=setInterval(()=>ticks++,20);const timeoutStart=performance.now();
      try { await analysis.analyze('while True:\n    pass','arr'); throw Error('missing timeout'); } catch(e){ok('complexity timeout',e.name==='timeout');}
      outcome.timeoutMs=performance.now()-timeoutStart; clearInterval(heartbeat);outcome.heartbeatTicks=ticks;ok('UI event loop responsive during timeout',ticks>20);
      await engine.initialize(); ok('valid trace after timeout recovery',!(await engine.execute(bubble)).error);
      const controller=new AbortController(); const cancellation=analysis.analyze('while True:\n    pass','arr',{signal:controller.signal});
      setTimeout(()=>controller.abort(),40);
      try {await cancellation;throw Error('missing abort');}catch(e){ok('complexity cancellation',e.name==='AbortError');}
      await engine.initialize();ok('valid trace after cancellation recovery',!(await engine.execute(binary)).error);
      ok('secondary failures preserve held trace',JSON.stringify(original)===serialized);
    } finally {engine.terminate();}
    return outcome;
  }, JSON.parse(await readFile(new URL('../tests/fixtures/browser_traces.json', import.meta.url), 'utf8')));
  check('real-worker extended checks', results.runtime.checks.length > 15);
  for (const [name, value] of Object.entries(results.runtime.execution)) results.performance[name] = { firstMs: value.firstMs, warmMs:stats(value.warmMs) };
  results.performance.complexity = { uncachedMs:results.runtime.complexity.uncachedMs, cachedMs:stats(results.runtime.complexity.cachedMs) };
  check('helper has no unhandled errors',errors.length===0);
  results.localBackend = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:8000/');
    return { health:response.status };
  }).catch(error => ({corsRejected:error.message}));
  const apiPage=await browser.newPage();await apiPage.goto(`${dev.replace('127.0.0.1','localhost')}/dev/browser-verification.html`);
  results.localBackend.allowedOrigin=await apiPage.evaluate(async code=>{
    const times=[];let metadata;
    for(let i=0;i<10;i++){const start=performance.now();const response=await fetch('http://127.0.0.1:8000/classify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});if(!response.ok)throw Error(`classify ${response.status}`);metadata=await response.json();times.push(performance.now()-start);}
    const mentor=await fetch('http://127.0.0.1:8000/mentor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,user_question:'Explain this'})});
    return {times,metadata,mentorStatus:mentor.status,mentor:await mentor.json()};
  },JSON.parse(await readFile(new URL('../tests/fixtures/browser_traces.json',import.meta.url),'utf8'))[0].code);
  results.performance.localClassificationMs=stats(results.localBackend.allowedOrigin.times);
  await apiPage.close();await page.close();

  const context = await browser.newContext();
  const user = { id:'00000000-0000-4000-8000-000000000001', email:'audit@example.invalid', user_metadata:{username:'audit'}, aud:'authenticated', role:'authenticated' };
  const session={access_token:'synthetic-audit-token',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
  await context.addInitScript(({session})=>{
    localStorage.setItem('sb-audit-auth-token',JSON.stringify(session));
    const NativeWorker=window.Worker;
    window.audit={ workers:[], dispatches:[], responses:[], fetchTimings:[], terminated:0, audioStarts:0 };
    window.Worker=class extends NativeWorker {
      constructor(...args){super(...args);window.audit.workers.push(String(args[0]));this.addEventListener('message',e=>window.audit.responses.push({time:performance.now(),data:e.data}));}
      postMessage(data,...args){window.audit.dispatches.push({time:performance.now(),data});return super.postMessage(data,...args);}
      terminate(){window.audit.terminated++;return super.terminate();}
    };
    const nativeFetch=window.fetch;
    window.fetch=async (...args)=>{
      const start=performance.now();const response=await nativeFetch(...args);
      const path=new URL(typeof args[0]==='string'?args[0]:args[0].url,location.href).pathname;
      if(['/classify','/session/save'].includes(path))response.clone().arrayBuffer().then(()=>window.audit.fetchTimings.push({path,status:response.status,ms:performance.now()-start})).catch(()=>{});
      return response;
    };
    const nativeStart=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(...args){window.audit.audioStarts++;return nativeStart.apply(this,args);};
  },{session});
  const task={id:'audit-task',title:'Audit starter task',description:'Synthetic task',difficulty:'easy',order_index:1,max_xp:100,starter_code:'arr = [3, 2, 1]\narr.sort()'};
  let classificationDelay=80, saveDelay=120, failClassification=false, failSave=false, failMentor=false, blockCDN=false;
  const assets=[]; context.on('response',response=>{const url=response.url();if(url.includes('cdn.jsdelivr.net') || /\/assets\/.*\.js/.test(url))assets.push({url,status:response.status()});});
  const network=[];const completions={classification:[],persistence:[]};
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(blockCDN && url.hostname==='cdn.jsdelivr.net')return route.abort();
    if(url.hostname==='audit.invalid') {
      if(url.pathname.includes('/auth/'))return route.fulfill({json:user});
      const data=url.pathname.includes('/profiles') ? {id:user.id,username:'audit',xp:30,level:1,streak:0} : url.pathname.includes('/tasks') ? (url.searchParams.get('order_index')==='eq.2'?null:task) : null;
      return route.fulfill({json:data});
    }
    if(url.port==='8000'){
      network.push({path:url.pathname,method:req.method()});const start=Date.now();
      if(url.pathname==='/classify'){
        await new Promise(r=>setTimeout(r,classificationDelay));
        const code=req.postDataJSON().code; const algorithm=code.includes('left =')?'binary_search':'bubble_sort';
        try{await route.fulfill(failClassification?{status:503,json:{}}:{json:{algorithm_type:algorithm,algorithm_confidence:0.99}});}catch{}
        completions.classification.push(Date.now()-start);return;
      }
      if(url.pathname==='/session/save'){
        assert.equal(req.headers().authorization,'Bearer synthetic-audit-token');await new Promise(r=>setTimeout(r,saveDelay));
        try{await route.fulfill(failSave?{status:503,json:{}}:{json:{session_id:'synthetic-session',achievements_earned:[]}});}catch{}
        completions.persistence.push(Date.now()-start);return;
      }
      if(url.pathname==='/curriculum')return route.fulfill({json:{tasks:[]}});
      if(url.pathname==='/mentor')return route.fulfill(failMentor?{status:503,json:{}}:{json:{message:'Synthetic mentor response'}});
      (results.unexpectedApi ||= []).push(url.pathname);return route.abort();
    }
    return route.continue();
  });
  const ui=await context.newPage();const uiErrors=[];const consoleErrors=[];ui.on('pageerror',e=>uiErrors.push(e.message));ui.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await ui.goto(`${production}/playground`);
  await ui.locator('[data-runtime-status="ready"]').waitFor({timeout:65000});
  results.performance.entryToReadyMs=await ui.evaluate(()=>performance.now());
  const run=ui.getByRole('button',{name:'Run',exact:true});
  async function runOnce(){
    const before=await ui.evaluate(()=>window.audit.responses.filter(x=>x.data.type==='result').length);
    await run.click();
    await ui.waitForFunction(n=>window.audit.responses.filter(x=>x.data.type==='result').length>n,before);
    await ui.locator('.chart-svg').waitFor();await ui.locator('[data-runtime-status="ready"]').waitFor();
  }
  await runOnce();
  check('one prewarmed product worker',await ui.evaluate(()=>window.audit.workers.length===1));
  check('one normal trace, no counts',await ui.evaluate(()=>window.audit.dispatches.length===1 && !window.audit.dispatches[0].data.mode));
  await ui.getByText('Bubble Sort detected',{exact:true}).waitFor();
  await ui.getByText('Saving progress…',{exact:true}).waitFor({state:'hidden'});
  await ui.getByRole('button',{name:'Next',exact:true}).click();
  check('Next renders second step',await ui.locator('.chart-svg').getAttribute('aria-label').then(x=>x.includes('step 2 ')));
  await ui.getByRole('button',{name:'Prev',exact:true}).click();
  await ui.getByRole('button',{name:'Play',exact:true}).click();
  await ui.waitForFunction(()=>!document.querySelector('.chart-svg').getAttribute('aria-label').includes('step 1 '));
  await ui.getByRole('button',{name:'Pause',exact:true}).click();
  for(let i=0;i<5 && await ui.evaluate(()=>window.audit.audioStarts===0);i++) await ui.getByRole('button',{name:'Next',exact:true}).click();
  await ui.waitForFunction(()=>window.audit.audioStarts>0,{},{timeout:3000});
  check('audio oscillator scheduled after real Run gesture',await ui.evaluate(()=>window.audit.audioStarts>0));
  await ui.getByRole('button',{name:'Mute Audio',exact:true}).click();
  check('mute interface',await ui.getByRole('button',{name:'Unmute Audio',exact:true}).isVisible());
  results.playback=[];
  const fixtures=JSON.parse(await readFile(new URL('../tests/fixtures/browser_traces.json',import.meta.url),'utf8'));
  for(const [example,name] of [['bubble_sort','Bubble Sort'],['selection_sort','Selection Sort'],['insertion_sort','Insertion Sort'],['binary_search','Binary Search'],['linear_search','Linear Search']]){
    await ui.locator('#example-select').selectOption(example);
    const fixture=fixtures.find(c=>c.name===name); const expected=fixture.expected;
    await ui.locator('.code-textarea').fill(fixture.code);await runOnce();
    const actual=await ui.evaluate(()=>window.audit.responses.filter(x=>x.data.type==='result').at(-1).data.result);
    assert.deepEqual(actual,expected);check(`${name} production v1 trace`,true);
    const highlightIndex=expected.steps.findIndex(step=>step.highlights.length);
    if(highlightIndex>=0){
      for(let i=0;i<highlightIndex;i++)await ui.getByRole('button',{name:'Next',exact:true}).click();
      check(`${name} highlighted bars`,await ui.locator('.chart-bar.is-highlighted').count()===expected.steps[highlightIndex].highlights.length);
    }
    await ui.evaluate(async ()=>{
      const next=()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Next');
      while(!next().disabled){next().click();await new Promise(requestAnimationFrame);}
    });
    const values=await ui.locator('.chart-value').allTextContents();
    check(`${name} player final array`,JSON.stringify(values.map(Number))===JSON.stringify(expected.steps.at(-1).array));
    await runOnce();check(`${name} repeat resets playback`,(await ui.locator('.chart-svg').getAttribute('aria-label')).includes('step 1 '));
    results.playback.push({name,steps:expected.total_steps,finalArray:values.map(Number)});
  }
  // Measure click capture to a uniquely changed first bar in committed DOM, not worker arrival.
  results.performance.clickToDOM={};
  for(const example of ['bubble_sort','binary_search']){
    await ui.locator('#example-select').selectOption(example);
    const code=await ui.locator('.code-textarea').inputValue();const values=[];
    for(let i=0;i<10;i++){
      const first=example==='bubble_sort'?10+i:20+i;
      const source=example==='binary_search' ? code.replace(/arr = \[[^\]]*\]/,`arr = [${Array.from({length:6},(_,j)=>first+2*j).join(', ')}]`).replace('target = 7',`target = ${first+6}`) : code.replace(/arr = \[\d+/,`arr = [${first}`);
      await ui.locator('.code-textarea').fill(source);
      const duration=await ui.evaluate(first=>new Promise((resolve,reject)=>{
        const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Run');
        let start;const timer=setTimeout(()=>{observer.disconnect();reject(Error('DOM commit timeout'));},10000);
        const observer=new MutationObserver(()=>{if(start!==undefined && document.querySelector('.chart-value')?.textContent===String(first) && document.querySelector('[data-runtime-status]')?.dataset.runtimeStatus==='ready'){
          clearTimeout(timer);observer.disconnect();resolve(performance.now()-start);
        }});observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
        button.addEventListener('click',()=>{start=performance.now();},{once:true,capture:true});button.click();
      }),first);values.push(duration);
    }
    results.performance.clickToDOM[example]=stats(values);
  }
  await ui.locator('#example-select').selectOption('bubble_sort');await runOnce();
  const held=await ui.locator('.chart-svg').getAttribute('aria-label');
  await ui.getByRole('button',{name:'Analyze Complexity',exact:true}).click();
  await ui.getByText('O(n²)',{exact:true}).waitFor();
  const dispatchCount=await ui.evaluate(()=>window.audit.dispatches.length);
  await ui.getByRole('button',{name:'Analyze Complexity',exact:true}).click();
  await ui.waitForTimeout(100);
  check('UI complexity cache',await ui.evaluate(n=>window.audit.dispatches.length===n,dispatchCount));
  check('complexity preserves player',await ui.locator('.chart-svg').getAttribute('aria-label')===held);
  // Cancellation and timeout must preserve the visible trace in the actual page.
  await ui.locator('.code-textarea').fill('while True:\n    pass');
  await ui.getByRole('button',{name:'Analyze Complexity',exact:true}).click();
  await ui.locator('[data-runtime-status="running"]').waitFor();
  await ui.locator('.code-textarea').fill('arr = [3, 2, 1]');
  await ui.locator('[data-runtime-status="ready"]').waitFor({timeout:65000});
  check('UI complexity cancellation preserves trace',await ui.locator('.chart-svg').getAttribute('aria-label')===held);
  await ui.locator('.code-textarea').fill('while True:\n    pass');
  await ui.getByRole('button',{name:'Analyze Complexity',exact:true}).click();
  await ui.getByRole('alert').filter({hasText:/exceeded 2 seconds/}).waitFor();
  await ui.locator('[data-runtime-status="ready"]').waitFor({timeout:65000});
  check('UI complexity timeout preserves trace',await ui.locator('.chart-svg').getAttribute('aria-label')===held);
  await ui.locator('#example-select').selectOption('binary_search');await ui.locator('#example-select').selectOption('bubble_sort');
  failClassification=true;failSave=true;
  await runOnce();await ui.getByText('Unknown detected',{exact:true}).waitFor();
  await ui.getByText(/Progress could not be saved/).waitFor();
  check('failed secondary requests preserve visualization',await ui.locator('.chart-svg').isVisible() && await run.isEnabled());
  failClassification=false;failSave=false;
  classificationDelay=300;await runOnce();
  classificationDelay=20;await ui.locator('#example-select').selectOption('binary_search');await runOnce();
  await ui.getByText('Binary Search detected',{exact:true}).waitFor();await ui.waitForTimeout(350);
  check('stale classifier cannot overwrite newer metadata',await ui.getByText('Binary Search detected',{exact:true}).isVisible());
  failMentor=true;
  await ui.locator('#example-select').selectOption('index_error');await runOnce();
  await ui.locator('.editor-line-number.is-error').waitFor();
  await ui.getByRole('alert').filter({hasText:/Mentor request failed/}).waitFor();
  check('Python and Mentor errors isolated',await ui.locator('.chart-svg').isVisible() && await run.isEnabled());
  await ui.locator('#example-select').selectOption('bubble_sort');
  check('example reset clears trace',await ui.locator('.chart-svg').count()===0);
  const retired=await ui.evaluate(()=>window.audit.terminated);
  await ui.getByRole('link',{name:'Learn',exact:true}).click();
  check('navigation terminates worker',await ui.evaluate(n=>window.audit.terminated>n,retired));
  await ui.getByRole('link',{name:'Playground',exact:true}).click();await ui.locator('[data-runtime-status="ready"]').waitFor({timeout:65000});
  await runOnce();check('navigation back executes',await ui.locator('.chart-svg').isVisible());
  await ui.locator('.code-textarea').fill('while True:\n    pass');await run.click();
  await ui.getByText('Execution exceeded 2 seconds.',{exact:true}).waitFor();
  await ui.locator('[data-runtime-status="ready"]').waitFor({timeout:65000});
  await ui.locator('.code-textarea').fill('arr = [3, 2, 1]\narr.sort()');await runOnce();
  check('UI normal Run timeout recovers for next Run',await ui.locator('.chart-svg').isVisible());
  await ui.locator('.code-textarea').fill('for');await run.click();
  await ui.getByText(/SyntaxError: invalid syntax/).waitFor();
  check('SyntaxError shown without a visualization or Mentor',await ui.locator('.chart-svg').count()===0);
  results.performance.syntheticFetch=await ui.evaluate(()=>window.audit.fetchTimings);
  await ui.goto(`${production}/learn/audit-task`);await ui.getByText('Audit starter task',{exact:true}).first().waitFor();
  await ui.locator('[data-runtime-status="ready"]').waitFor({timeout:65000});
  check('task starter populates editor',(await ui.locator('.code-textarea').inputValue())===task.starter_code);
  await runOnce();check('task starter executes',await ui.locator('.chart-svg').isVisible());
  check('emitted module worker loaded',await ui.evaluate(()=>window.audit.workers.some(x=>/assets\/python.worker-.*\.js/.test(x))));
  check('no unexpected API routes',!results.unexpectedApi?.length);
  check('no backend execution requests',network.every(r=>!['/analyze','/complexity'].includes(r.path)));
  check('no uncaught production UI errors',uiErrors.length===0);
  results.network=network;results.secondaryTimings={classification:stats(completions.classification),persistence:stats(completions.persistence)};
  results.uiErrors=uiErrors;results.consoleErrors=consoleErrors;results.assets=assets;
  // Deliberately fail the CDN for a fresh runtime, then restore and Retry.
  blockCDN=true;
  const offline=await context.newPage();await offline.goto(`${production}/playground`);
  await offline.locator('[data-runtime-status="error"]').waitFor({timeout:65000});
  check('CDN failure disables Run',await offline.getByRole('button',{name:'Run',exact:true}).isDisabled());
  blockCDN=false;await offline.getByRole('button',{name:'Retry',exact:true}).click();
  await offline.locator('[data-runtime-status="ready"]').waitFor({timeout:65000});
  check('Retry boots fresh real runtime',await offline.evaluate(()=>window.audit.workers.length>=2));
  await offline.getByRole('button',{name:'Run',exact:true}).click();await offline.locator('.chart-svg').waitFor();
  check('Run succeeds after CDN Retry',await offline.locator('.chart-svg').isVisible());
  await context.close();
} catch(error) {
  results.failure=error.stack;throw error;
} finally {
  await browser.close();
  await writeFile(process.env.AUDIT_OUTPUT || '/tmp/algorythm-browser-audit.json',JSON.stringify(results,null,2)+'\n');
}
console.log(JSON.stringify({checks:results.checks,performance:results.performance},null,2));
