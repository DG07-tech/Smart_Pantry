const Inventory = require("./models/inventory.js");
const { inventorySchema, userSchema } = require("./schema.js");
const ExpressError = require("./utils/ExpressError.js");
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "you must be logged in to smart pantry!");
    return res.redirect("/login");
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

module.exports.isOwner = async (req, res, next) => {
  let { id } = req.params;
  let inventoryiteam = await Inventory.findById(id);
  if (!inventoryiteam.owner._id.equals(res.locals.currUser._id)) {
    req.flash("error", "You are not the owner of this inventory item!");
    return res.redirect("/dashboard");
  }
  next();
};

module.exports.validateInventory = (req, res, next) => {
  let { error } = inventorySchema.validate(req.body);
  if (error) {
    throw new ExpressError(400, error);
  } else {
    next();
  }
};

module.exports.validateUser = (req, res, next) => {
  let { error } = userSchema.validate(req.body);
  if (error) {
    throw new ExpressError(400, error);
  } else {
    next();
  }
};
