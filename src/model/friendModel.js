const mongoose = require("mongoose");

const friendSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
friendSchema.pre(/^find/, function (next) {
  this.populate("requester recipient", "firstName lastName profileImage");
  next();
});

module.exports = mongoose.model("Friend", friendSchema);
