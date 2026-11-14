import { CampaignRules, CharacterOverride, DERIVED_NUMERIC_KEYS, Entity } from './types';
import { recomputeDerived } from './pipeline';
const abilities=new Set(['str','dex','con','int','wis','cha']);
const allowed=(stat:string)=>DERIVED_NUMERIC_KEYS.has(stat)||stat.startsWith('savingThrows.')||abilities.has(stat);
const id=()=>`manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export function applyCharacterOverride(entity:Entity,input:{stat:string;value:number;label?:string;operation?:'set'|'add'},rules:CampaignRules):Entity{
 if(!allowed(input.stat))return entity;const now=Date.now();const prior=(entity.characterOverrides??[]).map(o=>o.active&&o.stat===input.stat?{...o,active:false,cancelledAt:now}:o);
 const override:CharacterOverride={id:id(),entityId:entity.id,stat:input.stat,value:input.value,label:input.label??'Character Override',operation:input.operation??'set',active:true,appliedAt:now,cancelledAt:null};
 const next=recomputeDerived({...entity,characterOverrides:[...prior,override]},rules);return next;
}
export function removeCharacterOverride(entity:Entity,overrideId:string,rules:CampaignRules):Entity{const now=Date.now();const next=recomputeDerived({...entity,characterOverrides:(entity.characterOverrides??[]).map(o=>o.id===overrideId?{...o,active:false,cancelledAt:now}:o)},rules);return next;}
export function activeCharacterOverrides(entity:Entity){return (entity.characterOverrides??[]).filter(o=>o.active).sort((a,b)=>a.appliedAt-b.appliedAt);}
