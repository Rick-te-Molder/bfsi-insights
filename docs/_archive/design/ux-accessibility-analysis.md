# UX & Accessibility Analysis

> Analysis date: 2025-12-19

## Overview

This document analyzes the BFSI Insights website from UX and accessibility perspectives. Focus is on adding light mode support (dark mode colors are fine) and accessibility improvements for both modes.

---

## Issues to Address

| Category     | Issue                                               | Priority |
| ------------ | --------------------------------------------------- | -------- |
| **Contrast** | "Published" label gray on dark (~3:1) - needs 4.5:1 | High     |
| **Contrast** | Breadcrumb text too light                           | High     |
| **Contrast** | Some tag colors may not meet WCAG AA                | Medium   |
| **Layout**   | Expanded card height differs from neighbors         | Medium   |
| **UX**       | "View for" dropdown label unclear                   | Low      |
| **Touch**    | Expand/Collapse button slightly small               | Low      |
| **A11y**     | Focus states need improvement                       | Medium   |
| **A11y**     | Screen reader labels missing                        | Medium   |

---

## User Story

**Title:** Improve Website Contrast & Accessibility

**As a** user with varying abilities,  
**I want** the BFSI Insights website to have proper color contrast and accessibility features,  
**So that** I can read content comfortably and navigate with keyboard/screen reader.

### Acceptance Criteria

#### Contrast & Readability

- [ ] "Published" label meets WCAG AA (4.5:1 contrast ratio)
- [ ] Breadcrumb text meets WCAG AA contrast
- [ ] All tag colors meet 3:1 contrast against their backgrounds
- [ ] Date/source text is clearly readable

#### Layout Consistency

- [ ] Expanded cards maintain same height as collapsed neighbors (use max-height with scroll if needed)

#### Label Clarity

- [ ] Change "View for:" to "Audience view:"

#### Touch Targets

- [ ] Slightly increase Expand/Collapse button size (min 44x44px)

#### Keyboard & Focus

- [ ] All interactive elements have visible focus indicators
- [ ] Expand/Collapse can be triggered via Enter/Space
- [ ] `aria-expanded` attribute on expandable cards

#### Screen Reader

- [ ] "New" badge has sr-only descriptive text
- [ ] Tags have aria-labels with category
- [ ] Cards use proper semantic structure

### Out of Scope

- "+X more" tag behavior changes
- Homepage search
- Mobile card width
- Clickable tag filtering
- Major layout redesign

---

## Implementation Status

### Phase 1: Astro Website

- [ ] Fix contrast: Published label, breadcrumbs, tags
- [ ] Fix expanded card height consistency
- [ ] Change "View for" → "Audience view"
- [ ] Increase Expand/Collapse button size
- [ ] Add focus states
- [ ] Add aria labels

### Phase 2: Admin (React)

- [ ] Mirror all Phase 1 changes
