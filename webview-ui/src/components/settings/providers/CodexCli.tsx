import { useCallback } from "react"
import { VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"

import { inputEventTransform } from "../transforms"

type CodexCliProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const CodexCli = ({ apiConfiguration, setApiConfigurationField }: CodexCliProps) => {
	const { t } = useAppTranslation()

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.codexCliPath || ""}
				onInput={handleInputChange("codexCliPath")}
				placeholder="codex"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.codexCli.pathLabel")}</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.codexCli.pathDescription")}
			</div>

			<div className="text-sm text-vscode-descriptionForeground mt-3">
				{t("settings:providers.codexCli.description")}
			</div>

			<div className="text-sm text-vscode-descriptionForeground mt-2">
				{t("settings:providers.codexCli.instructions")}
			</div>

			<VSCodeLink
				href="https://github.com/openai/codex"
				className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground mt-2 inline-block">
				{t("settings:providers.codexCli.setupLink")}
			</VSCodeLink>

			<div className="mt-3 p-3 bg-vscode-editorWidget-background border border-vscode-editorWidget-border rounded">
				<div className="flex items-center gap-2 mb-2">
					<i className="codicon codicon-warning text-vscode-notificationsWarningIcon-foreground" />
					<span className="font-semibold text-sm">{t("settings:providers.codexCli.requirementsTitle")}</span>
				</div>
				<ul className="list-disc list-inside space-y-1 text-sm text-vscode-descriptionForeground">
					<li>{t("settings:providers.codexCli.requirement1")}</li>
					<li>{t("settings:providers.codexCli.requirement2")}</li>
					<li>{t("settings:providers.codexCli.requirement3")}</li>
					<li>{t("settings:providers.codexCli.requirement4")}</li>
				</ul>
			</div>
		</>
	)
}
