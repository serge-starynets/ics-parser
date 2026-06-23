import ICAL from 'ical.js';
import type { IcsComponentJson, IcsPropertyJson } from './types.ts';

type JCalComponent = [string, JCalProperty[], JCalComponent[]];
type JCalProperty = [string, Record<string, string | string[]>, string, ...unknown[]];

const icalValueTypes = ICAL.design.icalendar.value;

function normalizeParameters(
  params: Record<string, string | string[]>,
): Record<string, string | string[]> {
  const normalized: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(params)) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
}

function serializeSingleValue(type: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  switch (type) {
    case 'recur':
      return serializeRecur(value);
    case 'period':
      return serializePeriod(value);
    case 'duration':
      return serializeDuration(value);
    case 'date':
    case 'date-time':
    case 'text':
    case 'uri':
    case 'cal-address':
    case 'integer':
    case 'float':
    case 'boolean':
    case 'binary':
    case 'unknown':
      return value;
    case 'utc-offset':
      return serializeUtcOffset(value);
    case 'geo':
      return serializeGeo(value);
    default:
      if (typeof value === 'object') {
        return serializeStructuredValue(value);
      }
      return value;
  }
}

function serializeRecur(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    return icalValueTypes.recur.toICAL(value as Record<string, unknown>);
  }

  return String(value);
}

function serializePeriod(value: unknown): string | string[] {
  if (typeof value === 'string') {
    return value;
  }

  if (!Array.isArray(value)) {
    return String(value);
  }

  return icalValueTypes.period.toICAL(
    value.map((part) => serializeSingleValue(inferPeriodPartType(part), part)),
  );
}

function inferPeriodPartType(part: unknown): string {
  if (typeof part === 'string' && /^P/i.test(part)) {
    return 'duration';
  }

  if (typeof part === 'string' && part.includes('T')) {
    return 'date-time';
  }

  if (typeof part === 'string') {
    return 'date';
  }

  return 'unknown';
}

function serializeToString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return String((value as { toString: () => string }).toString());
  }

  return String(value);
}

function serializeDuration(value: unknown): string {
  return serializeToString(value);
}

function serializeUtcOffset(value: unknown): string {
  return serializeToString(value);
}

function serializeGeo(value: unknown): number[] | unknown {
  if (Array.isArray(value)) {
    return value.map((part) => (typeof part === 'number' ? part : Number(part)));
  }

  return value;
}

function serializeStructuredValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'object' && item !== null
        ? serializeStructuredValue(item)
        : item,
    );
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serializeStructuredValue(entry);
    }
    return result;
  }

  return value;
}

function jcalPropertyToJson(property: JCalProperty): IcsPropertyJson {
  const [name, parameters, type, ...values] = property;

  return {
    name,
    type,
    parameters: normalizeParameters(parameters),
    value: serializeSingleValue(type, values.length === 1 ? values[0] : values),
  };
}

export function jcalToJson(component: JCalComponent): IcsComponentJson {
  const [componentName, properties, subcomponents] = component;

  return {
    component: componentName,
    properties: properties.map((property) => jcalPropertyToJson(property)),
    components: subcomponents.map((subcomponent) => jcalToJson(subcomponent)),
  };
}

function isJCalComponent(value: unknown): value is JCalComponent {
  return (
    Array.isArray(value) &&
    typeof value[0] === 'string' &&
    Array.isArray(value[1]) &&
    Array.isArray(value[2])
  );
}

export function jcalArrayToJson(parsed: JCalComponent | JCalComponent[]): IcsComponentJson[] {
  if (isJCalComponent(parsed)) {
    return [jcalToJson(parsed)];
  }

  return parsed.map((component) => jcalToJson(component));
}
