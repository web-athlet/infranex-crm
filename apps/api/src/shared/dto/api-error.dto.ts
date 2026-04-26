export type ApiErrorDetails = Record<string, unknown>;

export class ApiErrorDto {
  code!: string;
  message!: string;
  requestId!: string;
  details?: ApiErrorDetails;
}
