/**
 * API Key middleware cho n8n integration
 * Key được set trong .env.local: API_SECRET_KEY=your-key-here
 */

export function validateApiKey(req: Request): boolean {
  const key = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
  const validKey = process.env.API_SECRET_KEY;
  if (!validKey) return false; // nếu chưa set key thì chặn hết
  return key === validKey;
}

export function unauthorizedResponse(msg = 'API key không hợp lệ hoặc bị thiếu') {
  return Response.json({ error: msg, hint: 'Thêm header: x-api-key: YOUR_KEY' }, { status: 401 });
}
