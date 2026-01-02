// models/customer/addressModel.js
const { getPool, mssql } = require("../../config/db");

/**
 * Get all addresses for a customer
 */
async function getCustomerAddresses(customerId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .query(`
      SELECT 
        address_id, name, phone_number, address_line1, address_line2,
        city, state, pincode, is_default
      FROM CustomerAddress
      WHERE customer_id = @customer_id
      ORDER BY is_default DESC, created_at DESC
    `);
  return result.recordset;
}

/**
 * Get default address for a customer
 */
async function getDefaultAddress(customerId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .query(`
      SELECT TOP 1
        address_id, name, phone_number, address_line1, address_line2,
        city, state, pincode, is_default
      FROM CustomerAddress
      WHERE customer_id = @customer_id AND is_default = 1
    `);
  return result.recordset[0] || null;
}

/**
 * Add new address
 */
async function addAddress({
  customerId,
  name,
  phoneNumber,
  addressLine1,
  addressLine2,
  city,
  state,
  pincode,
  isDefault = false,
}) {
  const pool = await getPool();

  // If setting as default, unset other defaults first
  if (isDefault) {
    await pool
      .request()
      .input("customer_id", mssql.Int, customerId)
      .query(`
        UPDATE CustomerAddress
        SET is_default = 0
        WHERE customer_id = @customer_id
      `);
  }

  const result = await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .input("name", mssql.NVarChar(100), name)
    .input("phone_number", mssql.VarChar(15), phoneNumber)
    .input("address_line1", mssql.NVarChar(500), addressLine1)
    .input("address_line2", mssql.NVarChar(500), addressLine2 || null)
    .input("city", mssql.NVarChar(100), city)
    .input("state", mssql.NVarChar(100), state)
    .input("pincode", mssql.NVarChar(10), pincode)
    .input("is_default", mssql.Bit, isDefault)
    .query(`
      INSERT INTO CustomerAddress (
        customer_id, name, phone_number, address_line1, address_line2,
        city, state, pincode, is_default
      )
      OUTPUT INSERTED.address_id
      VALUES (
        @customer_id, @name, @phone_number, @address_line1, @address_line2,
        @city, @state, @pincode, @is_default
      )
    `);

  return result.recordset[0].address_id;
}

/**
 * Update address
 */
async function updateAddress({
  addressId,
  customerId,
  name,
  phoneNumber,
  addressLine1,
  addressLine2,
  city,
  state,
  pincode,
  isDefault,
}) {
  const pool = await getPool();

  // If setting as default, unset other defaults first
  if (isDefault) {
    await pool
      .request()
      .input("customer_id", mssql.Int, customerId)
      .input("address_id", mssql.Int, addressId)
      .query(`
        UPDATE CustomerAddress
        SET is_default = 0
        WHERE customer_id = @customer_id AND address_id != @address_id
      `);
  }

  await pool
    .request()
    .input("address_id", mssql.Int, addressId)
    .input("customer_id", mssql.Int, customerId)
    .input("name", mssql.NVarChar(100), name)
    .input("phone_number", mssql.VarChar(15), phoneNumber)
    .input("address_line1", mssql.NVarChar(500), addressLine1)
    .input("address_line2", mssql.NVarChar(500), addressLine2 || null)
    .input("city", mssql.NVarChar(100), city)
    .input("state", mssql.NVarChar(100), state)
    .input("pincode", mssql.NVarChar(10), pincode)
    .input("is_default", mssql.Bit, isDefault)
    .query(`
      UPDATE CustomerAddress
      SET name = @name,
          phone_number = @phone_number,
          address_line1 = @address_line1,
          address_line2 = @address_line2,
          city = @city,
          state = @state,
          pincode = @pincode,
          is_default = @is_default,
          updated_at = SYSUTCDATETIME()
      WHERE address_id = @address_id AND customer_id = @customer_id
    `);
}

/**
 * Delete address
 */
async function deleteAddress(addressId, customerId) {
  const pool = await getPool();
  await pool
    .request()
    .input("address_id", mssql.Int, addressId)
    .input("customer_id", mssql.Int, customerId)
    .query(`
      DELETE FROM CustomerAddress
      WHERE address_id = @address_id AND customer_id = @customer_id
    `);
}

/**
 * Set default address
 */
async function setDefaultAddress(addressId, customerId) {
  const pool = await getPool();

  // Unset all defaults
  await pool
    .request()
    .input("customer_id", mssql.Int, customerId)
    .query(`
      UPDATE CustomerAddress
      SET is_default = 0
      WHERE customer_id = @customer_id
    `);

  // Set new default
  await pool
    .request()
    .input("address_id", mssql.Int, addressId)
    .input("customer_id", mssql.Int, customerId)
    .query(`
      UPDATE CustomerAddress
      SET is_default = 1, updated_at = SYSUTCDATETIME()
      WHERE address_id = @address_id AND customer_id = @customer_id
    `);
}

module.exports = {
  getCustomerAddresses,
  getDefaultAddress,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};