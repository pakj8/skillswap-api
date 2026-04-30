const mongoose = require("mongoose");
const Session = require("../models/session");
const {
  releaseToTeacher,
  refundLearner,
  penalizeTeacher,
} = require("./services");

async function resolveExpiredSessions() {
  const now = new Date();

  // 1. Move confirmed sessions that have passed their time → awaiting_confirmation
  const readyToConfirm = await Session.find({
    status: "confirmed",
    creditsLocked: true,
  });

  for (const session of readyToConfirm) {
    const sessionEnd = new Date(session.scheduledAt);
    sessionEnd.setHours(sessionEnd.getHours() + session.durationHours);
    if (now >= sessionEnd) {
      session.status = "awaiting_confirmation";
      await session.save();
      console.log(`[Cron] Session ${session._id} → awaiting_confirmation`);
    }
  }

  // 2. Resolve sessions past their confirmation deadline
  const expired = await Session.find({
    status: "awaiting_confirmation",
    confirmationDeadline: { $lte: now },
    creditsTransferred: false,
    creditsLocked: true,
  });

  console.log(`[Cron] Resolving ${expired.length} expired sessions`);

  for (const session of expired) {
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      if (session.teacherConfirmed && !session.learnerConfirmed) {
        // Learner no-show → teacher earns
        await releaseToTeacher(
          session.teacher,
          session._id,
          session.creditsAtStake,
          dbSession
        );
        session.status = "learner_noshow";
        session.creditsTransferred = true;
      } else if (!session.teacherConfirmed && session.learnerConfirmed) {
        // Teacher no-show → refund learner + penalize teacher
        await refundLearner(
          session.learner,
          session._id,
          session.creditsAtStake,
          dbSession
        );
        await penalizeTeacher(session.teacher, session._id, dbSession);
        session.status = "teacher_noshow";
      } else {
        // Neither confirmed → void, refund learner
        await refundLearner(
          session.learner,
          session._id,
          session.creditsAtStake,
          dbSession
        );
        session.status = "voided";
      }

      await session.save({ session: dbSession });
      await dbSession.commitTransaction();
      console.log(`[Cron] Session ${session._id} → ${session.status}`);
    } catch (err) {
      await dbSession.abortTransaction();
      console.error(`[Cron] Failed to resolve ${session._id}:`, err.message);
    } finally {
      dbSession.endSession();
    }
  }
}

module.exports = { resolveExpiredSessions };
