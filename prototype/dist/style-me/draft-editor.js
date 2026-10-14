import {editCanvas} from './canvas.js';
/** Local first, with ordered revision-checked saves and idempotent recovery. */
export function createDraftEditor({read,write,send,onFailure=()=>{},onSettled=()=>{}}) {
  let queue=Promise.resolve(),epoch=0,blocked=null;
  const unsaved=[];
  async function persist(operation,token){
    if(token!==epoch||blocked)return;
    try{
      const saved=await send(operation.id,operation.body);
      if(token!==epoch)return;
      const at=unsaved.indexOf(operation);if(at>=0)unsaved.splice(at,1);
      if(read()?.id===operation.id&&read().canvas.revision===operation.revision)write(saved);
    }catch(error){
      if(token===epoch){blocked=error;await onFailure(error,operation.id);}
      throw error;
    }finally{if(token===epoch)onSettled();}
  }
  return {
    get pending(){return unsaved.length;},
    get failed(){return Boolean(blocked);},
    async flush(){await queue;if(blocked)throw blocked;},
    reset(){epoch++;unsaved.length=0;blocked=null;},
    async retry(){
      await queue;const token=epoch;blocked=null;
      const task=(async()=>{for(const operation of [...unsaved])await persist(operation,token);})();
      queue=task.catch(()=>{});return task;
    },
    edit(action){
      const before=read(),token=epoch,id=before.id,revision=before.canvas.revision;
      const next={...before,canvas:editCanvas(before.canvas,revision,action)};
      const operation={id,revision:next.canvas.revision,body:{requestId:crypto.randomUUID(),revision,action}};
      unsaved.push(operation);write(next);
      const task=queue.then(()=>persist(operation,token));queue=task.catch(()=>{});return task;
    }
  };
}
