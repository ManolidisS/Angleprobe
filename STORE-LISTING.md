# Chrome Web Store listing draft

## Name

Angleprobe

## Short description

Analyse highlighted text for framing, statistical issues, unsupported implications, and missing context.

## Detailed description

Angleprobe helps readers inspect the language and claims in text they choose. Highlight a passage, open Angleprobe, and request a structured analysis using your own OpenRouter API key.

Angleprobe can identify loaded wording, statistical caveats, potential factual claims worth checking, and useful missing context. When appropriate, it proposes a more neutral rewrite and audits that rewrite before showing it.

Features include persistent results, a Reset button, light and dark themes, a live compatible-model selector, model-specific reasoning controls, and an optional zero-data-retention requirement enabled by default.

Angleprobe is open source. It has no Angleprobe backend, accounts, subscriptions, advertising, or analytics.

## Permission justifications

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Limits access to the tab the user is actively using after invoking Angleprobe. |
| `scripting` | Reads only the text the user has highlighted in that active tab. |
| `storage` | Keeps user settings, the API key, current selection, and latest result locally. |
| `https://openrouter.ai/*` | Fetches the current compatible-model catalog and sends user-requested analyses directly to OpenRouter. |

## Submission checklist

- Replace the bracketed owner/contact details in the privacy-policy template and publish it.
- Enable GitHub private vulnerability reporting.
- Add store icon, screenshots of popup/settings in both themes, and a promotional image if desired.
- Complete the data-use disclosures so they exactly match the privacy policy and released code.
- Upload the Chrome Store ZIP with `manifest.json` at its root.
