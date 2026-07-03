export type EnvironmentType = 'live' | 'test';
export interface NombaSuccessResponse<T> {
  success: true;
  statusCode: number;
  data: T;
}

export interface NombaErrorResponse {
  status: false;
  code: string;
  description: string;
}
