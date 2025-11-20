import type { Anthropic } from "@anthropic-ai/sdk"

import { type ModelInfo, type CodexCliModelId, codexCliDefaultModelId, codexCliModels } from "@roo-code/types"

import type { ApiHandler } from "../index"
import type { ApiHandlerOptions } from "../../shared/api"
import { BaseProvider } from "./base-provider"
import { convertToSimpleMessages } from "../transform/simple-format"
import { ApiStream, ApiStreamReasoningChunk, ApiStreamTextChunk, ApiStreamUsageChunk } from "../transform/stream"
import { runCodexCli, type CodexCliEvent, type CodexCliItem } from "../../integrations/codex-cli/run"

const COMMAND_OUTPUT_CHAR_LIMIT = 4000

export class CodexCliHandler extends BaseProvider implements ApiHandler {
	private options: ApiHandlerOptions

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
	}

	override async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const prompt = buildPrompt(systemPrompt, messages)
		const model = this.getModel()
		const codexStream = runCodexCli({
			prompt,
			path: this.options.codexCliPath,
			modelId: model.id,
		})

		for await (const event of codexStream) {
			if (!event) {
				continue
			}

			if (isItemEvent(event)) {
				const chunk = transformItemToChunk(event.item)
				if (chunk) {
					yield chunk
				}
				continue
			}

			if (event.type === "turn.completed" && event.usage) {
				yield {
					type: "usage",
					inputTokens: event.usage.input_tokens ?? 0,
					outputTokens: event.usage.output_tokens ?? 0,
					cacheReadTokens: event.usage.cached_input_tokens ?? 0,
				} satisfies ApiStreamUsageChunk
				continue
			}

			if (event.type === "turn.failed") {
				throw new Error(event.error?.message || "Codex CLI turn failed")
			}

			if (event.type === "error") {
				throw new Error(event.message || "Codex CLI reported an error")
			}
		}
	}

	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in codexCliModels) {
			return { id: modelId as CodexCliModelId, info: codexCliModels[modelId as CodexCliModelId] }
		}

		return {
			id: codexCliDefaultModelId,
			info: codexCliModels[codexCliDefaultModelId],
		}
	}
}

function buildPrompt(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): string {
	const conversation = convertToSimpleMessages(messages)
		.map(
			(message) => `${message.role === "assistant" ? "Assistant" : "User"}:
${message.content}`,
		)
		.join("\n\n")

	return `${systemPrompt}

Conversation so far:
${conversation}

Respond as the assistant to the latest user message above.`
}

function isItemEvent(event: CodexCliEvent): event is CodexCliEvent & { item: CodexCliItem } {
	return event.type === "item.completed" || event.type === "item.updated" || event.type === "item.started"
}

function transformItemToChunk(item?: CodexCliItem): ApiStreamTextChunk | ApiStreamReasoningChunk | undefined {
	if (!item) {
		return undefined
	}

	switch (item.type) {
		case "agent_message":
			if (!item.text) {
				return undefined
			}
			return {
				type: "text",
				text: item.text,
			}
		case "reasoning":
			if (!item.text) {
				return undefined
			}
			return {
				type: "reasoning",
				text: item.text,
			}
		case "command_execution":
			return {
				type: "reasoning",
				text: formatCommandExecution(item),
			}
		case "todo_list":
			return {
				type: "reasoning",
				text: formatTodoList(item),
			}
		case "file_change":
			return {
				type: "reasoning",
				text: item.text || "Codex CLI proposed file changes.",
			}
		case "mcp_tool_call":
			return {
				type: "reasoning",
				text: formatToolCall(item),
			}
		case "web_search":
			return {
				type: "reasoning",
				text: item.text || "Codex CLI performed a web search.",
			}
		default:
			if (item.text) {
				return { type: "reasoning", text: item.text }
			}
			return undefined
	}
}

function formatCommandExecution(item: CodexCliItem): string {
	const command = item.command ? `Command: ${item.command}` : "Command executed"
	const output = (item.aggregated_output || "").trim()
	if (!output) {
		return command
	}
	const truncated =
		output.length > COMMAND_OUTPUT_CHAR_LIMIT ? `${output.slice(0, COMMAND_OUTPUT_CHAR_LIMIT)}…` : output
	return `${command}\n${truncated}`
}

function formatTodoList(item: CodexCliItem): string {
	if (!item.steps?.length) {
		return item.text || "Codex CLI updated its plan."
	}
	const formattedSteps = item.steps.map((step) => `- [${step.status ?? ""}] ${step.title}`).join("\n")
	return `Updated plan:\n${formattedSteps}`
}

function formatToolCall(item: CodexCliItem): string {
	const toolName = item.tool_name ? `Tool: ${item.tool_name}` : "Tool call"
	return `${toolName}\nInput: ${JSON.stringify(item.tool_input ?? {})}`
}
