// The key an attack's breakdown is asked for by ('attack:<key>' / 'damage:<key>' in engine/audit.ts): the equipped
// weapon's instance id, else its item id ('unarmed_strike' for that). Its own module so the audit engine and the action
// cards can share it without importing each other.
export function attackKey(attack: { id: string; instanceId?: string }): string {
  return attack.instanceId ?? attack.id;
}
