export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
  readonly meta?: PaginationMeta;
}

export interface PaginationMeta {
  readonly total: number;
  readonly cursor: string | null;
  readonly has_more: boolean;
  readonly limit: number;
}

export function createSuccessResponse<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return { success: true, data, error: null, ...(meta ? { meta } : {}) };
}

export function createErrorResponse(error: string): ApiResponse<never> {
  return { success: false, data: null, error };
}
