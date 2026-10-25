export const INSERT_SCAN_GUARDED =
  "INSERT INTO scans (id,owner_id,created_at,quiz_json,result_json,source,model,message) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE owner_id = ? AND age_confirmed = 1 AND created_at = ?) AND (? = 'quiz' OR ((SELECT id FROM consents WHERE owner_id = ? AND purpose = 'analysis' ORDER BY created_at DESC, rowid DESC LIMIT 1) = ? AND (SELECT granted FROM consents WHERE owner_id = ? AND purpose = 'analysis' ORDER BY created_at DESC, rowid DESC LIMIT 1) = 1))";
export const INSERT_EVENT_FOR_SCAN =
  "INSERT INTO events (id,owner_id,name,properties,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM scans WHERE id = ? AND owner_id = ?)";
export const PROFILE_GENERATION_EXISTS =
  "EXISTS(SELECT 1 FROM profiles WHERE owner_id = ? AND age_confirmed = 1 AND created_at = ?)";
export const CLOSE_PROFILE =
  "UPDATE profiles SET age_confirmed = 0 WHERE owner_id = ?";
export const UPSERT_PROFILE =
  "INSERT INTO profiles (owner_id,created_at,age_confirmed,quiz_json) VALUES (?,?,1,?) ON CONFLICT(owner_id) DO UPDATE SET quiz_json=COALESCE(excluded.quiz_json,profiles.quiz_json) WHERE profiles.age_confirmed = 1";
