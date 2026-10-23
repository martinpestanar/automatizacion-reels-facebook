import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Obtiene la siguiente cuenta de Google con créditos disponibles (rotación round-robin)
 * Regla estricta:
 * 1. Primero agotar todas las cuentas Free (priority: 1) que tengan créditos disponibles (daily_credits_used < daily_credits_total).
 * 2. Solo cuando TODAS las Free estén al tope (o con status != 'active'), pasar a la Pro (priority: 99).
 */
export async function getAvailableAccount() {
  const { data: accounts, error } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: true })
    .order('daily_credits_used', { ascending: true });

  if (error || !accounts || accounts.length === 0) {
    throw new Error('No hay cuentas de Google activas disponibles.');
  }

  // Filtrar cuentas que realmente tengan créditos restantes hoy
  const validAccounts = accounts.filter(acc => acc.daily_credits_used < acc.daily_credits_total);

  if (validAccounts.length === 0) {
    // Si todas superaron su límite total
    throw new Error('Todas las cuentas de Google han alcanzado su límite de créditos de hoy.');
  }

  // validAccounts ya viene ordenada por priority ascendente (Free primero, Pro al final)
  // y por daily_credits_used ascendente (la que menos ha gastado dentro del mismo nivel).
  const selected = validAccounts[0];
  console.log(`🎯 Cuenta seleccionada para Render: ${selected.alias} (${selected.tier.toUpperCase()}) | Usados: ${selected.daily_credits_used}/${selected.daily_credits_total}`);
  return selected;
}

/**
 * Incrementa el uso de créditos de una cuenta y la marca agotada si alcanza el tope
 */
export async function recordAccountUsage(accountId, creditsCost = 1) {
  const { data: account } = await supabase
    .from('google_accounts')
    .select('daily_credits_used, daily_credits_total')
    .eq('id', accountId)
    .single();

  if (!account) return;

  const newUsed = account.daily_credits_used + creditsCost;
  const newStatus = newUsed >= account.daily_credits_total ? 'exhausted' : 'active';

  await supabase
    .from('google_accounts')
    .update({
      daily_credits_used: newUsed,
      status: newStatus,
      last_used_at: new Date().toISOString()
    })
    .eq('id', accountId);
}
