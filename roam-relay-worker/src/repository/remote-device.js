export async function getRemoteDeviceBySlug(db, slug) {
  return (
    (await db
      .prepare('SELECT * FROM devices WHERE slug = ?')
      .bind(slug)
      .first()) || null
  );
}

export async function getRemoteDeviceByTokenHash(db, tokenHash) {
  return (
    (await db
      .prepare('SELECT * FROM devices WHERE token_hash = ?')
      .bind(tokenHash)
      .first()) || null
  );
}

export async function updateRemoteDevice(db, deviceId, patch) {
  const fields = Object.keys(patch);
  if (fields.length === 0) return null;
  const values = fields.map((key) => patch[key]);
  const setClause = fields.map((key) => `${key} = ?`).join(', ');
  await db
    .prepare(`UPDATE devices SET ${setClause} WHERE device_id = ?`)
    .bind(...values, deviceId)
    .run();
  return (
    (await db
      .prepare('SELECT * FROM devices WHERE device_id = ?')
      .bind(deviceId)
      .first()) || null
  );
}
