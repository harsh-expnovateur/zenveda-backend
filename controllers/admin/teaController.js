const path = require("path");
const fs = require("fs");
const { getPool, mssql: sql } = require("../../config/db");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Helper function to check if a package is used in any order
 */
const isPackageInOrders = async (pool, packageId) => {
  const result = await pool
    .request()
    .input("package_id", sql.Int, packageId)
    .query(
      `SELECT COUNT(*) AS count FROM dbo.order_items WHERE package_id = @package_id`,
    );
  return result.recordset[0].count > 0;
};

/**
 * Helper function to check if a tea is used in any order
 */
const isTeaInOrders = async (pool, teaId) => {
  const result = await pool
    .request()
    .input("tea_id", sql.Int, teaId)
    .query(
      `SELECT COUNT(*) AS count FROM dbo.order_items WHERE tea_id = @tea_id`,
    );
  return result.recordset[0].count > 0;
};

/**
 * Helper function to process brewing rituals
 */
const processBrewingRituals = (data, files) => {
  const brewingIconFiles = files.brewingIcons || [];
  console.log("🔧 Brewing icon files received:", brewingIconFiles.length);

  const rituals = (data.rituals || []).map((r, i) => {
    const iconUrl =
      r.hasIcon && r.iconIndex >= 0 && brewingIconFiles[r.iconIndex]
        ? path
            .join("uploads", "images", brewingIconFiles[r.iconIndex].filename)
            .replace(/\\/g, "/")
        : r.existingIconUrl || null;

    return {
      step_text: r.text || null,
      icon_url: iconUrl,
      step_order: i + 1,
    };
  });

  console.log("☕ Total brewing rituals:", rituals.length);
  return rituals;
};

/**
 * Helper function to insert brewing rituals
 */
const insertBrewingRituals = async (pool, teaId, rituals) => {
  console.log("💾 Inserting brewing rituals...");

  if (rituals.length === 0) {
    console.log("⚠️ No brewing rituals to insert");
    return;
  }

  for (let i = 0; i < rituals.length; i++) {
    const ritual = rituals[i];
    await pool
      .request()
      .input("tea_id", sql.Int, teaId)
      .input("step_text", sql.NVarChar(255), ritual.step_text)
      .input("icon_url", sql.NVarChar(500), ritual.icon_url)
      .input("step_order", sql.Int, ritual.step_order).query(`
        INSERT INTO dbo.tea_brewing_rituals (tea_id, step_text, icon_url, step_order)
        VALUES (@tea_id, @step_text, @icon_url, @step_order)
      `);
  }

  console.log(`✅ Successfully inserted ${rituals.length} brewing rituals`);
};

/**
 * Helper function to link ingredients to tea
 */
const linkIngredientsToTea = async (pool, teaId, ingredientIds) => {
  console.log("🌿 Linking ingredients to tea...");

  if (!ingredientIds || ingredientIds.length === 0) {
    console.log("⚠️ No ingredients to link");
    return;
  }

  for (let i = 0; i < ingredientIds.length; i++) {
    await pool
      .request()
      .input("tea_id", sql.Int, teaId)
      .input("ingredient_id", sql.Int, ingredientIds[i])
      .input("display_order", sql.Int, i + 1).query(`
        INSERT INTO dbo.tea_ingredients (tea_id, ingredient_id, display_order)
        VALUES (@tea_id, @ingredient_id, @display_order)
      `);
  }

  console.log(`✅ Successfully linked ${ingredientIds.length} ingredients`);
};

/**
 * Helper function to get tea ingredients
 */
const getTeaIngredients = async (pool, teaId) => {
  const result = await pool.request().input("tea_id", sql.Int, teaId).query(`
      SELECT i.id, i.name, i.description, i.image_url, ti.display_order
      FROM dbo.ingredients i
      INNER JOIN dbo.tea_ingredients ti ON i.id = ti.ingredient_id
      WHERE ti.tea_id = @tea_id
      ORDER BY ti.display_order ASC
    `);
  return result.recordset;
};

/**
 * @desc Get all teas
 * @route GET /api/tea
 */
