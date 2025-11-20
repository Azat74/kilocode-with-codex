import * as vscode from "vscode"
import { execa } from "execa"
import readline from "node:readline"

import { t } from "../../i18n"

const workspaceCwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)

export type CodexCliEvent = {
	type: string
	item?: CodexCliItem
	usage?: CodexCliUsage
	error?: { message: string }
	message?: string
}

export type CodexCliItem = {
	id: string
	type: string
	text?: string
	command?: string
	aggregated_output?: string
	status?: string
	steps?: Array<{ title: string; status: string }>
	tool_name?: string
	tool_input?: unknown
	tool_result?: unknown
}

export type CodexCliUsage = {
	input_tokens: number
	output_tokens: number
	cached_input_tokens?: number
}

interface CodexCliOptions {
	prompt: string
	path?: string
	modelId?: string
}

export async function* runCodexCli(options: CodexCliOptions): AsyncGenerator<CodexCliEvent> {
	const codexPath = options.path || "codex"
	const args = ["exec", "--json", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never"]

	if (options.modelId) {
		args.push("--model", options.modelId)
	}

	args.push(options.prompt)

	let childProcess
	try {
		childProcess = execa(codexPath, args, {
			cwd: workspaceCwd ?? process.cwd(),
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			maxBuffer: 1024 * 1024 * 100,
		})
	} catch (error: any) {
		if (error?.code === "ENOENT") {
			throw new Error(
				t("common:errors.codexCli.notFound", {
					codexPath,
					installationUrl: "https://github.com/openai/codex",
					originalError: error?.message || "",
				}),
			)
		}
		throw error
	}

	const stderrChunks: string[] = []
	childProcess.stderr?.on("data", (chunk) => stderrChunks.push(chunk.toString()))

	const rl = readline.createInterface({
		input: childProcess.stdout!,
	})

	try {
		for await (const line of rl) {
			const trimmed = line.trim()
			if (!trimmed) {
				continue
			}

			try {
				yield JSON.parse(trimmed) as CodexCliEvent
			} catch (error) {
				console.error("Failed to parse Codex CLI output:", trimmed)
			}
		}

		const { exitCode } = await childProcess
		if (exitCode && exitCode !== 0) {
			const stderr = stderrChunks.join("").trim()
			throw new Error(
				t("common:errors.codexCli.executionFailed", {
					exitCode,
					error: stderr,
				}),
			)
		}
	} finally {
		rl.close()
		if (!childProcess.killed) {
			childProcess.kill()
		}
	}
}
