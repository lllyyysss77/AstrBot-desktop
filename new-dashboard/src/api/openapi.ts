import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { readAuthToken } from '@/auth/storage';
import {
  ApiError,
  expireUnauthorizedSession,
  readApiErrorMessage,
} from '@/api/http';
import { client } from '@/api/generated/openapi-v1/sdk.gen';

type OpenApiClientOptions = {
  onUnauthorized?: () => void;
  storage?: Storage | null;
};

function setHeader(
  headers: InternalAxiosRequestConfig['headers'],
  key: string,
  value: string,
) {
  if (typeof headers.set === 'function') headers.set(key, value);
  else headers[key] = value;
}

export function createOpenApiAxiosClient({
  onUnauthorized,
  storage = typeof window === 'undefined' ? null : window.localStorage,
}: OpenApiClientOptions = {}): AxiosInstance {
  const instance = axios.create();
  instance.interceptors.request.use((config) => {
    const token = readAuthToken(storage);
    const locale = storage?.getItem('astrbot-locale');
    if (token && !config.headers.has('Authorization')) {
      setHeader(config.headers, 'Authorization', `Bearer ${token}`);
    }
    if (locale && !config.headers.has('Accept-Language')) {
      setHeader(config.headers, 'Accept-Language', locale);
    }
    return config;
  });
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const status = error.response?.status ?? 0;
      const path = error.config?.url ?? '';
      expireUnauthorizedSession(path, status, storage, onUnauthorized);
      return Promise.reject(new ApiError(
        readApiErrorMessage(error.response?.data, error.message),
        status,
        error.response?.data,
      ));
    },
  );
  return instance;
}

export const openApiAxiosClient = createOpenApiAxiosClient();

client.setConfig({
  // The generated 0.60 client accepts AxiosInstance at runtime but types this
  // compatibility option as AxiosStatic.
  axios: openApiAxiosClient as typeof axios,
  throwOnError: true,
});

export * from '@/api/generated/openapi-v1';
