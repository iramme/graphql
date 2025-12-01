import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema.js";
import { resolvers, createCoursesLoader } from "./resolvers.js";
import { PORT } from "./config.js";

const server = new ApolloServer({ 
  typeDefs, 
  resolvers,
  introspection: true, // ✅ Important pour le playground
  playground: process.env.NODE_ENV !== 'production' // ✅ Désactiver en prod si besoin
});

// ✅ Configuration Render : host '0.0.0.0' obligatoire
const { url } = await startStandaloneServer(server, {
  listen: { 
    port: PORT,
    host: '0.0.0.0' // ✅ Ajout crucial pour Render
  },
  context: async () => ({
    loaders: { coursesLoader: createCoursesLoader() }
  })
});

console.log(`🚀 GraphQL Gateway running at ${url}`);
console.log(`📡 Student Service: ${process.env.STUDENT_URL}`);
console.log(`📡 Course Service: ${process.env.COURSE_URL}`);
console.log(`⚡ Mode: ${process.env.NODE_ENV || 'development'}`);