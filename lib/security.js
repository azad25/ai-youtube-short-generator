export function isAuthorized(request, environment) {
  const token = environment.APP_API_TOKEN;
  return !token || request.headers.authorization === `Bearer ${token}`;
}

export function safeFilename(name) {
  return String(name).replace(/\.{2,}/g, '').replace(/[^a-z0-9._-]/gi, '_').replace(/^[_\.]+/, '').slice(0, 120) || 'asset';
}
