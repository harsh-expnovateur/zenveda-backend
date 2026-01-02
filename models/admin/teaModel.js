const { getPool, mssql } = require("../../config/db");
const logger = require("../../config/logger");

/** 🫖 Insert Main Tea */
async function insertTea(teaData, transaction) {
  const { name, tag, tagline, description, rating, reviews, is_active } = teaData;

  const result = await transaction
    .request()
    .input("name", mssql.NVarChar(255), name || null)
    .input("tag", mssql.NVarChar(100), tag || null)
    .input("tagline", mssql.NVarChar(255), tagline || null)
    .input("description", mssql.NVarChar(mssql.MAX), description || null)
    .input("rating", mssql.Decimal(3, 2), rating ? parseFloat(rating) : 0)
    .input("reviews", mssql.Int, reviews ? parseInt(reviews) : 0)
    .input("is_active", mssql.Bit, is_active ? 1 : 0)
    .query(`
      INSERT INTO [dbo].[teas] (name, tag, tagline, description, rating, reviews, is_active)
      OUTPUT INSERTED.id
      VALUES (@name, @tag, @tagline, @description, @rating, @reviews, @is_active)
    `);

  return result.recordset[0].id;
}

/** 💰 Insert Packages */
async function insertPackages(teaId, packages, transaction) {
  for (const pkg of packages) {
    await transaction
      .request()
      .input("tea_id", mssql.Int, teaId)
      .input("package_name", mssql.NVarChar(50), pkg.package_name || null)
      .input("selling_price", mssql.Decimal(10, 2), parseFloat(pkg.selling_price) || 0)
      .query(`
        INSERT INTO [dbo].[tea_packages] (tea_id, package_name, selling_price)
        VALUES (@tea_id, @package_name, @selling_price)
      `);
  }
}

/** 🧾 Insert Sections (Health Benefits, Tasting Notes, etc.) */
async function insertSections(teaId, sections, transaction) {
  for (const sec of sections) {
    await transaction
      .request()
      .input("tea_id", mssql.Int, teaId)
      .input("title", mssql.NVarChar(100), sec.title || null)
      .input("content", mssql.NVarChar(mssql.MAX), sec.content || null)
      .query(`
        INSERT INTO [dbo].[tea_sections] (tea_id, title, content)
        VALUES (@tea_id, @title, @content)
      `);
  }
}

/** 🌿 Link Ingredients to Tea */
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

/** 🍵 Insert Brewing Rituals */
async function insertRituals(teaId, rituals, transaction) {
  for (const step of rituals) {
    await transaction
      .request()
      .input("tea_id", mssql.Int, teaId)
      .input("step_text", mssql.NVarChar(255), step.step_text || step.text || null)
      .input("icon_url", mssql.NVarChar(500), step.icon_url || null)
      .input("step_order", mssql.Int, step.step_order ? parseInt(step.step_order) : null)
      .query(`
        INSERT INTO [dbo].[tea_brewing_rituals] (tea_id, step_text, icon_url, step_order)
        VALUES (@tea_id, @step_text, @icon_url, @step_order)
      `);
  }
}

/** 🖼️ Insert Images */
async function insertImages(teaId, images, transaction) {
  for (const img of images) {
    await transaction
      .request()
      .input("tea_id", mssql.Int, teaId)
      .input("image_url", mssql.NVarChar(500), img.image_url || null)
      .input("is_main_image", mssql.Bit, img.is_main_image ? 1 : 0)
      .query(`
        INSERT INTO [dbo].[tea_images] (tea_id, image_url, is_main_image)
        VALUES (@tea_id, @image_url, @is_main_image)
      `);
  }
}

/** 🪴 Insert Icons (Vegan, Cruelty-Free, etc.) */
async function insertIcons(teaId, icons, transaction) {
  for (const icon of icons) {
    await transaction
      .request()
      .input("tea_id", mssql.Int, teaId)
      .input("icon_type", mssql.NVarChar(100), icon.icon_type || null)
      .input("icon_url", mssql.NVarChar(500), icon.icon_url || null)
      .query(`
        INSERT INTO [dbo].[tea_icons] (tea_id, icon_type, icon_url)
        VALUES (@tea_id, @icon_type, @icon_url)
      `);
  }
}

/** 🗑️ Safe delete for tea package */
async function deletePackage(id) {
  const pool = await getPool();

  // Check if the package is referenced in any order
  const result = await pool.request()
    .input("id", mssql.Int, id)
    .query(`SELECT COUNT(*) AS count FROM [dbo].[order_items] WHERE package_id = @id`);

  if (result.recordset[0].count > 0) {
    throw new Error("Cannot delete this package because it has already been ordered.");
  }

  // Safe to delete
  await pool.request()
    .input("id", mssql.Int, id)
    .query(`DELETE FROM [dbo].[tea_packages] WHERE id = @id`);
}


module.exports = {
  insertTea,
  insertPackages,
  insertSections,
  linkIngredientsToTea,
  insertRituals,
  insertImages,
  insertIcons,
  deletePackage,
};