# ADDED Requirements

### Requirement: Surface API exposes ds-from-project workflow status and progress

The backend SHALL expose, over a read-only streaming transport (SSE), the status and real-time
progress that the `ds-from-project` workflow produces, and SHALL serve the resulting adoption report.
This capability owns only the exposure/transport; the per-stage progress events and intermediate
artifacts themselves are produced and defined by the `ds-from-existing-project` workflow, and the
adoption report's shape is defined by the `component-adoption` capability.

#### Scenario: Client subscribes to workflow progress
- **WHEN** the `ds-from-project` workflow is running and a client subscribes to its progress
- **THEN** the backend surfaces, over the streaming transport, the per-stage progress events and intermediate artifacts produced by the workflow (see the `ds-from-existing-project` capability)

#### Scenario: Client reads workflow status after completion
- **WHEN** a client requests the workflow status after it has finished
- **THEN** the backend returns the terminal status (completed or failed) and the adoption report
- **THEN** a failed workflow includes the failing stage and reason

#### Scenario: Adoption report is served
- **WHEN** a client requests the adoption report for a completed workflow
- **THEN** the backend returns the adoption report (see the `component-adoption` capability for its shape)
