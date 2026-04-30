const mongoose = require("mongoose");
const User = require("../../models/User");
const Session = require("../../models/Session");
const CreditTransaction = require("../../models/CreditTransaction");
const {
  lockCredits,
  releaseToTeacher,
  refundLearner,
  penalizeTeacher,
} = require("../../services/services");

// ─── bookSession ──────────────────────────────────────────
async function bookSession(
  userId,
  { teacherId, skill, category, durationHours, scheduledAt, location, meetLink }
) {
  if (teacherId === userId)
    throw new Error("You cannot book a session with yourself");

  const creditsNeeded = Math.ceil(durationHours);
  const learner = await User.findById(userId);
  if (!learner) throw new Error("User not found");
  if (learner.credits < creditsNeeded) {
    throw new Error(
      `You need ${creditsNeeded} credit(s) but only have ${learner.credits}. Teach a session first to earn credits.`
    );
  }

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const [session] = await Session.create(
      [
        {
          teacher: teacherId,
          learner: userId,
          skill,
          category,
          durationHours,
          creditsAtStake: creditsNeeded,
          scheduledAt: new Date(scheduledAt),
          location: location || "",
          meetLink: meetLink || "",
          status: "pending",
        },
      ],
      { session: dbSession }
    );

    await lockCredits(userId, session._id, creditsNeeded, dbSession);

    session.creditsLocked = true;
    await session.save({ session: dbSession });

    await dbSession.commitTransaction();

    const populated = await Session.findById(session._id).populate(
      "teacher learner"
    );
    return {
      success: true,
      message: `Session booked! ${creditsNeeded} credit(s) locked until both confirm.`,
      creditsLocked: creditsNeeded,
      session: populated,
    };
  } catch (err) {
    await dbSession.abortTransaction();
    throw err;
  } finally {
    dbSession.endSession();
  }
}

// ─── acceptSession ────────────────────────────────────────
async function acceptSession(userId, sessionId) {
  const session = await Session.findById(sessionId).populate("teacher learner");
  if (!session) throw new Error("Session not found");
  if (session.teacher._id.toString() !== userId)
    throw new Error("Only the teacher can accept this session");
  if (session.status !== "pending")
    throw new Error(`Session is already ${session.status}`);

  session.status = "confirmed";
  await session.save();
  return session;
}

// ─── confirmSession ───────────────────────────────────────
async function confirmSession(
  userId,
  { sessionId, topicsCovered, rating, review }
) {
  const session = await Session.findById(sessionId).populate("teacher learner");
  if (!session) throw new Error("Session not found");

  const isTeacher = session.teacher._id.toString() === userId;
  const isLearner = session.learner._id.toString() === userId;
  if (!isTeacher && !isLearner)
    throw new Error("You are not part of this session");

  if (!["confirmed", "awaiting_confirmation"].includes(session.status)) {
    throw new Error(`Cannot confirm a session with status: ${session.status}`);
  }

  if (new Date() > session.confirmationDeadline) {
    throw new Error(
      "Confirmation deadline has passed. The session was auto-resolved."
    );
  }

  // Record confirmation
  if (isTeacher && !session.teacherConfirmed) {
    session.teacherConfirmed = true;
    session.teacherConfirmedAt = new Date();
    if (rating) session.teacherRating = rating;
  } else if (isLearner && !session.learnerConfirmed) {
    session.learnerConfirmed = true;
    session.learnerConfirmedAt = new Date();
    if (rating) session.learnerRating = rating;
    if (review) session.learnerReview = review;
    if (topicsCovered?.length) session.topicsCovered = topicsCovered;
  }

  session.status = "awaiting_confirmation";
  await session.save();

  // Both confirmed → transfer credits
  if (session.teacherConfirmed && session.learnerConfirmed) {
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      const { creditsEarned } = await releaseToTeacher(
        session.teacher._id,
        session._id,
        session.creditsAtStake,
        dbSession
      );

      // Update learner stats
      await User.findByIdAndUpdate(
        session.learner._id,
        { $inc: { totalSessionsLearned: 1 } },
        { session: dbSession }
      );

      // Update teacher rating if learner rated
      if (session.learnerRating) {
        const teacher = await User.findById(session.teacher._id).session(
          dbSession
        );
        const newTotal = teacher.totalRatings + 1;
        const newRating =
          (teacher.rating * teacher.totalRatings + session.learnerRating) /
          newTotal;
        teacher.rating = Math.round(newRating * 10) / 10;
        teacher.totalRatings = newTotal;
        await teacher.save({ session: dbSession });
      }

      session.status = "completed";
      session.creditsTransferred = true;
      await session.save({ session: dbSession });
      await dbSession.commitTransaction();

      return {
        success: true,
        message: `Session complete! Teacher earned ${creditsEarned} credit(s).`,
        creditsEarned,
        session,
      };
    } catch (err) {
      await dbSession.abortTransaction();
      throw err;
    } finally {
      dbSession.endSession();
    }
  }

  const waiting = isTeacher ? "the learner" : "the teacher";
  return {
    success: true,
    message: `Confirmed! Waiting for ${waiting} to confirm.`,
    creditsEarned: null,
    session,
  };
}

