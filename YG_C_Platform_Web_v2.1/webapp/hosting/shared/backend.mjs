import {handle as businessHandle} from './service.mjs';
import {createSupabaseBindings} from './supabase.mjs';

export async function handle(request, env) {
  try {
    const demo = /^\/api\/demo(?:\/|$)/.test(new URL(request.url).pathname);
    if (!demo && env.LIVE_STORAGE === 'supabase') env = {...env, ...createSupabaseBindings(env, env.SUPABASE_FETCH || fetch)};
    return await businessHandle(request, env);
  } catch (error) {
    return Response.json({error: error.status ? error.message : '服务暂时不可用', code: 'STORAGE_UNAVAILABLE'}, {status: error.status || 503, headers: {'Cache-Control': 'no-store'}});
  }
}
