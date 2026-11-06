import {open} from "node:fs/promises";
/** Linux flock holds the inode until its pipe worker exits, even after SIGKILL.
 * Never unlink this file: replacing its inode could admit a second live owner. */
export async function acquireProjectLock(file:string){
  const handle=await open(file,"a",0o600);await handle.close();
  const child=(()=>{
    try{return Bun.spawn(["flock","--exclusive","--nonblock","--",file,"cat"],{stdin:"pipe",stdout:"pipe",stderr:"ignore"});}
    catch{throw new Error("Deployment lock requires Linux flock");}
  })();
  const reader=child.stdout.getReader();
  try{
    child.stdin.write("locked\n");await child.stdin.flush();
    let ready="";
    while(ready.length<7){const chunk=await reader.read();if(chunk.done)throw new Error("busy");ready+=new TextDecoder().decode(chunk.value);}
    if(ready!=="locked\n")throw new Error("busy");
  }catch{
    child.stdin.end();await child.exited;reader.releaseLock();
    throw new Error("Deployment already in progress");
  }
  return {async release(){child.stdin.end();await child.exited;reader.releaseLock();}};
}
