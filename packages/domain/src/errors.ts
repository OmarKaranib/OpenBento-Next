export type DomainErrorCode =
  | "unauthenticated"
  | "not_found"
  | "invalid_input";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