exports.getAllTeas = async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT id, name, slug, tag, tagline, description, is_active, created_at
      FROM dbo.teas
      ORDER BY created_at DESC
    `);

    res.status(200).json({
      success: true,
      teas: result.recordset,
    });
  } catch (err) {
    console.error("❌ Failed to fetch teas:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Get packages of a tea (admin)
 * @route GET /api/tea/:teaId/packages
 */
exports.getTeaPackages = async (req, res) => {
  try {
    const { teaId } = req.params;
    const pool = await getPool();

    const result = await pool
      .request()
      .input("tea_id", sql.Int, teaId)
      .query(`
        SELECT id, package_name, selling_price
        FROM dbo.tea_packages
        WHERE tea_id = @tea_id
        ORDER BY selling_price ASC
      `);

    res.status(200).json({
      success: true,
      packages: result.recordset,
    });
  } catch (err) {
    console.error("❌ Get tea packages error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tea packages",
    });
  }
};


/**
 * @desc Get single tea with all details (ingredients, icons, etc.)
 * @route GET /api/tea/:id or /api/tea/slug/:slug
 */
exports.getTeaById = async (req, res) => {
  try {
    const identifier = req.params.id || req.params.slug;
    const isSlug = isNaN(identifier);
    const pool = await getPool();

    // Get main tea data
    const teaQuery = isSlug
      ? `SELECT * FROM dbo.teas WHERE slug = @identifier`
      : `SELECT * FROM dbo.teas WHERE id = @identifier`;

    const teaResult = await pool
      .request()
      .input("identifier", isSlug ? sql.NVarChar(255) : sql.Int, identifier)
      .query(teaQuery);

    if (teaResult.recordset.length === 0) {
      return res.status(404).json({ error: "Tea not found" });
    }

    const tea = teaResult.recordset[0];
    const teaId = tea.id;

    // Get all related data in parallel (including ingredients and global icons)
    const [
      packagesResult,
      sectionsResult,
      ritualsResult,
      imagesResult,
      iconsResult,
      ingredients,
    ] = await Promise.all([
      pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(`SELECT * FROM dbo.tea_packages WHERE tea_id = @tea_id`),
      pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(`SELECT * FROM dbo.tea_sections WHERE tea_id = @tea_id`),
      pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(
          `SELECT * FROM dbo.tea_brewing_rituals WHERE tea_id = @tea_id ORDER BY step_order`,
        ),
      pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(`SELECT * FROM dbo.tea_images WHERE tea_id = @tea_id`),
      pool
        .request()
        .query(
          `SELECT icon_type, icon_url FROM dbo.tea_icons WHERE tea_id IS NULL`,
        ),
      getTeaIngredients(pool, teaId),
    ]);

    res.status(200).json({
      success: true,
      tea: {
        ...tea,
        packages: packagesResult.recordset,
        sections: sectionsResult.recordset,
        rituals: ritualsResult.recordset,
        images: imagesResult.recordset,
        icons: iconsResult.recordset,
        ingredients: ingredients,
      },
    });
  } catch (err) {
    console.error("❌ Failed to fetch tea:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Get global icons (tea_id IS NULL)
 * @route GET /api/tea/global-icons
 */
exports.getGlobalIcons = async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT icon_type, icon_url 
      FROM dbo.tea_icons 
      WHERE tea_id IS NULL
    `);

    res.status(200).json({
      success: true,
      icons: result.recordset,
    });
  } catch (err) {
    console.error("❌ Failed to fetch global icons:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Update global icons (admin only)
 * @route PUT /api/tea/global-icons
 */
exports.updateGlobalIcons = async (req, res) => {
  try {
    const files = req.files || {};
    const pool = await getPool();

    // Delete existing global icons
    await pool
      .request()
      .query(`DELETE FROM dbo.tea_icons WHERE tea_id IS NULL`);

    // Insert new global icons
    const iconFiles = files.icons || [];
    const icons = [
      { icon_type: "Vegan", file: iconFiles[0] },
      { icon_type: "Cruelty Free", file: iconFiles[1] },
      { icon_type: "Eco Friendly", file: iconFiles[2] },
    ];

    for (const icon of icons) {
      if (icon.file) {
        const iconUrl = path
          .join("uploads", "images", icon.file.filename)
          .replace(/\\/g, "/");

        await pool
          .request()
          .input("tea_id", sql.Int, null)
          .input("icon_type", sql.NVarChar(100), icon.icon_type)
          .input("icon_url", sql.NVarChar(500), iconUrl).query(`
            INSERT INTO dbo.tea_icons (tea_id, icon_type, icon_url)
            VALUES (@tea_id, @icon_type, @icon_url)
          `);
      }
    }

    res.status(200).json({
      success: true,
      message: "✅ Global icons updated successfully",
    });
  } catch (err) {
    console.error("❌ Failed to update global icons:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Create new tea
 * @route POST /api/tea
 */
exports.createTea = async (req, res) => {
  try {
    const data = JSON.parse(req.body.data || "{}");
    const files = req.files || {};

    const safe = (v) => (v !== undefined && v !== null && v !== "" ? v : null);

    // === 1️⃣ Tea Images ===
    const teaImages = (files.teaImages || []).map((f, index) => ({
      url: path.join("uploads", "images", f.filename).replace(/\\/g, "/"),
      isMain: index === (data.mainImageIndex || 0),
    }));

    // === 2️⃣ Brewing Rituals ===
    const rituals = processBrewingRituals(data, files);

    // === 3️⃣ Sections, Packages & Ingredients ===
    const sections = (data.sections || []).filter((s) => s.title || s.content);
    const packages = data.packages || [];
    const ingredientIds = data.ingredientIds || [];

    // === Connect to DB ===
    const pool = await getPool();

    // === 4️⃣ Insert main Tea record ===
    const teaResult = await pool
      .request()
      .input("name", sql.NVarChar(255), safe(data.name))
      .input("slug", sql.NVarChar(255), safe(data.slug))
      .input("tag", sql.NVarChar(100), safe(data.tag))
      .input("tagline", sql.NVarChar(255), safe(data.tagline))
      .input("description", sql.NVarChar(sql.MAX), safe(data.description))
      .input("is_active", sql.Bit, data.is_active ? 1 : 0).query(`
        INSERT INTO dbo.teas (name, slug, tag, tagline, description, is_active)
        OUTPUT INSERTED.id AS tea_id
        VALUES (@name, @slug, @tag, @tagline, @description, @is_active)
      `);

    const teaId = teaResult.recordset[0].tea_id;
    console.log("✅ Tea created with ID:", teaId);

    // === 5️⃣ Insert Tea Images ===
    for (const img of teaImages) {
      await pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .input("image_url", sql.NVarChar(500), img.url)
        .input("is_main_image", sql.Bit, img.isMain ? 1 : 0).query(`
          INSERT INTO dbo.tea_images (tea_id, image_url, is_main_image)
          VALUES (@tea_id, @image_url, @is_main_image)
        `);
    }

    // === 6️⃣ Insert Packages ===
    for (const pkg of packages) {
      await pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .input("package_name", sql.NVarChar(50), safe(pkg.package_name))
        .input(
          "selling_price",
          sql.Decimal(10, 2),
          pkg.selling_price ? parseFloat(pkg.selling_price) : 0,
        ).query(`
          INSERT INTO dbo.tea_packages (tea_id, package_name, selling_price)
          VALUES (@tea_id, @package_name, @selling_price)
        `);
    }

    // === 7️⃣ Insert Sections ===
    for (const sec of sections) {
      await pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .input("title", sql.NVarChar(100), safe(sec.title))
        .input("content", sql.NVarChar(sql.MAX), safe(sec.content)).query(`
          INSERT INTO dbo.tea_sections (tea_id, title, content)
          VALUES (@tea_id, @title, @content)
        `);
    }

    // === 8️⃣ Link Ingredients ===
    await linkIngredientsToTea(pool, teaId, ingredientIds);

    // === 9️⃣ Insert Brewing Rituals ===
    await insertBrewingRituals(pool, teaId, rituals);

    res.status(201).json({
      success: true,
      message: "✅ Tea created successfully",
      teaId,
      slug: data.slug,
    });
  } catch (err) {
    console.error("❌ Failed to create tea:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Update tea (with order protection)
 * @route PUT /api/tea/:id
 */
exports.updateTea = async (req, res) => {
  try {
    const teaId = parseInt(req.params.id);
    const data = JSON.parse(req.body.data || "{}");
    const files = req.files || {};
    const safe = (v) => (v !== undefined && v !== null && v !== "" ? v : null);

    const pool = await getPool();

    // Check if tea exists
    const checkTea = await pool
      .request()
      .input("tea_id", sql.Int, teaId)
      .query(`SELECT id FROM dbo.teas WHERE id = @tea_id`);

    if (checkTea.recordset.length === 0) {
      return res.status(404).json({ error: "Tea not found" });
    }

    // Update main tea record
    await pool
      .request()
      .input("tea_id", sql.Int, teaId)
      .input("name", sql.NVarChar(255), safe(data.name))
      .input("slug", sql.NVarChar(255), safe(data.slug))
      .input("tag", sql.NVarChar(100), safe(data.tag))
      .input("tagline", sql.NVarChar(255), safe(data.tagline))
      .input("description", sql.NVarChar(sql.MAX), safe(data.description))
      .input("is_active", sql.Bit, data.is_active ? 1 : 0).query(`
        UPDATE dbo.teas 
        SET name = @name, slug = @slug, tag = @tag, tagline = @tagline, 
            description = @description, is_active = @is_active,
            updated_at = SYSUTCDATETIME()
        WHERE id = @tea_id
      `);

    // === SAFE DELETE: Only delete what's NOT in orders ===

    // 1. Get existing packages
    // 🔒 UPDATE PACKAGES ONLY IF FRONTEND SENT THEM
    const newPackages = Array.isArray(data.packages) ? data.packages : null;

    if (newPackages) {
      // 1️⃣ Get existing packages
      const existingPackagesResult = await pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(
          `SELECT id, package_name, selling_price 
       FROM dbo.tea_packages 
       WHERE tea_id = @tea_id`,
        );

      const existingPackages = existingPackagesResult.recordset;

      // 2️⃣ Delete only packages that user REMOVED (and not in orders)
      for (const pkg of existingPackages) {
        const stillExists = newPackages.some(
          (p) => p.package_name === pkg.package_name,
        );

        if (!stillExists) {
          const inOrders = await isPackageInOrders(pool, pkg.id);
          if (!inOrders) {
            await pool
              .request()
              .input("package_id", sql.Int, pkg.id)
              .query(`DELETE FROM dbo.tea_packages WHERE id = @package_id`);
          }
        }
      }

      // 3️⃣ Update or insert packages
      for (const pkg of newPackages) {
        const existingPkg = existingPackages.find(
          (p) => p.package_name === pkg.package_name,
        );

        if (existingPkg) {
          // Update price ONLY if provided
          const finalPrice =
            pkg.selling_price !== null && pkg.selling_price !== undefined
              ? parseFloat(pkg.selling_price)
              : existingPkg.selling_price;

          await pool
            .request()
            .input("package_id", sql.Int, existingPkg.id)
            .input("selling_price", sql.Decimal(10, 2), finalPrice).query(`
          UPDATE dbo.tea_packages
          SET selling_price = @selling_price,
              updated_at = SYSUTCDATETIME()
          WHERE id = @package_id
        `);
        } else {
          // Insert new package
          await pool
            .request()
            .input("tea_id", sql.Int, teaId)
            .input("package_name", sql.NVarChar(50), safe(pkg.package_name))
            .input(
              "selling_price",
              sql.Decimal(10, 2),
              pkg.selling_price ? parseFloat(pkg.selling_price) : 0,
            ).query(`
          INSERT INTO dbo.tea_packages (tea_id, package_name, selling_price)
          VALUES (@tea_id, @package_name, @selling_price)
        `);
        }
      }
    }

    // === SAFE DELETE: Delete sections, rituals, ingredients (these don't affect orders) ===
    await Promise.all([
      pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(`DELETE FROM dbo.tea_sections WHERE tea_id = @tea_id`),
      pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(`DELETE FROM dbo.tea_brewing_rituals WHERE tea_id = @tea_id`),
      pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(`DELETE FROM dbo.tea_ingredients WHERE tea_id = @tea_id`),
    ]);

    // Delete images only if new ones are uploaded
    if (files.teaImages && files.teaImages.length > 0) {
      await pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .query(`DELETE FROM dbo.tea_images WHERE tea_id = @tea_id`);

      const teaImages = files.teaImages.map((f, index) => ({
        url: path.join("uploads", "images", f.filename).replace(/\\/g, "/"),
        isMain: index === (data.mainImageIndex || 0),
      }));

      for (const img of teaImages) {
        await pool
          .request()
          .input("tea_id", sql.Int, teaId)
          .input("image_url", sql.NVarChar(500), img.url)
          .input("is_main_image", sql.Bit, img.isMain ? 1 : 0).query(`
            INSERT INTO dbo.tea_images (tea_id, image_url, is_main_image)
            VALUES (@tea_id, @image_url, @is_main_image)
          `);
      }
    }

    // Insert sections
    const sections = (data.sections || []).filter((s) => s.title || s.content);
    for (const sec of sections) {
      await pool
        .request()
        .input("tea_id", sql.Int, teaId)
        .input("title", sql.NVarChar(100), safe(sec.title))
        .input("content", sql.NVarChar(sql.MAX), safe(sec.content)).query(`
          INSERT INTO dbo.tea_sections (tea_id, title, content)
          VALUES (@tea_id, @title, @content)
        `);
    }

    // Link ingredients
    const ingredientIds = data.ingredientIds || [];
    await linkIngredientsToTea(pool, teaId, ingredientIds);

    // Insert brewing rituals
    const rituals = processBrewingRituals(data, files);
    await insertBrewingRituals(pool, teaId, rituals);

    res.status(200).json({
      success: true,
      message: "✅ Tea updated successfully",
      teaId,
    });
  } catch (err) {
    console.error("❌ Failed to update tea:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Delete tea (with order protection)
 * @route DELETE /api/tea/:id
 */
exports.deleteTea = async (req, res) => {
  try {
    const teaId = parseInt(req.params.id);
    const pool = await getPool();

    const checkTea = await pool
      .request()
      .input("tea_id", sql.Int, teaId)
      .query(`SELECT id FROM dbo.teas WHERE id = @tea_id`);

    if (checkTea.recordset.length === 0) {
      return res.status(404).json({ error: "Tea not found" });
    }

    // Check if tea is used in any orders
    const teaInOrders = await isTeaInOrders(pool, teaId);

    if (teaInOrders) {
      return res.status(400).json({
        error:
          "Cannot delete this tea because it has been ordered by customers. You can deactivate it instead.",
        suggestion:
          "Use the toggle to set this tea as inactive instead of deleting it.",
      });
    }

    // Safe to delete - no orders reference this tea
    await pool
      .request()
      .input("tea_id", sql.Int, teaId)
      .query(`DELETE FROM dbo.teas WHERE id = @tea_id`);

    res.status(200).json({
      success: true,
      message: "✅ Tea deleted successfully",
    });
  } catch (err) {
    console.error("❌ Failed to delete tea:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc Toggle tea active status
 * @route PATCH /api/tea/:id/toggle
 */
exports.toggleTeaStatus = async (req, res) => {
  try {
    const teaId = parseInt(req.params.id);
    const { is_active } = req.body;
    const pool = await getPool();

    await pool
      .request()
      .input("tea_id", sql.Int, teaId)
      .input("is_active", sql.Bit, is_active ? 1 : 0).query(`
        UPDATE dbo.teas 
        SET is_active = @is_active, updated_at = SYSUTCDATETIME()
        WHERE id = @tea_id
      `);

    res.status(200).json({
      success: true,
      message: "✅ Tea status updated successfully",
    });
  } catch (err) {
    console.error("❌ Failed to toggle tea status:", err);
    res.status(500).json({ error: err.message });
  }
};
