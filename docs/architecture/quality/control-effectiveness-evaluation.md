# Control Effectiveness Evaluation: Sonar Issue Resolution

**Date**: 2026-01-05  
**Scope**: Effectiveness of quality controls (C3, C7) in guiding AI coding agents to find and apply documented fixes for SonarCloud issues  
**Benchmark**: Controls should effectively guide even free/weaker LLMs (e.g., SWE-1.5) to the right behavior

---

## 1. Executive Summary

**Current State**: The documentation structure is excellent (rules, lessons, lookup table), but **agents don't know to look there first**. The controls rely on agents voluntarily reading `.windsurfrules` and discovering the Sonar documentation—which is not how agents behave by default.

**Core Gap**: There is no **directive** in `.windsurfrules` that explicitly instructs agents to consult Sonar documentation before attempting fixes.

**Observation (n=1)**: When asked to fix Sonar issue S3358 with the rule number in the branch name, the agent immediately started scanning the entire codebase for files referencing that number (grep for "3358"), rather than first consulting `.windsurfrules` or the documented Sonar lessons.

---

## 2. Default Agent Behavior Analysis

### 2.1 Scenario A: "Fix Sonar issue S3358 in file X"

**Default agent behavior** (without effective controls):

1. **Grep/search** the codebase for "S3358" or "3358" to find occurrences
2. **Read the file** mentioned to understand the code
3. **Apply general knowledge** about what S3358 means (nested ternaries)
4. **Implement a fix** based on training data, not project-specific patterns

**Why this is suboptimal**:

- Agent may find references to the number but not the lesson documentation
- Agent applies generic fix patterns, not project-specific documented patterns
- No guarantee the fix matches prior approved patterns
- Inconsistent fixes across the codebase

### 2.2 Scenario B: "Fix file X" (issue not specified)

**Default agent behavior**:

1. **Read the file** to understand what's in it
2. **Run linter/analyzer** if instructed, or guess based on common patterns
3. **Apply general knowledge** fixes for detected issues
4. No awareness of project-specific documentation

**Why this is suboptimal**:

- Agent doesn't know what the issue is
- No trigger to consult Sonar documentation
- Completely reliant on general training data

---

## 3. Gap Analysis: Why Current Controls Don't Intercept Default Behavior

### 3.1 `.windsurfrules` Content Gap

**Current state**: `.windsurfrules` contains excellent rules for:

- Data consistency (C4)
- TypeScript/React patterns
- Linting (C5)
- Git workflow
- CI strategy (C8)
- Pre-commit (C2)
- Prompt engineering (C10)

**Missing**: **No section on Sonar issue resolution workflow**

The file does not tell agents:

1. Where Sonar documentation lives
2. That they should consult it before fixing Sonar issues
3. The lookup workflow: Rule ID → `sonarcloud.md` Quick Lookup → Lesson file

### 3.2 Discovery Problem

Even though `docs/engineering/sonar/sonarcloud.md` has a "Quick Lookup (for AI assistants)" section, agents won't find it because:

1. **No directive to read it**: `.windsurfrules` doesn't mention it
2. **Grep finds too much**: Searching for "S3358" finds 9 matches across 4 files—agents may not prioritize the documentation files
3. **Directory structure not signposted**: Agents don't know `sonar-rules/` and `sonar-lessons/` exist

### 3.3 Control Framework Gap

Looking at the control framework in `quality-system.md`:

| Control                              | Issue                                                           |
| ------------------------------------ | --------------------------------------------------------------- |
| C3 (Synthetic coder operating rules) | Does not include Sonar resolution workflow                      |
| C7 (Static analysis - SonarCloud)    | Defined as "Detect" only, no "Prevent" via documentation lookup |

C7 should have a **preventive** component: "Consult documented lessons before implementing fixes."

---

## 4. Recommendations

### 4.1 Add Sonar Resolution Section to `.windsurfrules`

**Priority**: HIGH  
**Impact**: Directly intercepts default agent behavior  
**Status**: ⚠️ REQUIRES MANUAL EDIT (file is protected)

Add the following section to `.windsurfrules` after the "Pre-commit & Local Verification (C2)" section:

