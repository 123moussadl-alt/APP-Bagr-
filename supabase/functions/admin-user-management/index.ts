import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return respond(401, { error: 'Authentication required.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(500, { error: 'Admin function is missing server configuration.' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userResult, error: authError } = await userClient.auth.getUser();
  const actor = userResult.user;
  if (authError || !actor) return respond(401, { error: 'Invalid authentication token.' });
  if (actor.app_metadata?.role !== 'super_admin') {
    return respond(403, { error: 'Administrateur Principal required.' });
  }

  let payload: { action?: string; userId?: string };
  try {
    payload = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }
  if (payload.action !== 'delete' || !payload.userId) {
    return respond(400, { error: 'A delete action and userId are required.' });
  }
  if (payload.userId === actor.id) return respond(400, { error: 'The current account cannot delete itself.' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: targetResult, error: targetError } = await adminClient.auth.admin.getUserById(payload.userId);
  if (targetError || !targetResult.user) return respond(404, { error: 'Account not found.' });
  if (targetResult.user.app_metadata?.role === 'super_admin') {
    return respond(403, { error: 'Principal administrator accounts are protected.' });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(payload.userId);
  if (deleteError) return respond(500, { error: deleteError.message });
  return respond(200, { deleted: true });
});
