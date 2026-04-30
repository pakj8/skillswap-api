const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
    },

    type: {
      type: String,
      enum: [
        "earn",
        "spend",
        "escrow_lock",
        "escrow_release",
        "refund",
        "penalty",
        "bonus",
        "signup_bonus",
      ],
      required: true,
    },

    amount: { type: Number, required: true }, // positive = gain, negative = loss
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CreditTransaction ||
  mongoose.model("CreditTransaction", creditTransactionSchema);
