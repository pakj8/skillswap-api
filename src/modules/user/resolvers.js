const {
  createProfile,
  login,
  getMe,
  getUser,
  updateProfile,
  getMatches,
} = require("./controller");

const userResolvers = {
  Query: {
    me: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return getMe(user.id);
    },
    getUser: async (_, { id }) => getUser(id),
    getMatches: async (_, __, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return getMatches(user.id);
    },
  },
  Mutation: {
    createProfile: async (_, { profileInput }) => createProfile(profileInput),
    login: async (_, { profileInput }) => login(profileInput),
    updateProfile: async (_, { profileInput }, { user }) => {
      if (!user) throw new Error("Not authenticated");
      return updateProfile(user.id, profileInput);
    },
  },
};

module.exports = userResolvers;
