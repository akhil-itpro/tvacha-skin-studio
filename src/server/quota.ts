export const INITIALIZE_DAY = 'INSERT OR IGNORE INTO scan_daily_usage (day,count) VALUES (?,0)';
export const RESERVE_SCAN = 'INSERT INTO scan_reservations (id,owner_id,day,created_at) SELECT ?,?,?,? WHERE (SELECT count FROM scan_daily_usage WHERE day = ?) < ? AND (SELECT COUNT(*) FROM scan_reservations WHERE owner_id = ? AND day = ?) < ?';
export const INCREMENT_DAY = 'UPDATE scan_daily_usage SET count = count + 1 WHERE day = ? AND EXISTS(SELECT 1 FROM scan_reservations WHERE id = ?)';

/** D1 batch is a transaction: both global and personal limits are checked before committing a slot. */
export async function reserveScan(database:D1Database, ownerId:string, day:string, createdAt:string, globalCap:number, personalCap:number):Promise<boolean> {
  const reservationId=crypto.randomUUID();
  const result=await database.batch([
    database.prepare(INITIALIZE_DAY).bind(day),
    database.prepare(RESERVE_SCAN).bind(reservationId,ownerId,day,createdAt,day,globalCap,ownerId,day,personalCap),
    database.prepare(INCREMENT_DAY).bind(day,reservationId),
  ]);
  return (result[1].meta.changes??0)>0;
}
