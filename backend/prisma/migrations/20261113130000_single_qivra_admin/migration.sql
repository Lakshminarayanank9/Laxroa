DO $$
DECLARE
  target_user_id TEXT;
  existing_admin_id TEXT;
BEGIN
  SELECT "id"
  INTO target_user_id
  FROM "User"
  WHERE LOWER("email") = LOWER('kanagarajnarayanan5@gmail.com')
  LIMIT 1;

  IF target_user_id IS NULL THEN
    SELECT "id"
    INTO existing_admin_id
    FROM "User"
    WHERE "role" = 'ADMIN'
    ORDER BY "createdAt", "id"
    LIMIT 1;

    IF existing_admin_id IS NOT NULL THEN
      UPDATE "User"
      SET "email" = 'kanagarajnarayanan5@gmail.com'
      WHERE "id" = existing_admin_id;
      target_user_id := existing_admin_id;
    END IF;
  ELSE
    UPDATE "User"
    SET "email" = 'kanagarajnarayanan5@gmail.com'
    WHERE "id" = target_user_id;
  END IF;

  IF target_user_id IS NOT NULL THEN
    UPDATE "User"
    SET "role" = 'USER'
    WHERE "role" = 'ADMIN' AND "id" <> target_user_id;

    UPDATE "User"
    SET "role" = 'ADMIN'
    WHERE "id" = target_user_id;
  END IF;
END $$;

CREATE UNIQUE INDEX "User_single_admin_idx"
ON "User" ("role")
WHERE "role" = 'ADMIN';
