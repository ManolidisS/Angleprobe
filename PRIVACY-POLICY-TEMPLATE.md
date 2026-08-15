# Angleprobe Privacy Policy — publication template

**Effective date:** [DATE]

Replace the bracketed owner/contact fields, publish this policy at a stable public URL, and verify that it still matches the released code and your jurisdiction before submitting Angleprobe to an extension store.

## What Angleprobe does

Angleprobe is a browser extension that analyses text a user deliberately highlights. It does not automatically scan entire pages, read browsing history, or operate until the user opens the extension.

## Information processed

When the user requests an analysis, Angleprobe sends the selected text, analysis instructions, selected model, and request settings directly from the browser to OpenRouter. OpenRouter routes the request to the selected model provider. No request passes through an Angleprobe-operated server.

The extension stores the following locally in the user's Chrome profile: their OpenRouter API key, model and privacy settings, appearance preference, a cached OpenRouter model list, the active selected text, and the latest analysis result.

Angleprobe's maintainers do not receive or store the API key, selected text, analysis result, or model request. The project does not operate analytics, advertising, account, payment, or telemetry services.

## Zero-data-retention option

The **Require zero data retention** setting is enabled by default. When enabled, Angleprobe asks OpenRouter to use only zero-data-retention endpoints and deny providers that collect data. If no compatible route exists, the request fails and Angleprobe displays an explanation. If the user disables this setting, OpenRouter and the selected provider's own retention practices apply.

This option controls request routing; it does not erase data the user stores locally in Chrome.

## Retention and deletion

Locally stored information remains in Chrome until the user resets the current analysis, clears the saved API key, clears extension storage, or uninstalls Angleprobe. Because Angleprobe does not run a backend, the maintainers have no server-side user record to delete.

OpenRouter and model providers process requests under their own terms and privacy policies. Users should review their OpenRouter privacy settings and the policies applicable to their selected provider.

## Security

Users should create a dedicated OpenRouter API key with a spending limit and revoke it if they suspect exposure. No internet or local storage mechanism can guarantee absolute security.

## Changes

This policy may be updated when the extension, providers, or data practices change. The effective date identifies the latest version.

## Contact

[PROJECT OWNER OR LEGAL NAME]  
[CONTACT EMAIL]  
[COUNTRY OR ADDRESS IF REQUIRED]
