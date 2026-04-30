export class HTTPError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "HTTPError";
  }
}

export function httpError(
  status: number,
  code: string,
  message: string,
  data?: unknown,
): HTTPError {
  return new HTTPError(status, code, message, data);
}
