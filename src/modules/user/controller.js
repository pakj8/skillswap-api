const User = require("../../models/User");
const Credittransaction = require("../../models/CreditTransaction");
const {
  generateToken,
  hashPassword,
  comparePassword,
} = require("../../services/services");

// ─── createProfile ────────────────────────────────────────
async function createProfile(profileInput) {
  const { name, email, password, skillsOffered, skillsWanted, ...rest } =
    profileInput;

  if (!email || !password || !name)
    throw new Error("Name, email and password are required");

  const domain = email.split("@")[1];
  if (!domain) throw new Error("Invalid email address");

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new Error("An account with this email already exists");

  if (password.length < 8)
    throw new Error("Password must be at least 8 characters");

  const hashed = await hashPassword(password);

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    password: hashed,
    universityDomain: domain,
    bio: rest.bio || "",
    year: rest.year || null,
    department: rest.department || "",
    avatarUrl: rest.avatarUrl || "",
    linkedinUrl: rest.linkedinUrl || "",
    skillsOffered: skillsOffered || [],
    skillsWanted: skillsWanted || [],
    credits: 10, // always start at 0 — ignore client value
    onboardingCompleted: true,
    onboardingStep: 4,
  });

  await Credittransaction.create({
    user: user._id,
    session: null,
    type: "signup_bonus",
    amount: 10,
    balanceBefore: 0,
    balanceAfter: 10,
    description: "Welcome bonus — thanks for joining SkillSwap!",
  });

  return { token: generateToken(user), user };
}

// ─── login ────────────────────────────────────────────────
async function login({ email, password }) {
  if (!email || !password) throw new Error("Email and password are required");

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new Error("No account found with this email");

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new Error("Incorrect password");

  if (user.isSuspended)
    throw new Error("Your account has been suspended. Contact support.");

  return { token: generateToken(user), user };
}

// ─── me ───────────────────────────────────────────────────
async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  return user;
}

// ─── getUser ──────────────────────────────────────────────
async function getUser(id) {
  const user = await User.findById(id).select("-password -verificationToken");
  if (!user) throw new Error("User not found");
  return user;
}

// ─── updateProfile ────────────────────────────────────────
async function updateProfile(userId, profileInput) {
  const { skillsOffered, skillsWanted, password, email, credits, ...rest } =
    profileInput;
  // Never allow updating credits, email, or password through this mutation

  const updates = { ...rest };
  if (skillsOffered !== undefined) updates.skillsOffered = skillsOffered;
  if (skillsWanted !== undefined) updates.skillsWanted = skillsWanted;

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!user) throw new Error("User not found");
  return user;
}

// ─── getMatches ───────────────────────────────────────────
// async function getMatches(userId) {
//   const me = await User.findById(userId);
//   if (!me) throw new Error("User not found");

//   const myWanted = me.skillsWanted.map((s) => s.name.toLowerCase());
//   const myOffered = me.skillsOffered.map((s) => s.name.toLowerCase());

//   if (myWanted.length === 0 && myOffered.length === 0) return [];

//   // Find users from same university who aren't suspended
//   const candidates = await User.find({
//     _id: { $ne: me._id },
//     universityDomain: me.universityDomain,
//     isSuspended: false,
//     $or: [
//       { "skillsOffered.0": { $exists: true } },
//       { "skillsWanted.0": { $exists: true } },
//     ],
//   });

//   const matches = candidates
//     .map((u) => {
//       const theirOffered = u.skillsOffered.map((s) => s.name.toLowerCase());
//       const theirWanted = u.skillsWanted.map((s) => s.name.toLowerCase());

//       // Skills they can teach me
//       const canTeachYou = u.skillsOffered
//         .filter((s) => myWanted.includes(s.name.toLowerCase()))
//         .map((s) => s.name);

//       // Skills I can teach them
//       const youCanTeachThem = me.skillsOffered
//         .filter((s) => theirWanted.includes(s.name.toLowerCase()))
//         .map((s) => s.name);

//       // Score: 2-way match scores higher
//       const matchScore = canTeachYou.length * 2 + youCanTeachThem.length;

//       return { user: u, matchScore, canTeachYou, youCanTeachThem };
//     })
//     .filter((m) => m.matchScore > 0)
//     .sort((a, b) => b.matchScore - a.matchScore);

//   return matches;
// }

async function getMatches(userId) {
  const me = await User.findById(userId);
  if (!me) throw new Error("User not found");

  const myWanted = me.skillsWanted.map((s) => s.name.toLowerCase());
  const myOffered = me.skillsOffered.map((s) => s.name.toLowerCase());

  // Find ALL users from same university except self
  const candidates = await User.find({
    _id: { $ne: me._id },
    universityDomain: me.universityDomain,
    isSuspended: false,
  });

  const matches = candidates
    .map((u) => {
      const theirWanted = u.skillsWanted.map((s) => s.name.toLowerCase());

      // Skills they can teach me
      const canTeachYou = u.skillsOffered
        .filter((s) => myWanted.includes(s.name.toLowerCase()))
        .map((s) => s.name);

      // Skills I can teach them
      const youCanTeachThem = me.skillsOffered
        .filter((s) => theirWanted.includes(s.name.toLowerCase()))
        .map((s) => s.name);

      // Score — 2-way match scores highest
      const matchScore = canTeachYou.length * 2 + youCanTeachThem.length;

      return { user: u, matchScore, canTeachYou, youCanTeachThem };
    })
    // ← removed the .filter(m => m.matchScore > 0) so ALL users show
    .sort((a, b) => b.matchScore - a.matchScore); // best match always on top

  return matches;
}

module.exports = {
  createProfile,
  login,
  getMe,
  getUser,
  updateProfile,
  getMatches,
};
