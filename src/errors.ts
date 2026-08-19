export const EXIT = {
  success: 0,
  input: 2,
  redaction: 3,
  render: 4,
  conflict: 5,
  interrupted: 130,
} as const;

export class ShowcaseError extends Error {
  public constructor(
    message: string,
    public readonly exitCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ShowcaseError";
  }
}

export function asShowcaseError(error: unknown): ShowcaseError {
  if (error instanceof ShowcaseError) return error;
  return new ShowcaseError(
    error instanceof Error ? error.message : String(error),
    EXIT.render,
    {
      cause: error,
    },
  );
}
