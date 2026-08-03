import type { FetchOptions } from 'ofetch';

export const useApi = () => {
  const { $api } = useNuxtApp();

  const request = async <TResponse = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    options?: FetchOptions,
  ): Promise<TResponse> => {
    return await $api<TResponse>(url, {
      ...(options || {}),
      method,
    });
  };

  const get = <TResponse = unknown>(url: string, options?: FetchOptions): Promise<TResponse> =>
    request<TResponse>('GET', url, options);

  const post = <TResponse = unknown>(url: string, options?: FetchOptions): Promise<TResponse> =>
    request<TResponse>('POST', url, options);

  const put = <TResponse = unknown>(url: string, options?: FetchOptions): Promise<TResponse> =>
    request<TResponse>('PUT', url, options);

  const patch = <TResponse = unknown>(url: string, options?: FetchOptions): Promise<TResponse> =>
    request<TResponse>('PATCH', url, options);

  const deleteFn = <TResponse = unknown>(url: string, options?: FetchOptions): Promise<TResponse> =>
    request<TResponse>('DELETE', url, options);

  return {
    get,
    post,
    put,
    patch,
    delete: deleteFn,
  };
};
