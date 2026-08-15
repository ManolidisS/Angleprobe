# Security policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not open a public issue for credential exposure, extension-permission bypasses, or injection vulnerabilities. If private reporting is not yet enabled, contact the repository owner through their public GitHub profile without including exploit details.

## Key handling

Angleprobe stores the user's OpenRouter key in `chrome.storage.local` and sends it only to `https://openrouter.ai`. Users should create a dedicated OpenRouter key with a spending limit and revoke it immediately if they suspect exposure.

Angleprobe never requests or needs a project maintainer's shared API key.
