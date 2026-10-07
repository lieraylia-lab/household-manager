export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown> | null> {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
