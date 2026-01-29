import { FastifyInstance } from "fastify";
import { cleanupDatabase } from "../utils/databaseCleanup";

export async function adminRoutes(app: FastifyInstance) {
  app.post("/admin/cleanup", async (req, reply) => {
    try {
      const count = await cleanupDatabase();
      return { 
        success: true, 
        message: `Manual cleanup successful. Removed ${count} records.` 
      };
    } catch (error) {
      reply.status(500).send({ success: false, error: "Cleanup failed" });
    }
  });
}