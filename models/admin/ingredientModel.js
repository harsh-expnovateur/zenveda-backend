const { getPool, mssql } = require("../../config/db");
const logger = require("../../config/logger");

/** 🌿 Get all ingredients */
async function getAllIngredients() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT id, name, description, image_url, is_active, created_at
    FROM [dbo].[ingredients]
    WHERE is_active = 1
    ORDER BY name ASC
  `);
  return result.recordset;
}

/** 🌿 Get ingredient by ID */
async function getIngredientById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", mssql.Int, id)
    .query(`
      SELECT id, name, description, image_url, is_active, created_at
      FROM [dbo].[ingredients]
      WHERE id = @id
    `);
  return result.recordset[0];
}

/** 🌿 Create ingredient */
async function createIngredient(data) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("name", mssql.NVarChar(255), data.name)
    .input("description", mssql.NVarChar(mssql.MAX), data.description || null)
    .input("image_url", mssql.NVarChar(500), data.image_url || null)
    .query(`
      INSERT INTO [dbo].[ingredients] (name, description, image_url)
      OUTPUT INSERTED.id
      VALUES (@name, @description, @image_url)
    `);
  return result.recordset[0].id;
}

/** 🌿 Update ingredient */
async function updateIngredient(id, data) {
  const pool = await getPool();
  await pool
    .request()
    .input("id", mssql.Int, id)
    .input("name", mssql.NVarChar(255), data.name)
    .input("description", mssql.NVarChar(mssql.MAX), data.description || null)
    .input("image_url", mssql.NVarChar(500), data.image_url || null)
    .query(`
      UPDATE [dbo].[ingredients]
      SET name = @name, description = @description, image_url = @image_url,
          updated_at = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

/** 🌿 Delete ingredient */
async function deleteIngredient(id) {
  const pool = await getPool();
  await pool
    .request()
    .input("id", mssql.Int, id)
    .query(`DELETE FROM [dbo].[ingredients] WHERE id = @id`);
}

/** 🫖 Link ingredients to tea */
async function linkIngredientsToTea(teaId, ingredientIds, transaction) {
  for (let i = 0; i < ingredientIds.length; i++) {
    await transaction
      .request()
      .input("tea_id", mssql.Int, teaId)
      .input("ingredient_id", mssql.Int, ingredientIds[i])
      .input("display_order", mssql.Int, i + 1)
      .query(`
        INSERT INTO [dbo].[tea_ingredients] (tea_id, ingredient_id, display_order)
        VALUES (@tea_id, @ingredient_id, @display_order)
      `);
  }
}

/** 🫖 Get ingredients for a tea */
async function getTeaIngredients(teaId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("tea_id", mssql.Int, teaId)
    .query(`
      SELECT i.id, i.name, i.description, i.image_url, ti.display_order
      FROM [dbo].[ingredients] i
      INNER JOIN [dbo].[tea_ingredients] ti ON i.id = ti.ingredient_id
      WHERE ti.tea_id = @tea_id
      ORDER BY ti.display_order ASC
    `);
  return result.recordset;
}

module.exports = {
  getAllIngredients,
  getIngredientById,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  linkIngredientsToTea,
  getTeaIngredients,
};