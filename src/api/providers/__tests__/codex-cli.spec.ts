// npx vitest run src/api/providers/__tests__/codex-cli.spec.ts

import { describe, it, expect, vi, beforeEach } from "vitest"

import type { ApiHandlerOptions } from "../../../shared/api"
import { CodexCliHandler } from "../codex-cli"

// Mock runCodexCli integration
vi.mock("../../../integrations/codex-cli/run", () => ({
	runCodexCli: vi.fn(),
}))

const { runCodexCli } = await import("../../../integrations/codex-cli/run")

describe("CodexCliHandler", () => {
	let handler: CodexCliHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiModelId: "gpt-5.1-codex",
		}
		handler = new CodexCliHandler(mockOptions)
		vi.mocked(runCodexCli).mockReset()
	})

	it("streams reasoning, text, and usage chunks", async () => {
		const mockStream = async function* () {
			yield { type: "item.completed", item: { id: "1", type: "reasoning", text: "Thinking" } }
			yield { type: "item.completed", item: { id: "2", type: "agent_message", text: "Done" } }
			yield { type: "turn.completed", usage: { input_tokens: 10, output_tokens: 2 } }
		}

		vi.mocked(runCodexCli).mockReturnValue(mockStream())

		const chunks: any[] = []
		for await (const chunk of handler.createMessage("system", [{ role: "user", content: "Hello" } as any])) {
			chunks.push(chunk)
		}

		expect(chunks).toEqual([
			{ type: "reasoning", text: "Thinking" },
			{ type: "text", text: "Done" },
			{ type: "usage", inputTokens: 10, outputTokens: 2, cacheReadTokens: 0 },
		])
	})

	it("falls back to default model when invalid id supplied", () => {
		handler = new CodexCliHandler({ apiModelId: "invalid" })
		const model = handler.getModel()
		expect(model.id).toBe("gpt-5.1-codex-max")
	})

	it("formats command execution events as reasoning chunks", async () => {
		const mockStream = async function* () {
			yield {
				type: "item.completed",
				item: {
					id: "3",
					type: "command_execution",
					command: "ls",
					aggregated_output: "fileA\nfileB\n",
				},
			}
		}

		vi.mocked(runCodexCli).mockReturnValue(mockStream())
		const iterator = handler.createMessage("system", [{ role: "user", content: "List" } as any])
		const result = await iterator.next()
		expect(result.value).toEqual({
			type: "reasoning",
			text: expect.stringContaining("Command: ls"),
		})
	})
})
