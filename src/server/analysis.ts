import { env } from "cloudflare:workers";
import { requestPhotoAnalysis } from "./analysis-client";
export { AI_RULES, analysisConfiguration, completePhotoResult } from "./analysis-client";
export function analysePhoto(imageData: string) {
  return requestPhotoAnalysis(imageData, env);
}
