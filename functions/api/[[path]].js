export async function onRequest(context) {
  const request = context.request;
  const incomingUrl = new URL(request.url);

  const targetUrl =
    'https://yunnited-crew-backend.onrender.com' +
    incomingUrl.pathname +
    incomingUrl.search;

  const headers = new Headers(request.headers);

  // Não encaminhar cabeçalhos específicos do domínio de origem.
  headers.delete('host');

  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method)
      ? undefined
      : request.body,
    redirect: 'manual'
  });

  const upstreamResponse = await fetch(proxyRequest);

  // Preservar o JSON, os códigos HTTP e os cookies da sessão.
  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('content-length');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders
  });
}
