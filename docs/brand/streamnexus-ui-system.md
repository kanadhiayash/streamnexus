# StreamNexus UI System

This document defines the approved shared UI layer for StreamNexus pivot screens.

## Tokens

Use semantic CSS tokens from `public/css/styles.css` for application UI:

- Brand: `--color-brand-primary`, `--color-brand-primary-hover`, `--color-brand-primary-pressed`, `--color-brand-accent`, `--color-brand-link`
- Surfaces: `--color-bg-canvas`, `--color-bg-surface`, `--color-bg-surface-raised`, `--color-bg-surface-strong`
- Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse`
- Status: `--color-status-success-*`, `--color-status-warning-*`, `--color-status-danger-*`, `--color-status-info-*`
- Space, radius, shadow, motion, focus, and font weights use the matching `--space-*`, `--radius-*`, `--shadow-*`, `--motion-*`, `--focus-*`, and `--font-weight-*` tokens.

Approved brand palette values come from `public/brand/brand-tokens.json`. Page templates must not couple directly to raw brand hex values.

## Approved Components

Use these shared classes before creating page-specific variants:

- Brand and navigation: `.brand`, `.nav`
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-success`, `.btn-danger`, `.btn-sm`, `.btn-block`
- Forms: `.form-group`, `.form-panel`, `.form-fieldset`, `.form-help`, `.form-check`, `.form-actions`, `.required-marker`
- Cards: `.card`, `.poster-card`, `.title-card`, `.mini-poster`, `.stat-card`
- Status and capacity: `.status`, `.capacity-meter`, `.capacity-copy`
- Feedback: `.alert`, `.alert-error`, `.alert-success`, `.alert-info`, `.alert-warning`, `.toast`
- Data display: `.table-wrap`, `table`, `.pagination`, `.view-toggle`, `.tabs`, `.tab`
- Overlays and loading: `.confirm-dialog`, `.content-modal`, `.skeleton`
- Empty and system states: `.empty-state`, `.empty-action`, `.error-state`

## Prohibited Usage

- Do not use unsupported font weights such as `650`, `720`, `750`, `760`, or `850`.
- Do not communicate status by colour alone. Use status text plus the shared marker or alert label.
- Do not add external font CDN dependencies.
- Do not use raw colours in templates for application UI.
- Do not add new one-off button, alert, table, modal, toast, or form-control classes when a shared class covers the state.
- Do not remove visible focus states or reduced-motion handling.

## Accessibility Rules

- Keyboard focus must remain visible for links, buttons, fields, dialogs, and card triggers.
- Inputs with validation errors must expose `aria-invalid="true"` or the `.error` class.
- Motion must respect `prefers-reduced-motion: reduce`.
- Disabled and loading controls must be visually distinct and programmatically disabled where applicable.