```markdown
---

## SonarCloud Issue Resolution (C7)

### Before fixing any SonarCloud issue

1. **Extract the Rule ID** from the issue (e.g., S3358, S6759)
2. **Consult the Quick Lookup table** in `docs/engineering/sonar/sonarcloud.md`
3. **Read the linked Lesson file** for project-specific fix patterns
4. **Apply the documented pattern**, not a generic fix

### Documentation structure

- **Quick Lookup**: `docs/engineering/sonar/sonarcloud.md` (Rule ID → Lesson mapping)
- **Lessons**: `docs/engineering/sonar/lessons/*.md` (How we fix issues in this codebase)
- **Rules**: `docs/engineering/sonar/rules/*.md` (Links to SonarSource docs)

### If no lesson exists

1. Fix the issue using best practices
2. **Create a new lesson** in `docs/engineering/sonar/lessons/`
3. **Add to Quick Lookup table** in `sonarcloud.md`
4. **Add rule file** in `docs/engineering/sonar/rules/`
```

**Copy-paste location**: Insert after line 129 (after the "Pre-commit & Local Verification" section, before "Prompt Engineering")

### 4.2 Add Rule ID to Branch Name Convention

**Priority**: MEDIUM  
**Impact**: Helps agents recognize Sonar context

Update Git Workflow section in `.windsurfrules`:

```markdown
### Branch naming for Sonar fixes

- `fix/sXXXX-description` (e.g., `fix/s3358-nested-ternary`)
- This signals to the agent: "Look up rule SXXXX in sonarcloud.md first"
```

### 4.3 Improve Quick Lookup Table Visibility

**Priority**: MEDIUM  
**Impact**: Makes lookup more discoverable

The Quick Lookup table in `sonarcloud.md` is good, but could be enhanced:

1. **Add file path column** for direct navigation:

```markdown
| Rule ID | Lesson                    | File                                                                       |
| ------- | ------------------------- | -------------------------------------------------------------------------- |
| S3358   | Extract nested ternary... | `sonar-lessons/extract-nested-ternary-operations-into-helper-functions.md` |
```

2. **Add aliases** for common search terms (already partially done)

### 4.4 Create a Sonar Fix Workflow File

**Priority**: LOW (optional, `.windsurfrules` section is sufficient)  
**Impact**: Provides even more explicit guidance

Create `.windsurf/workflows/fix-sonar-issue.md`:

```markdown
---
description: How to fix a SonarCloud issue
---

1. Extract the Rule ID from the issue (e.g., S3358)
2. Read `docs/architecture/quality/sonarcloud.md` Quick Lookup table
3. Read the linked Lesson file for the specific pattern
4. Apply the documented fix pattern to the file
5. Run `npm run lint -w admin` to verify
6. Commit with message `fix(SXXXX): description`
```

### 4.5 Update Control Framework

**Priority**: MEDIUM  
**Impact**: Aligns governance with operational reality

Update `quality-system.md` C7 to include preventive component:

```markdown
| C7 | Static analysis (SonarCloud) | Detect + **Prevent** | Continuous scanning + **documented lesson lookup before fixing** |
```

---

## 5. Effectiveness Metrics

After implementing recommendations, measure:

| Metric                                  | Target | How to measure                  |
| --------------------------------------- | ------ | ------------------------------- |
| Agent consults sonarcloud.md before fix | 100%   | Observe agent tool calls        |
| Agent cites lesson file in fix          | 100%   | Check PR description references |
| Fix matches documented pattern          | 100%   | Code review                     |
| New issues get new lessons              | 100%   | Check lesson file creation      |

---

## 6. Implementation Checklist

- [ ] Add "SonarCloud Issue Resolution (C7)" section to `.windsurfrules` ⚠️ **MANUAL EDIT REQUIRED** (see Section 4.1)
- [ ] Update branch naming convention for Sonar fixes (optional, in `.windsurfrules`)
- [x] Add file path column to Quick Lookup table — Done in `sonarcloud.md`
- [x] Update C7 in `quality-system.md` control table — Changed to "Detect + Prevent"
- [ ] Create workflow file (optional)
- [ ] Test with free LLM to verify effectiveness

---

## 7. Appendix: Observed Agent Behavior (n=1)

**Request**: "fix the issue [S3358 mentioned in attachment], work uninterruptedly, create PR"

**Actual behavior**:

1. Agent ran `grep_search` for "S3358" across entire codebase
2. Found 9 matches across 4 files (including documentation)
3. Did not prioritize documentation files
4. Did not read `.windsurfrules`
5. Eventually found the fix pattern, but through search-and-discover rather than direct lookup

**Expected behavior** (with effective controls):

1. Agent reads `.windsurfrules` (injected by IDE)
2. Sees "SonarCloud Issue Resolution" section
3. Opens `docs/architecture/quality/sonarcloud.md`
4. Looks up S3358 in Quick Lookup table
5. Reads the linked lesson file
6. Applies documented pattern

**Root cause**: `.windsurfrules` does not contain directive for Sonar issue resolution workflow.
