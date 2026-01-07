# User Story: Prompt Version Management

## Overview

As a prompt engineer, I need to edit draft prompts in-place and manage version progression through DEV → TST → PRD → RET stages, so that I can iterate quickly on drafts while maintaining immutable production versions and preserving production history.

## Core Principles

1. **Drafts are mutable** - DEV and TST versions can be edited in-place
2. **Production is immutable** - PRD and RET versions are read-only
3. **Forward-only progression** - Versions move DEV → TST → PRD → RET (no demotion)
4. **Version increment only when needed** - Creating a new version is explicit
5. **One PRD per agent** - Only one version can be in PRD stage at a time (the current production version)
6. **History preserved** - When a new version is promoted to PRD, the old PRD becomes RET (retired)

## Stage Lifecycle

```
DEV → TST → PRD → RET
 ↓     ↓     ↓     ↓
Edit  Edit  View  View (Historical)
```

### Stage Definitions

| Stage   | Meaning                 | Editable | Count per Agent | Notes                                    |
| ------- | ----------------------- | -------- | --------------- | ---------------------------------------- |
| **DEV** | Draft in development    | ✅       | Multiple        | Can be deleted if not in use             |
| **TST** | Testing                 | ✅       | Multiple        | Cannot be deleted (committed to testing) |
| **PRD** | **Current** production  | ❌       | **One only**    | Active version used by agents            |
| **RET** | Retired (ex-production) | ❌       | Multiple        | Historical production versions           |

### Key Insight: No `is_current` Flag Needed

The `stage` field alone determines current status:

- `stage = 'PRD'` means this version is current (only one per agent)
- `stage = 'RET'` means this version was current but has been replaced
- No need for separate `is_current` boolean flag

### Metadata Tracking

Each version tracks:

- `deployed_at` - When promoted to PRD (timestamp)
- `retired_at` - When replaced by newer PRD (timestamp)
- `stage` - Current lifecycle stage

## Button States

| Stage | EDIT | TEST | PROMOTE   | CREATE NEW | DELETE |
| ----- | ---- | ---- | --------- | ---------- | ------ |
| DEV   | ✅   | ✅   | ✅ To TST | ✅         | ✅     |
| TST   | ✅   | ✅   | ✅ To PRD | ✅         | ❌     |
| PRD   | ❌   | ✅   | ❌        | ✅         | ❌     |
| RET   | ❌   | ✅   | ❌        | ✅         | ❌     |

## User Scenarios

### Scenario 1: Iterating on a DEV draft

**Context:** v2.3 is in DEV, v2.2 is in PRD

**Actions:**

- Click **EDIT** → Opens inline editor
- Make changes → Saves to v2.3 (no version bump)
- Click **TEST** → Tests the updated v2.3
- Repeat until satisfied
- Click **PROMOTE TO TST** → Moves v2.3 to TST stage

**Outcome:** v2.3 progresses to TST without creating v2.4

---

### Scenario 2: Testing in TST stage

**Context:** v2.3 is in TST, v2.2 is in PRD

**Actions:**

- Click **TEST** → Run tests against TST environment
- Find minor issue
- Click **EDIT** → Fix issue in-place in v2.3
- Click **TEST** → Verify fix
- Click **PROMOTE TO PRD** → Deploy v2.3 to production

**Outcome:**

- v2.3 becomes PRD (stage = 'PRD', deployed_at = NOW())
- v2.2 becomes RET (stage = 'RET', retired_at = NOW())
- Only v2.3 is now in PRD stage

---

### Scenario 3: Creating a new version from PRD

**Context:** v2.3 is in PRD, need to make changes

**Actions:**

- View v2.3 (PRD version)
- **EDIT** button is greyed out (cannot edit production)
- Click **CREATE NEW VERSION** → Creates v2.4 as DEV draft with v2.3 content
- Opens v2.4 in edit mode
- Make changes to v2.4

**Outcome:** v2.4 created as DEV draft, v2.3 remains unchanged in PRD

---

### Scenario 4: Multiple drafts exist

**Context:** v2.3 in TST, v2.4 in DEV, v2.2 in PRD

**Actions:**

- Can edit v2.4 (DEV) independently
- Can edit v2.3 (TST) independently
- Can promote v2.3 to PRD → v2.2 becomes RET, v2.3 becomes PRD
- Can promote v2.4 to TST (becomes v2.4 TST)
- Can delete v2.4 if not needed

