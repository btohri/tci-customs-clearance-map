import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables.');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header.' }, 401);
    }

    const body = await req.json();
    const action = String(body.action || 'create-user');
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || 'user');

    if (!['create-user', 'reset-password'].includes(action)) {
      return jsonResponse({ error: 'Invalid action.' }, 400);
    }

    if (!email || !password) {
      return jsonResponse({ error: 'Email and password are required.' }, 400);
    }

    if (action === 'create-user' && !['user', 'shipping', 'admin'].includes(role)) {
      return jsonResponse({ error: 'Invalid role.' }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: currentUserData, error: currentUserError } = await userClient.auth.getUser();
    if (currentUserError || !currentUserData.user) {
      return jsonResponse({ error: 'Invalid session.' }, 401);
    }

    const { data: adminRole, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUserData.user.id)
      .maybeSingle();

    if (roleError) throw roleError;
    if (adminRole?.role !== 'admin') {
      return jsonResponse({ error: 'Only admin can manage users.' }, 403);
    }

    if (action === 'reset-password') {
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) throw listError;

      const targetUser = users.users.find((user) => user.email?.toLowerCase() === email);
      if (!targetUser) {
        return jsonResponse({ error: `User email not found: ${email}` }, 404);
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
        password
      });
      if (updateError) throw updateError;

      return jsonResponse({
        user_id: targetUser.id,
        email: targetUser.email,
        updated: true
      });
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createError) throw createError;

    const { error: upsertError } = await adminClient
      .from('user_roles')
      .upsert({ user_id: created.user.id, role }, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    return jsonResponse({
      user_id: created.user.id,
      email: created.user.email,
      role
    });
  } catch (error) {
    return jsonResponse({ error: error.message || 'Unknown error.' }, 500);
  }
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
