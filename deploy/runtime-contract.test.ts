import {test,expect} from "bun:test";
import {parseRuntimeContract,composeLiteral} from "./runtime-contract";
test("small runtime contract normalizes storage, file secrets and ordinary settings",()=>{
 const c=parseRuntimeContract({version:1,storage:[{name:"orders",target:"/data"}],settings:{DATABASE_PATH:"/data/orders.sqlite",OWNER_PASSWORD_FILE:"/run/secrets/owner"},secrets:[{name:"owner",target:"/run/secrets/owner"}]});
 expect(c.storage[0]).toEqual({name:"orders",target:"/data",uid:1000,gid:1000});expect(c.secrets[0].target).toBe("/run/secrets/owner");
});
test("rejects arbitrary host mounts, traversal, overlaps and compose fields",()=>{
 for(const input of [
  {version:1,privileged:true},{version:2},{version:1,storage:[{name:"orders",target:"/etc"}]},
  {version:1,storage:[{name:"orders",target:"/data/../etc"}]},{version:1,storage:[{name:"orders",target:"/data",uid:0}]},
  {version:1,secrets:[{name:"owner",target:"/run/secrets/owner",file:"/host/credential"}]},
  {version:1,storage:[{name:"one",target:"/data"},{name:"two",target:"/data/nested"}]},
 ])expect(()=>parseRuntimeContract(input)).toThrow();
});
test("rejects secret-valued settings and preserves literal Compose dollars",()=>{
 expect(()=>parseRuntimeContract({version:1,settings:{PASSWORD:"fictional-only"}})).toThrow("mounted secret");
 expect(()=>parseRuntimeContract({version:1,settings:{VALUE:"sk-"+"fictionaltestvalue1234"}})).toThrow("mounted secret");
 expect(composeLiteral({environment:{LITERAL:"${HOME} $test"}})).toEqual({environment:{LITERAL:"$${HOME} $$test"}});
});
