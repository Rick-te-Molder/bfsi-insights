# Quality Exceptions Tracker

---

**Version**: 1.0.0  
**Last updated**: 2026-01-04  
**Quality System Control**: C1 (Boy Scout Rule), Section 6.4  
**Change history**:

- 1.0.0 (2026-01-04): Initial empty tracker.

---

This document tracks time-bounded exceptions to quality standards. Exceptions are rare and must be renewed or resolved by their review date.

**Exception policy** (from `docs/architecture/quality-system.md`):

1. Document the exception close to the code AND in this tracker.
2. State the reason (constraint, legacy migration, third-party behavior).
3. Link to a tracking issue for removal.
4. Set a review date. Exceptions expire unless renewed.

**Code annotation format**:

```ts
// QUALITY-EXCEPTION: <control-or-standard-id>
// Reason: <why this cannot meet standard now>
// Review: <YYYY-MM-DD>
// Issue: <KB-XXX>
```

---

## Active Exceptions

| File               | Control/Standard | Reason | Review Date | Issue | Added |
| ------------------ | ---------------- | ------ | ----------- | ----- | ----- |
| _(none currently)_ |                  |        |             |       |       |

---

## Resolved Exceptions

| File         | Control/Standard | Resolution | Resolved Date | PR  |
| ------------ | ---------------- | ---------- | ------------- | --- |
| _(none yet)_ |                  |            |               |     |

---

## How to Add an Exception

1. Add the code annotation to the file (see format above).
2. Add a row to the **Active Exceptions** table with:
   - File path
   - Control ID (e.g., C1, C2) or standard reference
   - Brief reason
   - Review date (typically 1-3 months out)
   - Tracking issue (KB-XXX)
   - Date added
3. Create a tracking issue if one doesn't exist.

## How to Resolve an Exception

1. Remove the code annotation from the file.
2. Move the row from **Active Exceptions** to **Resolved Exceptions**.
3. Fill in the resolution description and PR link.
