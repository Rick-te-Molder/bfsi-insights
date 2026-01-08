# S4662: "@at-rules" should be valid

## Rule Details

- **Rule ID**: S4662
- **Type**: Bug
- **Severity**: Medium
- **Category**: Reliability

## Description

The W3C specifications define valid at-rules. Only official and browser-specific at-rules should be used to get the expected impact in the final rendering.

## Why

Using unknown at-rules can lead to:

- Styles not being applied as expected
- Browser compatibility issues
- Maintenance confusion

## Non-compliant

```css
@encoding "utf-8"; /* Should be @charset */
```

## Compliant

```css
@charset "utf-8";
```

## Configuration

The rule has an `ignoreAtRules` parameter for framework-specific at-rules:

```properties
# In sonar-project.properties
sonar.css.at-rule.S4662.ignoreAtRules=plugin,theme,tailwind,apply
```

Default ignored at-rules include: value, at-root, content, debug, each, else, error, for, function, if, include, mixin, return, warn, while, extend, use, forward, tailwind, apply, layer, container, theme

## Links

- [SonarSource Rule](https://rules.sonarsource.com/css/RSPEC-4662)
- [W3C CSS At-Rules](https://www.w3.org/TR/css-syntax-3/#at-rules)

## Related Lessons

- [configure-tailwind-css-at-rules.md](../lessons/configure-tailwind-css-at-rules.md)
