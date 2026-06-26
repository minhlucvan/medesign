# Compose & Deliver — Building a Production Page

## User story

> As a **product team shipping a marketing site**,
> I want to **compose components from across the project tree into
> complete pages, verify them end-to-end, and commit them with confidence**,
> So that **my team can iterate independently without breaking each other's work,
> no matter what folder convention we use.**

## Acceptance criteria

- Components can live in any folder convention: atomic design, feature-based, page-based, flat, or custom
- The agent writes new components to whatever path the developer specifies
- Composing a page is just normal React imports — no emdesign wrappers
- The lint checks token usage, not folder structure
- Story-level charters can validate the composed page (section count, element presence)
- A full-page visual baseline is established and detects cascading changes from sub-components
- The 4-source critique gate works on composed pages
- Capture seeds a baseline — no files are moved or duplicated
- Changing a sub-component triggers a visual diff on any parent page that includes it
- The doctor reports A/B grade on the design system after composition
- Production Storybook build succeeds with all stories

## Role

Product team / frontend team

## Effort

~5 minutes to compose, verify, and baseline a full page
