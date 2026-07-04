export type EnvironmentType = 'live' | 'test';

export interface NombaResponse<T = {}> {
  code: string;
  description: string;
  status: boolean;
  data: T;
}
