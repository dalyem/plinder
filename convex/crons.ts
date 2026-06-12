import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Ephemerality is the contract: results live 24h after a session completes,
// then everything about it is deleted.
crons.interval("cleanup expired sessions", { minutes: 15 }, internal.cleanup.run, {});

export default crons;
