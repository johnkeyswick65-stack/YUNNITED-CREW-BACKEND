export async function onRequest(context) {
  const request = context.request;
  const incomingUrl = new URL(request.url);
  const targetUrl =
    'https://yunnited-crew-backend.onrender.com' +
    incomingUrl.pathname +
    incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const realIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  if (realIp) headers.set('x-client-ip', realIp);

  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  });

  const upstream = await fetch(proxyRequest);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-length');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