// ─── cancelSession ────────────────────────────────────────
async function cancelSession(userId, sessionId) {
  const session = await Session.findById(sessionId).populate("teacher learner");
  if (!session) throw new Error("Session not found");

  const isTeacher = session.teacher._id.toString() === userId;
  const isLearner = session.learner._id.toString() === userId;
  if (!isTeacher && !isLearner)
    throw new Error("You are not part of this session");

  if (["completed", "cancelled", "voided"].includes(session.status)) {
    throw new Error(`Cannot cancel a ${session.status} session`);
  }

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    // Refund learner if credits were locked
    if (session.creditsLocked && !session.creditsTransferred) {
      await refundLearner(
        session.learner._id,
        session._id,
        session.creditsAtStake,
        dbSession
      );
    }

    // Penalize teacher if they cancel a confirmed session within 24hrs of start
    const hoursUntil = (new Date(session.scheduledAt) - new Date()) / 3600000;
    if (isTeacher && session.status === "confirmed" && hoursUntil < 24) {
      await penalizeTeacher(session.teacher._id, session._id, dbSession);
    }

    session.status = "cancelled";
    await session.save({ session: dbSession });
    await dbSession.commitTransaction();

    return session;
  } catch (err) {
    await dbSession.abortTransaction();
    throw err;
  } finally {
    dbSession.endSession();
  }
}

// ─── mySessions ───────────────────────────────────────────
async function mySessions(userId, { role, status } = {}) {
  const query = {};

  if (role === "teacher") query.teacher = userId;
  else if (role === "learner") query.learner = userId;
  else query.$or = [{ teacher: userId }, { learner: userId }];

  if (status) query.status = status;

  return Session.find(query)
    .populate("teacher learner")
    .sort({ scheduledAt: -1 });
}

// ─── pendingConfirmations ─────────────────────────────────
async function pendingConfirmations(userId) {
  const now = new Date();
  return Session.find({
    $or: [
      { teacher: userId, teacherConfirmed: false },
      { learner: userId, learnerConfirmed: false },
    ],
    status: "awaiting_confirmation",
    confirmationDeadline: { $gt: now },
    creditsTransferred: false,
  }).populate("teacher learner");
}

// ─── myCreditHistory ──────────────────────────────────────
async function myCreditHistory(userId) {
  return CreditTransaction.find({ user: userId })
    .populate({ path: "session", populate: { path: "teacher learner" } })
    .sort({ createdAt: -1 })
    .limit(50);
}

// ─── getSession ───────────────────────────────────────────
async function getSession(sessionId) {
  const session = await Session.findById(sessionId).populate("teacher learner");
  if (!session) throw new Error("Session not found");
  return session;
}

module.exports = {
  bookSession,
  acceptSession,
  confirmSession,
  cancelSession,
  mySessions,
  pendingConfirmations,
  myCreditHistory,
  getSession,
};
