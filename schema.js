const Joi = require("joi");

module.exports.inventorySchema = Joi.object({
  inventory: Joi.object({
    itemName: Joi.string().required(),
    expiryDate: Joi.date().required(),
    quantity: Joi.number().required().min(0),
    category: Joi.string()
      .valid(
        "Grains",
        "legumes",
        "Canned Goods",
        "Dairy",
        "Vegetables",
        "Fruits",
        "Beverages",
        "Snacks",
        "Other"
      )
      .required(),
    unit: Joi.string().valid("kg", "g", "liter", "ml", "pieces").required(),
  }).required(),
});

module.exports.userSchema = Joi.object({
  user: Joi.object({
    username: Joi.string()
      .alphanum() // Allows only letters and numbers
      .min(3) // Minimum length of 3 characters
      .max(30) // Maximum length of 30 characters
      .required()
      .messages({
        "string.empty": "Username is required.",
        "string.alphanum": "Username must contain only letters and numbers.",
        "string.min": "Username must be at least 3 characters long.",
        "string.max": "Username must be at most 30 characters long.",
      }),
    email: Joi.string()
      .email({ tlds: { allow: false } }) // Validates email format
      .required()
      .messages({
        "string.empty": "Email is required.",
        "string.email": "Please enter a valid email address.",
      }),
    password: Joi.string()
      .min(8) // Minimum length of 8 characters
      .max(50) // Maximum length of 50 characters
      .pattern(
        new RegExp(
          "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+$"
        )
      )
      .required()
      .messages({
        "string.empty": "Password is required.",
        "string.min": "Password must be at least 8 characters long.",
        "string.max": "Password must be at most 50 characters long.",
        "string.pattern.base":
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
      }),
  }).required(),
});
