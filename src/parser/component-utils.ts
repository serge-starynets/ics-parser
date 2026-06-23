import type { IcsComponentJson, IcsPropertyJson } from './types.ts';

export function findProperty(
  component: IcsComponentJson,
  name: string,
): IcsPropertyJson | undefined {
  return component.properties.find((property) => property.name === name);
}

export function findComponents(
  component: IcsComponentJson,
  componentName: string,
): IcsComponentJson[] {
  return component.components.filter((child) => child.component === componentName);
}
