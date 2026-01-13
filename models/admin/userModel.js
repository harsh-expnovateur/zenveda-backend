// models/admin/userModel.js
const { getPool, mssql } = require("../../config/db");

const createUser = async ({ email, passwordHash, name, role = "user", isActive = true }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("email", mssql.NVarChar(255), email)
    .input("password_hash", mssql.NVarChar(255), passwordHash)
    .input("name", mssql.NVarChar(255), name)
    .input("role", mssql.NVarChar(50), role)
    .input("is_active", mssql.Bit, isActive ? 1 : 0)
    .query(`INSERT INTO users (name, email, password_hash, role, is_active)
            OUTPUT INSERTED.id, INSERTED.email, INSERTED.name, INSERTED.role, INSERTED.is_active
            VALUES (@name, @email, @password_hash, @role, @is_active);`);
  return result.recordset[0];
};

const findUserByEmail = async (email) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("email", mssql.NVarChar(255), email)
    .query(`SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = @email;`);
  return result.recordset[0];
};

const findUserById = async (id) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", mssql.Int, id)
    .query(`SELECT id, email, name, role, is_active FROM users WHERE id = @id;`);
  return result.recordset[0];
};

/* ================= NEW USER MANAGEMENT METHODS ================= */

const getAllUsers = async () => {
  const pool = await getPool();
  const result = await pool.request()
    .query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.is_active,
        u.created_at
      FROM users u
      ORDER BY u.created_at
    `);
  return result.recordset;
};

const getUserWithPermissions = async (userId) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", mssql.Int, userId)
    .query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.is_active,
        p.id as permission_id,
        p.[key] as permission_key,
        p.label as permission_label
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      LEFT JOIN permissions p ON up.permission_id = p.id
      WHERE u.id = @user_id
    `);
  return result.recordset;
};

const updateUser = async ({ id, name, email, role, isActive }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", mssql.Int, id)
    .input("name", mssql.NVarChar(255), name)
    .input("email", mssql.NVarChar(255), email)
    .input("role", mssql.NVarChar(50), role)
    .input("is_active", mssql.Bit, isActive ? 1 : 0)
    .query(`
      UPDATE users 
      SET name = @name,
          email = @email,
          role = @role,
          is_active = @is_active,
          updated_at = GETDATE()
      OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role, INSERTED.is_active
      WHERE id = @id
    `);
  return result.recordset[0];
};

const updateUserPassword = async ({ userId, passwordHash }) => {
  const pool = await getPool();
  await pool.request()
    .input("id", mssql.Int, userId)
    .input("password_hash", mssql.NVarChar(255), passwordHash)
    .query(`
      UPDATE users
      SET password_hash = @password_hash,
          updated_at = GETDATE()
      WHERE id = @id
    `);
};


const toggleUserActiveStatus = async (id) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", mssql.Int, id)
    .query(`
      UPDATE users 
      SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
          updated_at = GETDATE()
      OUTPUT INSERTED.id, INSERTED.is_active
      WHERE id = @id
    `);
  return result.recordset[0];
};

const deleteUser = async (id) => {
  const pool = await getPool();
  await pool.request()
    .input("id", mssql.Int, id)
    .query(`DELETE FROM users WHERE id = @id`);
};

/* ================= PERMISSION METHODS ================= */

const getAllPermissions = async () => {
  const pool = await getPool();
  const result = await pool.request()
    .query(`SELECT id, [key], label FROM permissions ORDER BY id`);
  return result.recordset;
};

const setUserPermissions = async (userId, permissionIds) => {
  const pool = await getPool();
  
  // First, delete existing permissions
  await pool.request()
    .input("user_id", mssql.Int, userId)
    .query(`DELETE FROM user_permissions WHERE user_id = @user_id`);
  
  // Then, insert new permissions
  if (permissionIds && permissionIds.length > 0) {
    for (const permId of permissionIds) {
      await pool.request()
        .input("user_id", mssql.Int, userId)
        .input("permission_id", mssql.Int, permId)
        .query(`
          INSERT INTO user_permissions (user_id, permission_id)
          VALUES (@user_id, @permission_id)
        `);
    }
  }
};

const getUserPermissions = async (userId) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", mssql.Int, userId)
    .query(`
      SELECT p.id, p.[key], p.label
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = @user_id
    `);
  return result.recordset;
};

/* ================= REFRESH TOKEN METHODS ================= */

const storeRefreshToken = async ({
  userId,
  tokenHash,
  expiresAt,
  sessionId
}) => {
  const pool = await getPool();
  await pool.request()
    .input("user_id", mssql.Int, userId)
    .input("token_hash", mssql.NVarChar(512), tokenHash)
    .input("expires_at", mssql.DateTime2, expiresAt)
    .input("session_id", mssql.UniqueIdentifier, sessionId)
    .query(`
      INSERT INTO refresh_tokens
      (user_id, token_hash, expires_at, session_id)
      VALUES (@user_id, @token_hash, @expires_at, @session_id)
    `);
};

const findRefreshToken = async (tokenHash) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("token_hash", mssql.NVarChar(512), tokenHash)
    .query(`
      SELECT * FROM refresh_tokens
      WHERE token_hash = @token_hash
    `);
  return result.recordset[0];
};

const markRefreshTokenUsed = async (id) => {
  const pool = await getPool();
  await pool.request()
    .input("id", mssql.Int, id)
    .query(`
      UPDATE refresh_tokens
      SET used = 1,
          updated_at = GETDATE()
      WHERE id = @id
    `);
};

const revokeSession = async (sessionId) => {
  const pool = await getPool();
  await pool.request()
    .input("session_id", mssql.UniqueIdentifier, sessionId)
    .query(`
      UPDATE refresh_tokens
      SET revoked = 1,
          updated_at = GETDATE()
      WHERE session_id = @session_id
    `);
};

const rotateRefreshToken = async ({
  sessionId,
  newTokenHash,
  expiresAt,
}) => {
  const pool = await getPool();
  await pool.request()
    .input("session_id", mssql.UniqueIdentifier, sessionId)
    .input("token_hash", mssql.NVarChar(512), newTokenHash)
    .input("expires_at", mssql.DateTime2, expiresAt)
    .query(`
      UPDATE refresh_tokens
      SET 
        token_hash = @token_hash,
        expires_at = @expires_at,
        used = 0,
        updated_at = GETDATE()
      WHERE session_id = @session_id
        AND revoked = 0
    `);
};


module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  getAllUsers,
  getUserWithPermissions,
  updateUser,
  updateUserPassword,
  toggleUserActiveStatus,
  deleteUser,
  getAllPermissions,
  setUserPermissions,
  getUserPermissions,
  storeRefreshToken,
  findRefreshToken,
  markRefreshTokenUsed,
  revokeSession,
  rotateRefreshToken
};