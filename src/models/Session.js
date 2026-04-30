const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    skill: { type: String, required: true },
    category: { type: String, required: true },
    durationHours: { type: Number, required: true, min: 0.5, max: 3 },
    creditsAtStake: { type: Number, required: true },

    scheduledAt: { type: Date, required: true },
    location: { type: String, default: "" },
    meetLink: { type: String, default: "" },

    status: {
      type: String,
      enum: [
        "pending", // booked, teacher hasn't accepted yet
        "confirmed", // teacher accepted, waiting for session time
        "awaiting_confirmation", // session time passed, waiting for both to confirm
        "completed", // both confirmed, credits transferred
        "teacher_noshow", // teacher didn't confirm
        "learner_noshow", // learner didn't confirm
        "cancelled", // cancelled before session
        "voided", // neither confirmed in 48hrs
      ],
      default: "pending",
    },

    // Escrow
    creditsLocked: { type: Boolean, default: false },
    creditsTransferred: { type: Boolean, default: false },

    // Dual confirmation
    teacherConfirmed: { type: Boolean, default: false },
    learnerConfirmed: { type: Boolean, default: false },
    teacherConfirmedAt: { type: Date },
    learnerConfirmedAt: { type: Date },
    confirmationDeadline: { type: Date },

    // Post-session
    teacherRating: { type: Number, min: 1, max: 5 },
    learnerRating: { type: Number, min: 1, max: 5 },
    learnerReview: { type: String, maxlength: 300 },
    topicsCovered: { type: [String], default: [] },

    // Safety
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String },
  },
  { timestamps: true }
);

// Auto-set confirmation deadline when scheduledAt is set
sessionSchema.pre("save", function (next) {
  if (this.isModified("scheduledAt") || this.isModified("durationHours")) {
    const end = new Date(this.scheduledAt);
    end.setHours(end.getHours() + this.durationHours);
    // 48 hours after session ends
    this.confirmationDeadline = new Date(end.getTime() + 48 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model("Session", sessionSchema);
