const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('punch-location.js', 'utf8');
async function run(location) {
  const buttons = [{disabled:false}, {disabled:true}];
  const alerts = [];
  const ctx = vm.createContext({
    document:{querySelectorAll:()=>buttons},
    getLocation:callback=>callback(location),
    alert:message=>alerts.push(message), setTimeout, clearTimeout
  });
  vm.runInContext(code,ctx);
  const result = await ctx.requirePunchLocation();
  assert.equal(buttons[0].disabled,false);
  assert.equal(buttons[1].disabled,true);
  return {result,alerts};
}
(async()=>{
  for(const location of [null,{lat:'Denied',lng:''},{lat:'Unavailable',lng:''},{lat:'',lng:''}]) {
    const {result,alerts}=await run(location);
    assert.equal(result,null);
    assert.equal(alerts.length,1);
  }
  const valid={lat:'25.123456',lng:'55.123456',acc:'12m'};
  assert.equal((await run(valid)).result,valid);
  console.log('Location guard: denied/unavailable blocked; valid coordinates accepted; controls restored.');
})().catch(error=>{console.error(error);process.exitCode=1;});
