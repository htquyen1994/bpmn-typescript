import type { ValidationRule, ValidationErrors, CustomPropertyConfig } from './types.js';

// ── Strategy interface ────────────────────────────────────────────────────────

/**
 * Strategy pattern — each implementation validates one concern of a field value.
 * Compose multiple strategies inside ValidationEngine to build a full ruleset.
 */
export interface IValidationStrategy {
  /** Return an error message string if invalid, null if valid. */
  validate(
    value: unknown,
    rule: ValidationRule,
    config: CustomPropertyConfig,
  ): string | null;
}

// ── Concrete strategies ───────────────────────────────────────────────────────

class RequiredStrategy implements IValidationStrategy {
  validate(value: unknown, rule: ValidationRule): string | null {
    if (!rule.required) return null;
    const empty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '');
    return empty ? 'This field is required.' : null;
  }
}

class PatternStrategy implements IValidationStrategy {
  validate(value: unknown, rule: ValidationRule): string | null {
    if (!rule.pattern || typeof value !== 'string' || value === '') return null;
    const regex =
      rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
    return regex.test(value) ? null : 'Value does not match the required format.';
  }
}

class MinMaxStrategy implements IValidationStrategy {
  validate(value: unknown, rule: ValidationRule): string | null {
    if (rule.min === undefined && rule.max === undefined) return null;
    const num =
      typeof value === 'number' ? value :
      typeof value === 'string' ? parseFloat(value) : NaN;
    if (isNaN(num)) return null;
    if (rule.min !== undefined && num < rule.min)
      return `Value must be at least ${rule.min}.`;
    if (rule.max !== undefined && num > rule.max)
      return `Value must be at most ${rule.max}.`;
    return null;
  }
}

class LengthStrategy implements IValidationStrategy {
  validate(value: unknown, rule: ValidationRule): string | null {
    if (typeof value !== 'string') return null;
    if (rule.minLength !== undefined && value.length < rule.minLength)
      return `Must be at least ${rule.minLength} characters.`;
    if (rule.maxLength !== undefined && value.length > rule.maxLength)
      return `Must be at most ${rule.maxLength} characters.`;
    return null;
  }
}

class CustomStrategy implements IValidationStrategy {
  validate(value: unknown, rule: ValidationRule): string | null {
    return rule.custom ? rule.custom(value) : null;
  }
}

// ── Validation engine ─────────────────────────────────────────────────────────

/**
 * Composes IValidationStrategy instances.
 *
 * - Runs all strategies and collects every error (not just the first).
 * - Additional strategies can be injected at runtime via `addStrategy()`.
 */
export class ValidationEngine {
  private readonly strategies: IValidationStrategy[] = [
    new RequiredStrategy(),
    new PatternStrategy(),
    new MinMaxStrategy(),
    new LengthStrategy(),
    new CustomStrategy(),
  ];

  /** Append a custom strategy to the pipeline. */
  addStrategy(strategy: IValidationStrategy): void {
    this.strategies.push(strategy);
  }

  /** Validate one value against one rule set. Returns all error messages. */
  validate(
    value: unknown,
    rule: ValidationRule,
    config: CustomPropertyConfig,
  ): string[] {
    return this.strategies
      .map(s => s.validate(value, rule, config))
      .filter((msg): msg is string => msg !== null);
  }

  /**
   * Validate every config in the array against the provided values map.
   * Returns only entries that have at least one error.
   */
  validateAll(
    configs: CustomPropertyConfig[],
    values: Record<string, unknown>,
  ): ValidationErrors {
    const errors: ValidationErrors = {};
    for (const cfg of configs) {
      if (!cfg.validation) continue;
      const msgs = this.validate(values[cfg.key], cfg.validation, cfg);
      if (msgs.length) errors[cfg.key] = msgs;
    }
    return errors;
  }
}
