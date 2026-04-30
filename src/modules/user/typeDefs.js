const { gql } = require("apollo-server-express");

const userTypeDefs = gql`
  # ─── Enums ───────────────────────────────────────────────
  enum SkillCategory {
    Tech
    Design
    Music
    Language
    Academic
    Fitness
    Arts
    Business
    Other
  }

  # ─── Sub types ───────────────────────────────────────────
  type SkillOffered {
    name: String
    category: SkillCategory
  }

  type SkillWanted {
    name: String
    category: SkillCategory
  }

  # ─── Main user type ──────────────────────────────────────
  type Profile {
    id: ID
    name: String
    email: String
    universityDomain: String
    isVerified: Boolean
    bio: String
    year: String
    department: String
    avatarUrl: String
    linkedinUrl: String
    skillsOffered: [SkillOffered]
    skillsWanted: [SkillWanted]
    credits: Int
    weeklyCreditsEarned: Int
    rating: Float
    totalRatings: Int
    totalSessionsTaught: Int
    totalSessionsLearned: Int
    onboardingCompleted: Boolean
    onboardingStep: Int
    lastActiveAt: String
    createdAt: String
    updatedAt: String
  }

  # ─── Auth payload ─────────────────────────────────────────
  type AuthPayload {
    token: String
    user: Profile
  }

  # ─── Match type ───────────────────────────────────────────
  type Match {
    matchScore: Int
    canTeachYou: [String]
    youCanTeachThem: [String]
    user: Profile
  }

  # ─── Inputs ──────────────────────────────────────────────
  input SkillOfferedInput {
    name: String
    category: SkillCategory
  }

  input SkillWantedInput {
    name: String
    category: SkillCategory
  }

  input profileInput {
    # Auth
    name: String
    email: String
    password: String
    # Profile
    bio: String
    year: String
    department: String
    avatarUrl: String
    linkedinUrl: String
    # Skills
    skillsOffered: [SkillOfferedInput]
    skillsWanted: [SkillWantedInput]
    # System fields (used for testing, auto-set in production)
    universityDomain: String
    isVerified: Boolean
    credits: Int
    weeklyCreditsEarned: Int
    rating: Float
    totalRatings: Int
    totalSessionsTaught: Int
    totalSessionsLearned: Int
    onboardingCompleted: Boolean
    onboardingStep: Int
  }

  # ─── Queries ─────────────────────────────────────────────
  type Query {
    me: Profile
    getUser(id: ID!): Profile
    getMatches: [Match]
  }

  # ─── Mutations ───────────────────────────────────────────
  type Mutation {
    createProfile(profileInput: profileInput): AuthPayload
    login(profileInput: profileInput): AuthPayload
    updateProfile(profileInput: profileInput): Profile
  }
`;

module.exports = userTypeDefs;
