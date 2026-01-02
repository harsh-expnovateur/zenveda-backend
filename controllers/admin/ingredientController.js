const path = require("path");
const {
  getAllIngredients,
  getIngredientById,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} = require("../../models/admin/ingredientModel");

/** 🌿 Get all ingredients */
exports.getIngredients = async (req, res) => {
  try {
    const ingredients = await getAllIngredients();
    res.status(200).json({ success: true, ingredients });
  } catch (err) {
    console.error("❌ Failed to fetch ingredients:", err);
    res.status(500).json({ error: err.message });
  }
};

/** 🌿 Get single ingredient */
exports.getIngredient = async (req, res) => {
  try {
    const ingredient = await getIngredientById(parseInt(req.params.id));
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }
    res.status(200).json({ success: true, ingredient });
  } catch (err) {
    console.error("❌ Failed to fetch ingredient:", err);
    res.status(500).json({ error: err.message });
  }
};

/** 🌿 Create ingredient */
exports.createIngredientHandler = async (req, res) => {
  try {
    const { name, description } = req.body;
    const imageFile = req.file;

    if (!name) {
      return res.status(400).json({ error: "Ingredient name is required" });
    }

    const imageUrl = imageFile
      ? path.join("uploads", "images", imageFile.filename).replace(/\\/g, "/")
      : null;

    const ingredientId = await createIngredient({
      name,
      description,
      image_url: imageUrl,
    });

    res.status(201).json({
      success: true,
      message: "✅ Ingredient created successfully",
      ingredientId,
    });
  } catch (err) {
    console.error("❌ Failed to create ingredient:", err);
    res.status(500).json({ error: err.message });
  }
};

/** 🌿 Update ingredient */
exports.updateIngredientHandler = async (req, res) => {
  try {
    const ingredientId = parseInt(req.params.id);
    const { name, description } = req.body;
    const imageFile = req.file;

    const existing = await getIngredientById(ingredientId);
    if (!existing) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    const imageUrl = imageFile
      ? path.join("uploads", "images", imageFile.filename).replace(/\\/g, "/")
      : existing.image_url;

    await updateIngredient(ingredientId, {
      name: name || existing.name,
      description: description || existing.description,
      image_url: imageUrl,
    });

    res.status(200).json({
      success: true,
      message: "✅ Ingredient updated successfully",
    });
  } catch (err) {
    console.error("❌ Failed to update ingredient:", err);
    res.status(500).json({ error: err.message });
  }
};

/** 🌿 Delete ingredient */
exports.deleteIngredientHandler = async (req, res) => {
  try {
    const ingredientId = parseInt(req.params.id);
    const existing = await getIngredientById(ingredientId);
    
    if (!existing) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    await deleteIngredient(ingredientId);

    res.status(200).json({
      success: true,
      message: "✅ Ingredient deleted successfully",
    });
  } catch (err) {
    console.error("❌ Failed to delete ingredient:", err);
    res.status(500).json({ error: err.message });
  }
};