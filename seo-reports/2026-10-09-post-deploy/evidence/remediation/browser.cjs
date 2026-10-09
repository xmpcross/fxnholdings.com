const {chromium}=require('/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs=require('fs');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];
for(const width of [390,1440]){
const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.BASE_URL||'http://127.0.0.1:8876')+'/insights/uk-vat-for-online-sellers-when-to-register/',{waitUntil:'networkidle'});
const dots=page.locator('.feat-dot');
const sizes=await dots.evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
if(!sizes.length||sizes.some(r=>r.width<44||r.height<44))throw Error('Target size failed');
await dots.nth(1).click();await page.waitForFunction(()=>document.querySelectorAll('.feat-dot')[1].getAttribute('aria-current')==='true');if(await dots.nth(1).getAttribute('aria-current')!=='true')throw Error('Click failed');
await dots.nth(2).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.feat-dot')[2].getAttribute('aria-current')==='true');if(await dots.nth(2).getAttribute('aria-current')!=='true')throw Error('Keyboard failed');
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow||errors.length)throw Error(JSON.stringify({overflow,errors}));
if(!await page.getByText('Updated 9 October 2026').count())throw Error('Visible update missing');
results.push({width,sizes,click:true,keyboard:true,overflow,errors});await page.close();
}
await browser.close();fs.writeFileSync(process.env.RESULT_FILE||'/tmp/fxn-remediation-browser.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
