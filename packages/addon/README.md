# @medesign/addon

The **medesign Storybook addon** — the live design-to-change-request loop panel. Adds a panel to
Storybook where you can chat with the agent, see critique scores, view visual diffs, and capture
components as reusable parts.

## Role in the system

This is the **human feedback channel** in the four-source critique loop. The panel lets you:

- Enter change requests that feed into the design loop
- View live critique scores after each round
- See visual diff screenshots (actual vs baseline)
- Click **Capture** to promote a generated component to a git-tracked reusable

## Usage

```bash
# Add to your .storybook/main.* addons array:
npm i -D @medesign/addon
```

Then open the medesign panel in Storybook's addon drawer.

## Related

- `@medesign/backend` — serves the addon's HTTP API
- `docs/architecture.md` — how the addon connects to the backend
- `docs/harness-engine.md` — the four-source critique loop
