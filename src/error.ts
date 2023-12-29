export class SkytableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkytableError';
  }
}

export class SkytableResponseError extends SkytableError {
  constructor(errorCode: number) {
    super(`skytableResponseError errorCode: ${errorCode}`);
    this.name = 'SkytableResponseError';
  }
}

export class SkytablePendingResponseError extends SkytableError {
  constructor(message: string) {
    super(message);
    this.name = 'SkytablePendingResponseError';
  }
}
