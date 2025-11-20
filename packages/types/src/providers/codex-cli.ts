import type { ModelInfo } from "../model.js"

import { openAiNativeModels } from "./openai.js"

const supportedCodexCliModelIds = [
	"gpt-5.1-codex-max",
	"gpt-5.1-codex",
	"gpt-5.1-codex-mini",
	"gpt-5.1",
	"gpt-5.1-chat-latest",
] as const

export type CodexCliModelId = (typeof supportedCodexCliModelIds)[number]

export const codexCliDefaultModelId: CodexCliModelId = "gpt-5.1-codex-max"

export const codexCliModels = supportedCodexCliModelIds.reduce(
	(acc, modelId) => {
		const modelInfo = openAiNativeModels[modelId]
		if (modelInfo) {
			acc[modelId] = modelInfo as ModelInfo
		}
		return acc
	},
	{} as Record<CodexCliModelId, ModelInfo>,
)
