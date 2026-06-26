# Evolve the System — Rebrand Without Rewriting

## User story

> As a **design system operator**,
> I want to **change the accent color, fonts, or spacing of my design system
> and see every component update automatically**,
> So that **I can rebrand or iterate on the system without rewriting UI code.**

## Acceptance criteria

- Changing a value in tokens.css immediately re-skins all components via hot-reload
- Changing the accent color updates every CTA, badge, link, and accent element
- Changing the font updates all headings or body text globally
- Changing the radius updates all cards, buttons, inputs, and modals
- Visual regression testing detects the systemic change across all components
- New baselines can be seeded to acknowledge an intentional rebrand
- The doctor validates the updated token contract is still complete
- No component source files need editing to reflect the new brand

## Role

Design system operator

## Effort

~1 minute to change a token and see it reflected everywhere
