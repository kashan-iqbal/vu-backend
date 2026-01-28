import mongoose from "mongoose";
import { env } from "./env";

export async function connectDB() {
  try {
    await mongoose.connect(env.DATABASE_URL);

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed");
    console.error(error);
    process.exit(1); // crash app if DB fails
  }
}
