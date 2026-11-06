import {SwitchAPI} from './switch-transport';
const scoped=Symbol('scoped studio API');
/** One wrapper scopes every studio post, including approval-text fallbacks. */
export function scopeStudio(api:SwitchAPI,config:{studioRoomId:string;studioThread?:string},connection:(room:string)=>string):SwitchAPI{
  if(!config.studioThread||(api as any)[scoped])return api;
  const proxy=Object.create(api) as SwitchAPI;(proxy as any)[scoped]=true;
  proxy.post=(room,text,files=[])=>room===config.studioRoomId?
    api.thread(text+(files.length?'\nFiles cannot be uploaded into this forum post through the cached media route. Review text is provided here.':''),config.studioThread!,connection(room)):
    api.post(room,text,files);
  proxy.publishApprovalText=SwitchAPI.prototype.publishApprovalText;
  return proxy;
}
