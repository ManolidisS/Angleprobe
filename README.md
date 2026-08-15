# Angleprobe

Angleprobe is an open-source Chrome extension that analyses text you deliberately highlight for framing, statistical problems, unsupported implications, and missing context.

It uses your own OpenRouter API key. There is no Angleprobe backend, user account, subscription, shared key, telemetry service, or Angleprobe-hosted database.

## Features

- Keeps the current selection and analysis when the popup closes; **Reset** starts fresh.
- Light, dark, and system themes.
- Fetches OpenRouter's current text models and shows only models advertising structured-output support.
- Builds reasoning-effort choices from each model's current metadata.
- Optional zero-data-retention requirement, enabled by default.
- Friendly errors for invalid keys, insufficient credit, rate limits, incompatible models, unavailable ZDR routes, timeouts, and provider failures.
- Validates model output before display and independently audits neutral rewrites.

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this repository folder (the folder containing `manifest.json`).
5. Pin Angleprobe, open **Settings**, and enter an OpenRouter API key.
6. Refresh the model list, choose a model and reasoning level, then save.

Create a dedicated OpenRouter key with a sensible spending limit. The key is stored in `chrome.storage.local` in your browser and sent only to OpenRouter; it is never sent to an Angleprobe service.

To use Angleprobe, highlight text on a normal webpage, open the extension, and click **Analyse selection**.

## Privacy and data flow

Angleprobe reads only the text you selected, and only after you open the extension. On analysis, the selected text and Angleprobe's prompts go directly to OpenRouter and the provider OpenRouter routes the request to.

With **Require zero data retention** enabled, requests include OpenRouter's ZDR and data-collection-denial routing preferences. A model can become unavailable when no compatible ZDR endpoint exists; Angleprobe reports that condition and lets you choose another model. Turning the option off broadens provider availability and makes the provider's own retention policy applicable.

The API key, settings, cached model list, active selection, and latest result are stored locally. **Reset** clears the active selection and result; **Clear saved key** removes the key. Uninstalling the extension removes its local data.

See [PRIVACY-POLICY-TEMPLATE.md](PRIVACY-POLICY-TEMPLATE.md) before publishing a store listing.

## Development

No build step or runtime dependencies are required. Chrome loads the source files directly.

```sh
npm test
npm run check
```

The extension uses Manifest V3 and requests only `activeTab`, `scripting`, `storage`, and host access to `https://openrouter.ai/*`.

## Chrome Web Store

Upload a ZIP whose root contains `manifest.json`. The separately produced `angleprobe-chrome-store.zip` is ready in that shape. Complete the store's privacy disclosures, host a completed privacy policy at a stable URL, add screenshots, and review the listing copy in [STORE-LISTING.md](STORE-LISTING.md).

## Contributing and security

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

Angleprobe is licensed under the [MIT License](LICENSE).
