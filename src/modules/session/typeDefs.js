const { gql } = require("apollo-server-express");

const sessionTypeDefs = gql`
  # ─── Session type ─────────────────────────────────────────
  type Session {
    id: ID
    teacher: Profile
    learner: Profile
    skill: String
    category: String
    durationHours: Float
    creditsAtStake: Int
    scheduledAt: String
    location: String
    meetLink: String
    status: String
    creditsLocked: Boolean
    creditsTransferred: Boolean
    teacherConfirmed: Boolean
    learnerConfirmed: Boolean
    teacherConfirmedAt: String
    learnerConfirmedAt: String
    confirmationDeadline: String
    topicsCovered: [String]
    teacherRating: Int
    learnerRating: Int
    learnerReview: String
    createdAt: String
    updatedAt: String
  }

  # ─── Session booking result ───────────────────────────────
  type BookingResult {
    success: Boolean
    message: String
    creditsLocked: Int
    session: Session
  }

  # ─── Session confirmation result ──────────────────────────
  type ConfirmResult {
    success: Boolean
    message: String
    creditsEarned: Int
    session: Session
  }

  # ─── Credit transaction ───────────────────────────────────
  type CreditTransaction {
    id: ID
    type: String
    amount: Int
    balanceBefore: Int
    balanceAfter: Int
    description: String
    createdAt: String
    session: Session
  }

  # ─── Extend Query and Mutation ────────────────────────────
  extend type Query {
    mySessions(role: String, status: String): [Session]
    pendingConfirmations: [Session]
    myCreditHistory: [CreditTransaction]
    getSession(sessionId: ID!): Session
  }

  extend type Mutation {
    bookSession(
      teacherId: ID!
      skill: String!
      category: String!
      durationHours: Float!
      scheduledAt: String!
      location: String
      meetLink: String
    ): BookingResult

    acceptSession(sessionId: ID!): Session

    confirmSession(
      sessionId: ID!
      topicsCovered: [String]
      rating: Int
      review: String
    ): ConfirmResult

    cancelSession(sessionId: ID!): Session
  }
`;

module.exports = sessionTypeDefs;
