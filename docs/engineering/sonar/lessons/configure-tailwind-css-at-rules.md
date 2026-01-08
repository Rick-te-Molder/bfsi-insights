# Configure Tailwind CSS At-Rules for SonarCloud

## Rule

S4662 - "@at-rules" should be valid

## Problem

SonarCloud flags Tailwind CSS v4 specific at-rules as unknown:

```css
@import 'tailwindcss';
@plugin '@tailwindcss/typography'; /* Unexpected unknown at-rule "@plugin" */
@theme inline {
  /* Unexpected unknown at-rule "@theme" */
  --color-background: var(--background);
}
```

## Why It Happens

Tailwind CSS v4 introduced new CSS-first configuration using custom at-rules:

- `@plugin` - loads Tailwind plugins directly in CSS
- `@theme` - defines theme values inline

These are valid Tailwind directives but not standard W3C CSS at-rules, so SonarCloud's CSS analyzer flags them.

## Fix

Configure SonarCloud to ignore this rule for `apps/admin/src/app/globals.css` in `sonar-project.properties`:

```properties
sonar.issue.ignore.multicriteria=css1
sonar.issue.ignore.multicriteria.css1.ruleKey=css:S4662
sonar.issue.ignore.multicriteria.css1.resourceKey=apps/admin/src/app/globals.css
```

## Why This Approach

- **Not a code issue**: The CSS is valid for Tailwind CSS v4
- **Build-time processing**: These directives are processed by Tailwind at build time
- **Configuration over suppression**: Using sonar-project.properties is cleaner than inline comments

## Common Tailwind At-Rules to Ignore

| At-Rule     | Purpose                       |
| ----------- | ----------------------------- |
| `@plugin`   | Load Tailwind plugins         |
| `@theme`    | Define theme values inline    |
| `@tailwind` | Include Tailwind layers (v3)  |
| `@apply`    | Apply utility classes (v3/v4) |

## When It Applies

- Projects using Tailwind CSS v4 with CSS-first configuration
- Any CSS file using Tailwind-specific directives

## Related

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- SonarSource CSS Rule S4662
