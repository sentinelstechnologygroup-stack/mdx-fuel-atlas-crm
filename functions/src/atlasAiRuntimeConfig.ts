/* eslint-disable require-jsdoc */
import {defineSecret, defineString} from "firebase-functions/params";

export const atlasOpenAiApiKey = defineSecret("ATLAS_OPENAI_API_KEY", {
  description: "Server-only OpenAI credential for ATLAS.",
});

const atlasTextModel = defineString("ATLAS_TEXT_MODEL", {
  default: "gpt-4.1-mini",
  description: "Approved ATLAS text and vision model.",
});

const atlasImageModel = defineString("ATLAS_IMAGE_MODEL", {
  default: "gpt-image-1",
  description: "Approved ATLAS image generation model.",
});

export function atlasAiEnvironment(): {
  apiKey: string;
  textModel: string;
  imageModel: string;
  } {
  return {
    apiKey: atlasOpenAiApiKey.value(),
    textModel: atlasTextModel.value(),
    imageModel: atlasImageModel.value(),
  };
}
