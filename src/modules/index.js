const userTypeDefs = require("./user/typeDefs");
const sessionTypeDefs = require("./session/typeDefs");
const userResolvers = require("./user/resolvers");
const sessionResolvers = require("./session/resolvers");

// Apollo requires a base Query/Mutation — user module provides it
// Session module extends with `extend type Query / Mutation`
const typeDefs = [userTypeDefs, sessionTypeDefs];

const resolvers = {
  Query: {
    ...userResolvers.Query,
    ...sessionResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...sessionResolvers.Mutation,
  },
};

module.exports = { typeDefs, resolvers };
