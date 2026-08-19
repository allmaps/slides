import { env } from "$env/dynamic/public";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const isTruthy = (value: string | undefined) =>
  TRUE_VALUES.has(value?.trim().toLowerCase() ?? "");

export const isSingleProjectRootRequested = () =>
  isTruthy(env.PUBLIC_SLIDES_SINGLE_PROJECT_ROOT);
