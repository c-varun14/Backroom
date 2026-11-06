import {expect,test} from 'bun:test';
import {Store} from '../src/store';
import {Desk} from '../src/gate';
import {DocumentSnapshots} from '../src/document-snapshots';

function legacy(kind='brief',text='Update from Varun:\n\nSAMPLE exact legacy brief'){
 const store=new Store();
 store.register({id:'sample',ownerId:'owner',studioRoomId:'studio',clientRoomId:'client',clientIds:['sample-client']});
 store.db.exec('CREATE TABLE visible_drafts(id TEXT,artifact TEXT,kind TEXT)');
 const desk=new Desk(store,{} as any,{} as any);
 const draft=desk.createDraft({project:'sample',destinationRoomId:'client',text,attachments:[]});
 store.db.query('INSERT INTO visible_drafts VALUES (?,?,?)').run(draft.id,'legacy-doc',kind);
 return {store,draft,snapshots:new DocumentSnapshots(store,'sample')};
}
test('legacy brief snapshot comes from immutable gate bytes and preserves pending code/status',()=>{
 const f=legacy();try{
  expect(f.snapshots.get('legacy-doc').content).toBe('SAMPLE exact legacy brief');
  expect(()=>f.snapshots.check('legacy-doc','SAMPLE edited room document')).toThrow('Changed document');
  expect(f.store.db.query('SELECT code,status FROM drafts WHERE id=?').get(f.draft.id)).toEqual({code:f.draft.code,status:'active'});
  expect(f.snapshots.get('legacy-doc').content).toBe('SAMPLE exact legacy brief');
 }finally{f.store.close();}
});
test('legacy import refuses reply documents and unknown text formats',()=>{
 for(const [kind,text] of [['reply','Update from Varun:\n\nSAMPLE reply'],['brief','SAMPLE unrecognized prefix']]){
  const f=legacy(kind,text);try{expect(()=>f.snapshots.get('legacy-doc')).toThrow('Missing or corrupt');}finally{f.store.close();}
 }
});
test('legacy import refuses corrupt frozen records and leaves authority absent',()=>{
 const f=legacy();try{
  f.store.db.query("INSERT INTO drafts VALUES ('corrupt','sample','default','bad-code','{}',?,'active')").run('0'.repeat(64));
  f.store.db.query("INSERT INTO visible_drafts VALUES ('corrupt','legacy-doc','brief')").run();
  expect(()=>f.snapshots.get('legacy-doc')).toThrow('Missing or corrupt');
  expect(f.store.db.query('SELECT count(*) AS n FROM document_snapshots').get()).toEqual({n:0});
 }finally{f.store.close();}
});
