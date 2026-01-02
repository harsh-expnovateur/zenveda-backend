// models/userModel.js
const { getPool, mssql } = require("../../config/db");

const createUser = async ({ email, passwordHash, name, role = "user" }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("email", mssql.NVarChar(255), email)
    .input("password_hash", mssql.NVarChar(255), passwordHash)
    .input("name", mssql.NVarChar(255), name)
    .input("role", mssql.NVarChar(50), role)
    .query(`INSERT INTO users (name, email, password_hash, role)
            OUTPUT INSERTED.id, INSERTED.email, INSERTED.name, INSERTED.role
            VALUES (@name, @email, @password_hash, @role);`);
  return result.recordset[0];
};

const findUserByEmail = async (email) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("email", mssql.NVarChar(255), email)
    .query(`SELECT id, email, password_hash, name, role FROM users WHERE email = @email;`);
  return result.recordset[0];
};

const findUserById = async (id) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", mssql.Int, id)
    .query(`SELECT id, email, name, role FROM users WHERE id = @id;`);
  return result.recordset[0];
};

const storeRefreshToken = async ({ userId, tokenHash, expiresAt }) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("user_id", mssql.Int, userId)
    .input("token_hash", mssql.NVarChar(512), tokenHash)
    .input("expires_at", mssql.DateTime2, expiresAt)
    .query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            VALUES (@user_id, @token_hash, @expires_at);
            SELECT SCOPE_IDENTITY() as id;`);
  return result.recordset[0];
};

const findRefreshToken = async (tokenHash) => {
  const pool = await getPool();
  const result = await pool.request()
    .input("token_hash", mssql.NVarChar(512), tokenHash)
    .query(`SELECT id, user_id, token_hash, expires_at FROM refresh_tokens WHERE token_hash = @token_hash;`);
  return result.recordset[0];
};

const deleteRefreshTokenById = async (id) => {
  const pool = await getPool();
  await pool.request()
    .input("id", mssql.Int, id)
    .query(`DELETE FROM refresh_tokens WHERE id = @id;`);
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  storeRefreshToken,
  findRefreshToken,
  deleteRefreshTokenById
};
