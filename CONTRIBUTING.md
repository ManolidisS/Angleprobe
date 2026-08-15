# Contributing to Angleprobe

Thanks for helping make media-literacy analysis more transparent and useful.

## Principles

- Critique techniques, not ideologies.
- Apply symmetrical standards.
- Never invent an opposing conclusion.
- Treat model output as untrusted data.
- Preserve privacy and disclose every external data flow.
- Prefer evaluation cases over prompt changes based on one anecdote.

## Development

Angleprobe has no build step or runtime dependencies.

1. Fork and clone the repository.
2. Open `chrome://extensions`, enable Developer mode, and load the repository folder unpacked.
3. Run `npm test` and `npm run check` before opening a pull request.
4. Never commit an OpenRouter API key, selected article text, or user analysis data.

Bug reports should include the selected model, reasoning setting, ZDR setting, visible error code/message, and a non-sensitive reproduction passage. Do not post API keys.
