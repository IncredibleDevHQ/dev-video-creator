// Tiny structural JSON-Schema validator for the artefact schemas in this
// folder. ajv in the repo is v6 (draft-07 only — no $defs), and adding ajv v8
// for four schemas is not worth a dependency; this covers the subset the Core
// schemas use: type, properties, required, additionalProperties, items,
// minItems/maxItems, uniqueItems, enum, const, oneOf/anyOf/allOf, if/then,
// local $ref (#/$defs/…), pattern, minimum/maximum/exclusiveMinimum,
// maxLength. Annotation keywords (default, description, readOnly, x-tier)
// are ignored, as are unrecognised keywords.

export type SchemaError = { path: string; message: string }

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const typeOf = (value: unknown): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

const matchesType = (value: unknown, type: unknown): boolean => {
  if (Array.isArray(type)) return type.some(entry => matchesType(value, entry))
  const actual = typeOf(value)
  if (type === 'number') return actual === 'number' || actual === 'integer'
  return actual === type
}

const resolveRef = (ref: string, root: Json): Json | null => {
  if (!ref.startsWith('#/')) return null
  let current: unknown = root
  for (const segment of ref.slice(2).split('/')) {
    if (!isObject(current)) return null
    current = current[segment]
  }
  return isObject(current) ? current : null
}

const unique = (items: unknown[]) => {
  const seen = new Set(items.map(item => JSON.stringify(item)))
  return seen.size === items.length
}

const validateInto = (
  schema: Json,
  value: unknown,
  root: Json,
  path: string,
  errors: SchemaError[],
): void => {
  if (typeof schema.$ref === 'string') {
    const target = resolveRef(schema.$ref, root)
    if (!target) {
      errors.push({ path, message: `unresolvable $ref ${schema.$ref}` })
      return
    }
    validateInto(target, value, root, path, errors)
    return
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push({ path, message: `expected ${JSON.stringify(schema.const)}` })
    return
  }
  if (Array.isArray(schema.enum)) {
    if (!(schema.enum as unknown[]).some(entry => entry === value)) {
      errors.push({ path, message: `expected one of ${(schema.enum as unknown[]).join(', ')}` })
      return
    }
  }
  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    errors.push({
      path,
      message: `expected ${JSON.stringify(schema.type)}, got ${typeOf(value)}`,
    })
    return
  }

  if (isObject(value)) {
    const properties = (schema.properties || {}) as Record<string, Json>
    for (const key of (schema.required as string[] | undefined) || []) {
      if (!(key in value)) errors.push({ path, message: `missing required "${key}"` })
    }
    for (const [key, entry] of Object.entries(value)) {
      if (properties[key]) {
        validateInto(properties[key], entry, root, `${path}.${key}`, errors)
      } else if (schema.additionalProperties === false) {
        errors.push({ path, message: `unexpected property "${key}"` })
      } else if (isObject(schema.additionalProperties)) {
        validateInto(
          schema.additionalProperties as Json,
          entry,
          root,
          `${path}.${key}`,
          errors,
        )
      }
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push({ path, message: `expected at least ${schema.minItems} items` })
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push({ path, message: `expected at most ${schema.maxItems} items` })
    }
    if (schema.uniqueItems === true && !unique(value)) {
      errors.push({ path, message: 'items are not unique' })
    }
    if (isObject(schema.items)) {
      value.forEach((item, index) =>
        validateInto(schema.items as Json, item, root, `${path}[${index}]`, errors),
      )
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push({ path, message: `longer than ${schema.maxLength} chars` })
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, message: `does not match /${schema.pattern}/` })
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push({ path, message: `below minimum ${schema.minimum}` })
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push({ path, message: `above maximum ${schema.maximum}` })
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      errors.push({ path, message: `must be > ${schema.exclusiveMinimum}` })
    }
  }

  for (const [keyword, mode] of [
    ['allOf', 'all'],
    ['anyOf', 'any'],
    ['oneOf', 'one'],
  ] as const) {
    const list = schema[keyword] as Json[] | undefined
    if (!Array.isArray(list)) continue
    const results = list.map(sub => {
      const subErrors: SchemaError[] = []
      validateInto(sub, value, root, path, subErrors)
      return subErrors
    })
    if (mode === 'all') {
      results.forEach(subErrors => errors.push(...subErrors))
    } else if (mode === 'any') {
      if (results.every(subErrors => subErrors.length)) {
        errors.push({ path, message: `matches no ${keyword} branch` })
      }
    } else {
      const passing = results.filter(subErrors => !subErrors.length).length
      if (passing !== 1) {
        errors.push({ path, message: `matches ${passing} oneOf branches (expected exactly 1)` })
      }
    }
  }

  if (isObject(schema.if)) {
    const ifErrors: SchemaError[] = []
    validateInto(schema.if, value, root, path, ifErrors)
    if (!ifErrors.length && isObject(schema.then)) {
      validateInto(schema.then, value, root, path, errors)
    }
  }
}

// Validates `value` against a schema (draft 2020-12 subset) and returns
// path-labelled errors; an empty list means valid.
export const validateSchema = (schema: Json, value: unknown): SchemaError[] => {
  const errors: SchemaError[] = []
  validateInto(schema, value, schema, '$', errors)
  return errors
}
