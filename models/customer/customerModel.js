// models/customer/customerModel.js
const { getPool, mssql } = require("../../config/db");

/**
 * Create a new customer
 */
async function createCustomer({ name, phoneNumber, email, passwordHash, dob }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("name", mssql.NVarChar(100), name)
    .input("phone_number", mssql.VarChar(15), phoneNumber)
    .input("email", mssql.NVarChar(150), email)
    .input("password_hash", mssql.NVarChar(255), passwordHash)
    .input("dob", mssql.Date, dob)
    .query(`
      INSERT INTO CustomerRegistration (name, phone_number, email, password_hash, dob)
      OUTPUT INSERTED.customer_id, INSERTED.name, INSERTED.email, INSERTED.phone_number
      VALUES (@name, @phone_number, @email, @password_hash, @dob)
    `);
  return result.recordset[0];
}

/**
 * Find customer by email
 */
async function findCustomerByEmail(email) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("email", mssql.NVarChar(150), email)
    .query(`
      SELECT customer_id, name, phone_number, email, password_hash, dob, created_at
      FROM CustomerRegistration
      WHERE email = @email
    `);
  return result.recordset[0] || null;
}

/**
 * Find customer by phone number
 */
async function findCustomerByPhone(phoneNumber) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("phone_number", mssql.VarChar(15), phoneNumber)
    .query(`
      SELECT customer_id, name, phone_number, email, password_hash, dob, created_at
      FROM CustomerRegistration
      WHERE phone_number = @phone_number
    `);
  return result.recordset[0] || null;
}

/**
 * Find customer by ID
 */
async function findCustomerById(customerId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .query(`
      SELECT customer_id, name, phone_number, email, dob, created_at, updated_at
      FROM CustomerRegistration
      WHERE customer_id = @customer_id
    `);
  return result.recordset[0] || null;
}

/**
 * Store refresh token for customer
 */
async function storeCustomerRefreshToken({ customerId, tokenHash, expiresAt }) {
  const pool = await getPool();
  await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .input("token_hash", mssql.NVarChar(512), tokenHash)
    .input("expires_at", mssql.DateTime2, expiresAt)
    .query(`
      INSERT INTO customer_refresh_tokens (customer_id, token_hash, expires_at)
      VALUES (@customer_id, @token_hash, @expires_at)
    `);
}

/**
 * Find refresh token
 */
async function findCustomerRefreshToken(tokenHash) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("token_hash", mssql.NVarChar(512), tokenHash)
    .query(`
      SELECT id, customer_id, token_hash, expires_at
      FROM customer_refresh_tokens
      WHERE token_hash = @token_hash
    `);
  return result.recordset[0] || null;
}

/**
 * Delete refresh token by ID
 */
async function deleteCustomerRefreshTokenById(id) {
  const pool = await getPool();
  await pool
    .request()
    .input("id", mssql.Int, id)
    .query(`DELETE FROM customer_refresh_tokens WHERE id = @id`);
}

/**
 * Delete all expired tokens (cleanup)
 */
async function deleteExpiredCustomerTokens() {
  const pool = await getPool();
  await pool.request().query(`
    DELETE FROM customer_refresh_tokens
    WHERE expires_at < SYSUTCDATETIME()
  `);
}

module.exports = {
  createCustomer,
  findCustomerByEmail,
  findCustomerByPhone,
  findCustomerById,
  storeCustomerRefreshToken,
  findCustomerRefreshToken,
  deleteCustomerRefreshTokenById,
  deleteExpiredCustomerTokens,
};