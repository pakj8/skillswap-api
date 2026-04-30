require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { ApolloServer } = require("apollo-server-express");
const mongoose = require("mongoose");
const cron = require("node-cron");

const { typeDefs, resolvers } = require("./modules/index");
const { getUser } = require("./middleware/auth");
const { resolveExpiredSessions } = require("./services/cron");

async function startServer() {
  const app = express();

  // CORS
  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "https://skillswap-api-production-5c44.up.railway.app/graphql",
      ],
      credentials: true,
    })
  );

  // Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({
      user: getUser(req),
    }),
    formatError: (err) => {
      // Clean up error messages for client
      console.error("[GraphQL Error]", err.message);
      return err;
    },
  });

  await server.start();
  server.applyMiddleware({ app, cors: false });

  // Connect to MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  // Cron — resolve expired sessions every hour
  cron.schedule("0 * * * *", async () => {
    console.log("[Cron] Running session resolution...");
    try {
      await resolveExpiredSessions();
    } catch (err) {
      console.error("[Cron] Error:", err.message);
    }
  });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(
      `🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`
    );
    console.log(`📊 GraphQL Playground: http://localhost:${PORT}/graphql`);
  });

  // ── TEMP: test route to manually trigger cron ─────────
  app.get("/run-cron", async (req, res) => {
    try {
      await resolveExpiredSessions();
      res.json({ success: true, message: "Cron ran successfully" });
    } catch (err) {
      res.json({ success: false, error: err.message });
    }
  });
}

startServer().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
