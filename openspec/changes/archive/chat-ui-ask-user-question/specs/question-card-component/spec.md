## ADDED Requirements

### Requirement: QuestionCard renders structured questions inline

The `@emdesign/chat-ui` package SHALL export a `QuestionCard` component that renders structured multiple-choice questions in the chat message stream. The component SHALL support:

- Displaying 1-4 questions per card (the AskUserQuestion limit)
- Each question with: question text, header label (max 12 chars), and 2-4 options
- Single-select (radio buttons) and multi-select (checkboxes) modes
- Each option with: label, description, and optional preview content
- A "Submit" button that is disabled until all required questions have at least one answer
- A "Cancel" button that dismisses the question

#### Scenario: Single-select question renders with radio buttons
- **WHEN** `QuestionCard` receives `[{ question: "Which color scheme?", header: "Theme", options: [{ label: "Light", description: "Light background, dark text" }, { label: "Dark", description: "Dark background, light text" }], multiSelect: false }]`
- **THEN** the component SHALL render the question text "Which color scheme?"
- **AND** display the header chip "Theme"
- **AND** render two radio button options with labels and descriptions
- **AND** show a disabled Submit button

#### Scenario: Multi-select question renders with checkboxes
- **WHEN** `multiSelect: true`
- **THEN** the component SHALL render checkboxes instead of radio buttons
- **AND** allow selecting multiple options
- **AND** show the count of selected options (e.g., "2 selected")

#### Scenario: Submit enables when all questions have answers
- **WHEN** user has selected an answer for every question
- **THEN** the Submit button SHALL become enabled
- **AND** clicking Submit SHALL call `onSubmit` with the answers object

#### Scenario: Submit disabled when any question unanswered
- **WHEN** at least one question has no selection
- **THEN** the Submit button SHALL remain disabled
- **AND** unanswered questions SHALL show a subtle "Required" indicator

### Requirement: QuestionCard states — interactive, pending, answered, expired

`QuestionCard` SHALL support four visual states:

| State | Visual | Interaction |
|-------|--------|-------------|
| `interactive` | Full question card with options, submit/cancel buttons | User can select options and submit |
| `pending` | Same as interactive, submit button disabled and shows spinner | No interaction — answer is being submitted |
| `answered` | Read-only summary showing selected answers per question | No interaction |
| `expired` | Dimmed card with "Question expired" message and timestamp | No interaction |

#### Scenario: Interactive state shows options
- **WHEN** `state: "interactive"`
- **THEN** the component SHALL render all options as selectable
- **AND** show enabled Submit and Cancel buttons

#### Scenario: Pending state shows spinner on submit
- **WHEN** `state: "pending"`
- **THEN** the Submit button SHALL show a loading spinner
- **AND** the Submit button SHALL be disabled
- **AND** all options SHALL be read-only (no selection changes)

#### Scenario: Answered state shows confirmation summary
- **WHEN** `state: "answered"` with `answers` prop
- **THEN** the component SHALL render a read-only summary
- **AND** show each question with its selected option(s) in a muted style
- **AND** display a checkmark icon and "Answered" label

#### Scenario: Expired state shows timeout message
- **WHEN** `state: "expired"`
- **THEN** the component SHALL render with reduced opacity
- **AND** display "⏱ Question expired" above the questions
- **AND** show the timeout duration

### Requirement: QuestionCard props interface

The `QuestionCard` SHALL accept the following props:

```typescript
interface QuestionCardProps {
  questions: Question[]
  onSubmit: (answers: Record<string, string | string[]>) => void
  onCancel?: () => void
  state?: 'interactive' | 'pending' | 'answered' | 'expired'
  answers?: Record<string, string | string[]>  // for answered state
  timeoutSeconds?: number                       // for expired state
}

interface Question {
  question: string
  header?: string       // max 12 chars
  options: QuestionOption[]
  multiSelect?: boolean // default false
}

interface QuestionOption {
  label: string
  description: string
  preview?: string      // HTML preview content
}
```

#### Scenario: Default state is interactive
- **WHEN** `state` prop is omitted
- **THEN** the component SHALL default to `interactive` state

### Requirement: QuestionCard styled consistently with chat-ui theme

The `QuestionCard` SHALL use the same shadcn CSS variables as the rest of `@emdesign/chat-ui` (injected via `injectShadcnVars()`). Specific styling:

- Card container: `--muted` background, `--radius` border radius, 1px border
- Question text: `--foreground` color, slightly larger font
- Options: `--background` background, `--muted-foreground` description text
- Selected option: `--primary` border/accent color
- Submit button: `--primary` background, `--primary-foreground` text

#### Scenario: Questions card uses theme variables
- **WHEN** `QuestionCard` renders
- **THEN** all colors SHALL reference shadcn CSS variables
- **AND** no hardcoded color values SHALL be used
