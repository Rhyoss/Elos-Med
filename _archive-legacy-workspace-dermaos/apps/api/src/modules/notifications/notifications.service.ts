import { db } from '../../db/client.js';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  priority: string;
  is_read: boolean;
  read_at: Date | null;
  delivered_at: Date | null;
  created_at: Date;
}

export async function listNotifications(
  userId: string,
  clinicId: string,
  opts: { limit?: number; offset?: number; unreadOnly?: boolean },
): Promise<{ notifications: NotificationRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const whereExtra = opts.unreadOnly ? 'AND is_read = false' : '';

  const [dataResult, countResult] = await Promise.all([
    db.query<NotificationRow>(
      `SELECT id, type, title, message, entity_type, entity_id,
              priority, is_read, read_at, delivered_at, created_at
       FROM shared.notifications
       WHERE user_id = $1 AND clinic_id = $2 ${whereExtra}
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, clinicId, limit, offset],
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM shared.notifications
       WHERE user_id = $1 AND clinic_id = $2 ${whereExtra}`,
      [userId, clinicId],
    ),
  ]);

  return {
    notifications: dataResult.rows,
    total: Number(countResult.rows[0]?.count ?? 0),
  };
}

export async function countUnread(userId: string, clinicId: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM shared.notifications
     WHERE user_id = $1 AND clinic_id = $2 AND is_read = false`,
    [userId, clinicId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function markAsRead(ids: string[], userId: string, clinicId: string): Promise<number> {
  if (!ids.length) return 0;
  const result = await db.query(
    `UPDATE shared.notifications
     SET is_read = true, read_at = NOW()
     WHERE id = ANY($1::uuid[]) AND user_id = $2 AND clinic_id = $3 AND is_read = false`,
    [ids, userId, clinicId],
  );
  return result.rowCount ?? 0;
}

export async function markAllAsRead(userId: string, clinicId: string): Promise<number> {
  const result = await db.query(
    `UPDATE shared.notifications
     SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND clinic_id = $2 AND is_read = false`,
    [userId, clinicId],
  );
  return result.rowCount ?? 0;
}

export async function markDelivered(notificationId: string, userId: string): Promise<void> {
  await db.query(
    `UPDATE shared.notifications
     SET delivered_at = NOW()
     WHERE id = $1 AND user_id = $2 AND delivered_at IS NULL`,
    [notificationId, userId],
  );
}
