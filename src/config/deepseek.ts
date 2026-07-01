import OpenAI from "openai";
import { env } from "./env";

// DeepSeek exposes an OpenAI-compatible API, so we reuse the openai SDK
// pointed at its base URL. Set DEEPSEEK_API_KEY in the environment.
export const deepseek = new OpenAI({
    apiKey: env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});
