const mongoose = require("mongoose");

const skillOfferedSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "Tech",
        "Design",
        "Music",
        "Language",
        "Academic",
        "Fitness",
        "Arts",
        "Business",
        "Other",
      ],
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "expert"],
      default: "intermediate",
    },
    description: { type: String, maxlength: 300, trim: true },
    yearsExp: { type: Number, min: 0, max: 20, default: 1 },
  },
  { _id: false }
);

const skillWantedSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "Tech",
        "Design",
        "Music",
        "Language",
        "Academic",
        "Fitness",
        "Arts",
        "Business",
        "Other",
      ],
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ── Auth ─────────────────────────────────────
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8 },
    universityDomain: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },

    // ── Profile ───────────────────────────────────
    bio: { type: String, maxlength: 200, trim: true, default: "" },
    year: {
      type: String,
      enum: [
        "First_Year",
        "Second_Year",
        "Third_Year",
        "Fourth_Year",
        "Masters",
        "PhD",
        "Other",
      ],
      default: null,
    },
    department: { type: String, trim: true, maxlength: 100, default: "" },
    avatarUrl: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },

    // ── Skills ────────────────────────────────────
    skillsOffered: {
      type: [skillOfferedSchema],
      default: [],
      validate: { validator: (s) => s.length <= 10, message: "Max 10 skills" },
    },
    skillsWanted: {
      type: [skillWantedSchema],
      default: [],
      validate: { validator: (s) => s.length <= 10, message: "Max 10 skills" },
    },

    // ── Credits ───────────────────────────────────
    credits: { type: Number, default: 0, min: 0 },
    weeklyCreditsEarned: { type: Number, default: 0 },
    weeklyCapResetAt: { type: Date, default: () => getNextMonday() },

    // ── Reputation ────────────────────────────────
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    totalSessionsTaught: { type: Number, default: 0 },
    totalSessionsLearned: { type: Number, default: 0 },

    // ── Trust ─────────────────────────────────────
    isSuspended: { type: Boolean, default: false },
    flagCount: { type: Number, default: 0 },

    // ── Activity ──────────────────────────────────
    lastActiveAt: { type: Date, default: Date.now },
    onboardingCompleted: { type: Boolean, default: false },
    onboardingStep: { type: Number, default: 1 },
  },
  { timestamps: true }
);

function getNextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Instance methods ──────────────────────────────
userSchema.methods.resetWeeklyCap = function () {
  if (new Date() > this.weeklyCapResetAt) {
    this.weeklyCreditsEarned = 0;
    this.weeklyCapResetAt = getNextMonday();
  }
};

userSchema.methods.canEarnCredits = function (amount = 1) {
  this.resetWeeklyCap();
  return this.weeklyCreditsEarned + amount <= 5;
};

// ── Indexes ───────────────────────────────────────
userSchema.index({ universityDomain: 1 });
userSchema.index({ "skillsOffered.name": 1 });
userSchema.index({ "skillsWanted.name": 1 });
userSchema.index({ isSuspended: 1, universityDomain: 1 });

// ── Pre-save: auto-extract domain ─────────────────
userSchema.pre("save", function (next) {
  if (this.isModified("email")) {
    this.universityDomain = this.email.split("@")[1];
  }
  this.lastActiveAt = new Date();
  next();
});

module.exports = mongoose.model("User", userSchema);
