import { defineAgent } from "eve";
import { google } from "@ai-sdk/google";

export default defineAgent({
  model: google("gemini-3.5-flash-lite"),
});
