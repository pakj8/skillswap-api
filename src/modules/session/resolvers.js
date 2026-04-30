const {
  bookSession,
  acceptSession,
  confirmSession,
  cancelSession,
  mySessions,
  pendingConfirmations,
  myCreditHistory,
  getSession,
} = require("./controller");

const sessionResolvers = {
  Query: {
    mySessions: async (_, args, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return mySessions(user.id, args);
    },
    pendingConfirmations: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return pendingConfirmations(user.id);
    },
    myCreditHistory: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return myCreditHistory(user.id);
    },
    getSession: async (_, { sessionId }, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return getSession(sessionId);
    },
  },
  Mutation: {
    bookSession: async (_, args, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return bookSession(user.id, args);
    },
    acceptSession: async (_, { sessionId }, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return acceptSession(user.id, sessionId);
    },
    confirmSession: async (_, args, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return confirmSession(user.id, args);
    },
    cancelSession: async (_, { sessionId }, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return cancelSession(user.id, sessionId);
    },
  },
};

module.exports = sessionResolvers;
