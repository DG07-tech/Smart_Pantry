const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const inventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  expiryDate: { type: Date, required: true },
  quantity: { type: Number, required: true },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
});

module.exports = mongoose.model("Inventory", inventorySchema);
