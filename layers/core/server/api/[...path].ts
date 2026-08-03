import { defineEventHandler, getHeaders, getRequestURL, type H3Event, proxyRequest, setResponseStatus } from 'h3';
import { StatusCodes } from 'http-status-codes';

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig();

  const path = getRequestURL(event).pathname.replace(/^\/api/, '');
  const headers = getHeaders(event);

  const upstreamBaseUrl = config.apiBaseUrl as string;
  const upstreamUrl = `${upstreamBaseUrl}${path}`;

  try {
    const contentType = headers['content-type'];

    const proxyHeaders: Record<string, string> = {
      'Content-Type': contentType || 'application/json',
      Accept: 'application/json',
    };

    return proxyRequest(event, upstreamUrl, {
      headers: proxyHeaders,
    });
  } catch (error) {
    console.log(error);

    if (error && typeof error === 'object' && 'response' in error) {
      const fetchError = error as { response: Response; data: unknown };

      setResponseStatus(event, fetchError.response.status, fetchError.response.statusText);

      return fetchError.data;
    }

    setResponseStatus(event, StatusCodes.BAD_GATEWAY, 'Bad Gateway');

    return {
      error: 'Proxy Error',
      message: error instanceof Error ? error.message : 'Failed to connect to upstream API',
    };
  }
});