**Outcome:** Each draft version is independent, can progress at its own pace

---

### Scenario 5: Hotfix needed in production

**Context:** v2.3 is in PRD, critical bug found

**Actions:**

- View v2.3 (PRD)
- Click **CREATE NEW VERSION** → Creates v2.4 as DEV draft
- Click **EDIT** on v2.4 → Make hotfix
- Click **PROMOTE TO TST** → Fast-track to TST
- Click **TEST** → Verify fix
- Click **PROMOTE TO PRD** → Deploy v2.4

**Outcome:**

- v2.4 deployed as PRD (stage = 'PRD')
- v2.3 retired (stage = 'RET', retired_at = NOW())
- Production history preserved

---

### Scenario 6: Viewing production history

**Context:** v2.4 is in PRD, v2.3 and v2.2 are in RET

**Actions:**

- View v2.3 (RET version)
- See metadata: "Production: Dec 1, 2025 → Dec 15, 2025 (14 days)"
- See: "Replaced by: v2.4"
- **EDIT** button is greyed out (historical version)
- Can **CREATE NEW VERSION** from v2.3 if needed to rollback
- Can **TEST** v2.3 to verify old behavior

**Outcome:** Full audit trail of production history with timestamps

---

## Button Behavior Details

### EDIT Button

- **Enabled:** DEV and TST stages
- **Disabled:** PRD and RET stages (greyed out with tooltip: "Cannot edit production versions")
- **Action:** Opens inline editor, saves changes to current version (no version increment)

### TEST Button

- **Enabled:** All stages
- **Action:** Runs test against the prompt in its current stage environment

### PROMOTE Button

- **DEV stage:** "Promote to TST" - Moves version to TST stage
- **TST stage:** "Promote to PRD" - Deploys version to production
  - Sets new version: stage = 'PRD', deployed_at = NOW()
  - Sets old PRD: stage = 'RET', retired_at = NOW()
- **PRD stage:** Hidden (no further promotion)
- **RET stage:** Hidden (historical version)
- **Action:** Changes stage and updates timestamps

### CREATE NEW VERSION Button

- **Enabled:** All stages
- **Label:** "Create New Version"
- **Action:**
  - Copies content from current version
  - Increments to next available version number
  - Creates as DEV draft
  - Opens in edit mode

### DELETE Button

- **Enabled:** DEV stage only
- **Disabled:** TST, PRD, and RET stages
- **Action:** Permanently removes the draft version
- **Note:** Cannot delete versions that have progressed beyond DEV

---

## Edge Cases

**Q: What if I'm editing v2.3 in DEV and someone promotes v2.2 to PRD?**
A: No conflict. v2.3 continues as DEV draft, v2.2 is now PRD.

**Q: Can I have v2.3 in TST and v2.4 in DEV at the same time?**
A: Yes. Each stage can have one current version. They progress independently.

**Q: What if I want to abandon v2.4 and go back to v2.3?**
A: Delete v2.4 (if in DEV), then edit v2.3 instead. No demotion needed.

**Q: Can I edit a PRD version to fix a typo?**
A: No. Must create new version, make fix, and promote through stages.

**Q: What happens to old production versions?**
A: When a new version is promoted to PRD, the old PRD automatically becomes RET (retired). This preserves production history.

**Q: Can I see when a version was in production?**
A: Yes. RET versions show deployed_at and retired_at timestamps, so you can see exactly when each version was live.

**Q: Can I rollback to a retired version?**
A: Not directly. But you can create a new version from any RET version, then promote it through DEV → TST → PRD.

**Q: Why not just use is_current flag?**
A: The stage field alone is sufficient. PRD = current, RET = was current. Simpler and prevents inconsistencies.

---

## Success Criteria

- ✅ Can edit DEV/TST drafts in-place without version increment
- ✅ Cannot edit PRD or RET versions (immutable)
- ✅ Can create new version from any existing version
- ✅ Clear visual indication of stage (DEV/TST/PRD/RET)
- ✅ Can delete unused DEV drafts
- ✅ Only one PRD version per agent at a time
- ✅ Production history preserved (all RET versions with timestamps)
- ✅ Can audit when each version was in production
- ✅ No is_current flag needed (stage alone determines status)
