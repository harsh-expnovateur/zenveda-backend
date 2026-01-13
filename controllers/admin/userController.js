// controllers/admin/userController.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const logger = require("../../config/logger");
const { sendEmail } = require("../../utils/mailer");
const { newUserPasswordTemplate } = require("../../utils/emailTemplates");

const {
  getAllUsers,
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  toggleUserActiveStatus,
  deleteUser,
  getAllPermissions,
  setUserPermissions,
  getUserPermissions,
  getUserWithPermissions
} = require("../../models/admin/userModel");

const saltRounds = parseInt(process.env.PASSWORD_SALT_ROUNDS || "12");

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
  admin: 4,
  "sub-admin": 3,
  manager: 2,
  support: 1
};

// Check if user can modify target user
const canModifyUser = (currentUserRole, targetUserRole) => {
  const currentLevel = ROLE_HIERARCHY[currentUserRole.toLowerCase()] || 0;
  const targetLevel = ROLE_HIERARCHY[targetUserRole.toLowerCase()] || 0;

  // Admin can modify anyone (including admin)
  if (currentUserRole.toLowerCase() === "admin") {
    return true;
  }

  // Others can only modify lower roles
  return currentLevel > targetLevel; // if admin ca not create another admin comment the above if block and use this line
};

// Generate random password
const generatePassword = () => {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// GET all users with their permissions
const getUsers = async (req, res) => {
  try {
    const users = await getAllUsers();
    
    // Fetch permissions for each user
    const usersWithPermissions = await Promise.all(
      users.map(async (user) => {
        const permissions = await getUserPermissions(user.id);
        return {
          ...user,
          permissions: permissions.map(p => p.key),
          permissionLabels: permissions.map(p => p.label)
        };
      })
    );

    res.json({ users: usersWithPermissions });
  } catch (err) {
    logger.error("getUsers error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

// GET all permissions
const getPermissions = async (req, res) => {
  try {
    const permissions = await getAllPermissions();
    res.json({ permissions });
  } catch (err) {
    logger.error("getPermissions error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

// CREATE new user
const addUser = async (req, res) => {
  try {
    const { name, email, role, isActive, permissions } = req.body;
    const currentUser = req.user;

    // Validation
    if (!name || !email || !role) {
      return res.status(400).json({ error: "Name, email, and role are required" });
    }

    // Check if user already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Check if current user has permission to create this role
    if (!canModifyUser(currentUser.role, role)) {
      return res.status(403).json({ 
        error: `You cannot create users with role: ${role}` 
      });
    }

    // Generate random password
    const generatedPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, saltRounds);

    // Create user
    const newUser = await createUser({
      email,
      passwordHash: hashedPassword,
      name,
      role,
      isActive: isActive !== undefined ? isActive : true
    });

    // Set permissions (skip for admin role - they have full access)
    if (role.toLowerCase() !== "admin" && permissions && permissions.length > 0) {
      const allPermissions = await getAllPermissions();
      const permissionIds = allPermissions
        .filter(p => permissions.includes(p.key))
        .map(p => p.id);
      
      await setUserPermissions(newUser.id, permissionIds);
    }

    // Send password via email
    try {
      await sendEmail({
        to: email,
        subject: "Your Account Credentials - Zenveda Admin",
        html: newUserPasswordTemplate({
          name,
          email,
          password: generatedPassword,
          role
        })
      });
    } catch (emailErr) {
      logger.error("Failed to send password email", { 
        email, 
        error: emailErr.message 
      });
      // Don't fail user creation if email fails
    }

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.is_active
      }
    });
  } catch (err) {
    logger.error("addUser error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

// UPDATE user
const editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, permissions } = req.body;
    const currentUser = req.user;

    // Get target user
    const targetUser = await findUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if current user can modify target user
    if (!canModifyUser(currentUser.role, targetUser.role)) {
      return res.status(403).json({ 
        error: `You cannot edit users with role: ${targetUser.role}` 
      });
    }

    // If changing role, check permission for new role
    if (role && role !== targetUser.role) {
      if (!canModifyUser(currentUser.role, role)) {
        return res.status(403).json({ 
          error: `You cannot assign role: ${role}` 
        });
      }
    }

    // Update user
    const updatedUser = await updateUser({
      id,
      name: name || targetUser.name,
      email: email || targetUser.email,
      role: role || targetUser.role,
      isActive: isActive !== undefined ? isActive : targetUser.is_active
    });

    // Update permissions (skip for admin role)
    if ((role || targetUser.role).toLowerCase() !== "admin") {
      if (permissions !== undefined) {
        if (permissions.length === 0) {
          await setUserPermissions(id, []);
        } else {
          const allPermissions = await getAllPermissions();
          const permissionIds = allPermissions
            .filter(p => permissions.includes(p.key))
            .map(p => p.id);
          
          await setUserPermissions(id, permissionIds);
        }
      }
    }

    res.json({
      message: "User updated successfully",
      user: updatedUser
    });
  } catch (err) {
    logger.error("editUser error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

// TOGGLE user active status
const toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const targetUser = await findUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check permission
    if (!canModifyUser(currentUser.role, targetUser.role)) {
      return res.status(403).json({ 
        error: `You cannot modify users with role: ${targetUser.role}` 
      });
    }

    const updated = await toggleUserActiveStatus(id);
    
    res.json({
      message: "User status updated",
      isActive: updated.is_active
    });
  } catch (err) {
    logger.error("toggleActive error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

// DELETE user
const removeUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const targetUser = await findUserById(id);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check permission
    if (!canModifyUser(currentUser.role, targetUser.role)) {
      return res.status(403).json({ 
        error: `You cannot delete users with role: ${targetUser.role}` 
      });
    }

    await deleteUser(id);
    
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    logger.error("removeUser error", { message: err.message, stack: err.stack });
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getUsers,
  getPermissions,
  addUser,
  editUser,
  toggleActive,
  removeUser
};