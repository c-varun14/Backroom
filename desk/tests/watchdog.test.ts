import {test,expect} from 'bun:test';
import {Store} from '../src/store';
import {Watchdog} from '../src/watchdog';
test('fake clock: progress, owner wait, restart and one warning per assignment',async()=>{
 const store=new Store();let now=0;const cards:string[]=[];const post=async(n:number,r:string)=>{cards.push(`${n}:${r}`);};
 try{
  let watch=new Watchdog(store,'sample',()=>now);expect(watch.timeoutMs).toBe(1200000);
  watch.assign(1,'builder');now=1199999;await watch.poll(post);expect(cards).toEqual([]);
  watch.progress('lead');now=1200000;await watch.poll(post);expect(cards).toEqual(['1:builder']);
  watch=new Watchdog(store,'sample',()=>now);now+=1200000;await watch.poll(post);watch.progress('builder');now+=1200000;await watch.poll(post);expect(cards).toHaveLength(1);
  watch.assign(1,'reviewer');now+=1000000;watch.progress('reviewer');now+=300000;await watch.poll(post);expect(cards).toHaveLength(1);
  now+=900000;await watch.poll(post);expect(cards).toEqual(['1:builder','1:reviewer']);
  watch.assign(2,'lead');watch.clear();now+=1200000;await watch.poll(post);expect(cards).toHaveLength(2);
  expect(()=>new Watchdog(store,'bad',()=>now,0)).toThrow();
 }finally{store.close();}
});
test('failed warning transport is never repeated on restart',async()=>{
 const store=new Store();let now=0;try{const watch=new Watchdog(store,'sample',()=>now,1);watch.assign(1,'lead');now=2;await expect(watch.poll(async()=>{throw new Error('offline');})).rejects.toThrow('offline');let calls=0;await new Watchdog(store,'sample',()=>now,1).poll(async()=>{calls++;});expect(calls).toBe(0);}finally{store.close();}
});
