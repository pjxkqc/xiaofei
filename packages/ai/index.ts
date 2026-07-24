import { openai } from "@ai-sdk/openai";

export const imageModel = openai("dall-e-3");
export const audioModel = openai("whisper-1");

export * from "ai";
export * from "./config";
export * from "./lib";
export * from "./model";
