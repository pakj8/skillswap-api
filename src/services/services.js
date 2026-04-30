const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const CreditTransaction = require("../models/CreditTransaction");

// ─── Auth helpers ─────────────────────────────────────────

function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

// ─── Credit operations ────────────────────────────────────
// All credit mutations use mongoose sessions for atomicity

async function lockCredits(learnerId, sessionId, amount, dbSession) {
  const learner = await User.findById(learnerId).session(dbSession);
  if (!learner) throw new Error("Learner not found");
  if (learner.credits < amount)
    throw new Error(
      `Not enough credits. You have ${learner.credits} but need ${amount}.`
    );

  const before = learner.credits;
  learner.credits -= amount;
  await learner.save({ session: dbSession });

  await CreditTransaction.create(
    [
      {
        user: learnerId,
        session: sessionId,
        type: "escrow_lock",
        amount: -amount,
        balanceBefore: before,
        balanceAfter: learner.credits,
        description: "Credits locked for session",
      },
    ],
    { session: dbSession }
  );
}

async function releaseToTeacher(teacherId, sessionId, amount, dbSession) {
  const teacher = await User.findById(teacherId).session(dbSession);
  if (!teacher) throw new Error("Teacher not found");

  teacher.resetWeeklyCap();
  if (!teacher.canEarnCredits(amount)) {
    const remaining = Math.max(0, 5 - teacher.weeklyCreditsEarned);
    amount = remaining;
  }
  if (amount === 0) return { creditsEarned: 0 };

  const before = teacher.credits;
  teacher.credits += amount;
  teacher.weeklyCreditsEarned += amount;
  teacher.totalSessionsTaught += 1;
  await teacher.save({ session: dbSession });

  await CreditTransaction.create(
    [
      {
        user: teacherId,
        session: sessionId,
        type: "earn",
        amount,
        balanceBefore: before,
        balanceAfter: teacher.credits,
        description: `Earned for teaching session`,
      },
    ],
    { session: dbSession }
  );

  return { creditsEarned: amount };
}

async function refundLearner(learnerId, sessionId, amount, dbSession) {
  const learner = await User.findById(learnerId).session(dbSession);
  if (!learner) throw new Error("Learner not found");

  const before = learner.credits;
  learner.credits += amount;
  await learner.save({ session: dbSession });

  await CreditTransaction.create(
    [
      {
        user: learnerId,
        session: sessionId,
        type: "refund",
        amount,
        balanceBefore: before,
        balanceAfter: learner.credits,
        description: "Refund: session not confirmed by teacher",
      },
    ],
    { session: dbSession }
  );
}

async function penalizeTeacher(teacherId, sessionId, dbSession) {
  const teacher = await User.findById(teacherId).session(dbSession);
  if (!teacher || teacher.credits < 1) return;

  const PENALTY = 1;
  const before = teacher.credits;
  teacher.credits -= PENALTY;
  teacher.flagCount += 1;
  if (teacher.flagCount >= 3) teacher.isSuspended = true;
  await teacher.save({ session: dbSession });

  await CreditTransaction.create(
    [
      {
        user: teacherId,
        session: sessionId,
        type: "penalty",
        amount: -PENALTY,
        balanceBefore: before,
        balanceAfter: teacher.credits,
        description: "Penalty: no-show for booked session",
      },
    ],
    { session: dbSession }
  );
}

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  lockCredits,
  releaseToTeacher,
  refundLearner,
  penalizeTeacher,
};
