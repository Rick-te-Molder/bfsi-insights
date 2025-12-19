# User Story: Prompt Version Management

## Overview

As a prompt engineer, I need to edit draft prompts in-place and manage version progression through DEV → TST → PROD stages, so that I can iterate quickly on drafts while maintaining immutable production versions.

## Core Principles

1. **Drafts are mutable** - DEV and TST versions can be edited in-place
2. **Production is immutable** - PROD versions are read-only
3. **Forward-only progression** - Versions move DEV → TST → PROD (no demotion)
4. **Version increment only when needed** - Creating a new version is explicit

## Button States

| Stage | EDIT | TEST | PROMOTE    | CREATE NEW | DELETE            |
| ----- | ---- | ---- | ---------- | ---------- | ----------------- |
| DEV   | ✅   | ✅   | ✅ To TST  | ✅         | ✅ If not current |
| TST   | ✅   | ✅   | ✅ To PROD | ✅         | ❌                |
| PROD  | ❌   | ✅   | ❌         | ✅         | ❌                |

## User Scenarios

### Scenario 1: Iterating on a DEV draft

**Context:** v2.3 is current in DEV, v2.2 is in PROD

**Actions:**

- Click **EDIT** → Opens inline editor
- Make changes → Saves to v2.3 (no version bump)
- Click **TEST** → Tests the updated v2.3
- Repeat until satisfied
- Click **PROMOTE TO TST** → Moves v2.3 to TST stage

**Outcome:** v2.3 progresses to TST without creating v2.4

---

### Scenario 2: Testing in TST stage

**Context:** v2.3 is in TST, v2.2 is in PROD

**Actions:**

- Click **TEST** → Run tests against TST environment
- Find minor issue
- Click **EDIT** → Fix issue in-place in v2.3
- Click **TEST** → Verify fix
- Click **PROMOTE TO PROD** → Deploy v2.3 to production

**Outcome:** v2.3 becomes PROD, v2.2 remains as historical PROD version

---

### Scenario 3: Creating a new version from PROD

**Context:** v2.3 is in PROD, need to make changes

**Actions:**

- View v2.3 (PROD version)
- **EDIT** button is greyed out
- Click **CREATE NEW VERSION** → Creates v2.4 as DEV draft with v2.3 content
- Opens v2.4 in edit mode
- Make changes to v2.4

**Outcome:** v2.4 created as DEV draft, v2.3 remains unchanged in PROD

---

### Scenario 4: Multiple drafts exist

**Context:** v2.3 in TST, v2.4 in DEV, v2.2 in PROD

**Actions:**

- Can edit v2.4 (DEV) independently
- Can edit v2.3 (TST) independently
- Can promote v2.3 to PROD (becomes v2.3 PROD)
- Can promote v2.4 to TST (becomes v2.4 TST)
- Can delete v2.4 if not needed

**Outcome:** Each draft version is independent, can progress at its own pace

---

### Scenario 5: Hotfix needed in production

**Context:** v2.3 is in PROD, critical bug found

**Actions:**

- View v2.3 (PROD)
- Click **CREATE NEW VERSION** → Creates v2.4 as DEV draft
- Click **EDIT** on v2.4 → Make hotfix
- Click **PROMOTE TO TST** → Fast-track to TST
- Click **TEST** → Verify fix
- Click **PROMOTE TO PROD** → Deploy v2.4

**Outcome:** Hotfix deployed as v2.4, v2.3 remains in history

---

## Button Behavior Details

### EDIT Button

- **Enabled:** DEV and TST stages
- **Disabled:** PROD stage (greyed out with tooltip: "Cannot edit production versions")
- **Action:** Opens inline editor, saves changes to current version (no version increment)

### TEST Button

- **Enabled:** All stages
- **Action:** Runs test against the prompt in its current stage environment

### PROMOTE Button

- **DEV stage:** "Promote to TST" - Moves version to TST stage
- **TST stage:** "Promote to PROD" - Deploys version to production
- **PROD stage:** Hidden (no further promotion)
- **Action:** Changes stage, marks version as current for that stage

### CREATE NEW VERSION Button

- **Enabled:** All stages
- **Label:** "Create New Version"
- **Action:**
  - Copies content from current version
  - Increments to next available version number
  - Creates as DEV draft
  - Opens in edit mode

### DELETE Button

- **Enabled:** DEV stage only, and only if not the current DEV version
- **Disabled:** TST and PROD stages
- **Action:** Permanently removes the draft version

---

## Edge Cases

**Q: What if I'm editing v2.3 in DEV and someone promotes v2.2 to PROD?**
A: No conflict. v2.3 continues as DEV draft, v2.2 is now PROD.

**Q: Can I have v2.3 in TST and v2.4 in DEV at the same time?**
A: Yes. Each stage can have one current version. They progress independently.

**Q: What if I want to abandon v2.4 and go back to v2.3?**
A: Delete v2.4 (if in DEV), then edit v2.3 instead. No demotion needed.

**Q: Can I edit a PROD version to fix a typo?**
A: No. Must create new version, make fix, and promote through stages.

---

## Success Criteria

- ✅ Can edit DEV/TST drafts in-place without version increment
- ✅ Cannot edit PROD versions (immutable)
- ✅ Can create new version from any existing version
- ✅ Clear visual indication of stage (DEV/TST/PROD)
- ✅ Can delete unused DEV drafts
- ✅ Version history preserved (all PROD versions remain)
