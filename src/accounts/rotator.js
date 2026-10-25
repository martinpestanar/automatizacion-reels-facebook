import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verifica si han pasado 24 horas desde que la cuenta comenzó a gastar sus créditos
 * para reponer automáticamente los 50 créditos diarios de Google Flow (Rolling 24h Window).
 */
async function autoReset24hRollingWindow(accounts) {
  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  for (const acc of accounts) {
    if (acc.tier === 'pro') continue; // Cuenta Pro tiene cupo mensual / 1000

    // Si la cuenta tiene créditos gastados o está marcada exhausted
    if (acc.daily_credits_used > 0 || acc.status === 'exhausted') {
      const referenceTime = acc.last_reset_at ? new Date(acc.last_reset_at).getTime() : (acc.last_used_at ? new Date(acc.last_used_at).getTime() : 0);
      const elapsed = now - referenceTime;

      if (elapsed >= TWENTY_FOUR_HOURS_MS) {
        console.log(`⏰ [Rolling 24h Reset] Han pasado ${Math.round(elapsed / (1000 * 60 * 60))}h para ${acc.alias} (${acc.email}). Reponiendo 50 créditos...`);
        await supabase
          .from('google_accounts')
          .update({
            daily_credits_used: 0,
            status: 'active',
            last_reset_at: new Date().toISOString()
          })
          .eq('id', acc.id);
        
        acc.daily_credits_used = 0;
        acc.status = 'active';
      }
    }
  }
}

/**
 * Obtiene la siguiente cuenta de Google con créditos disponibles (rotación round-robin)
 * Regla estricta:
 * 1. Comprueba la ventana rodante de 24 horas para cada cuenta. Si ya cumplió 24h, se auto-repone a 50 créditos.
 * 2. Primero agotar todas las cuentas Free (priority: 1) que tengan créditos disponibles (daily_credits_used < daily_credits_total).
 * 3. Solo cuando TODAS las Free estén al tope (o con status != 'active'), pasar a la Pro (priority: 99).
 */
export async function getAvailableAccount() {
  const { data: accounts, error } = await supabase
    .from('google_accounts')
    .select('*')
    .order('priority', { ascending: true })
    .order('daily_credits_used', { ascending: true });

  if (error || !accounts || accounts.length === 0) {
    throw new Error('No hay cuentas de Google registradas en la base de datos.');
  }

  // 1. Ejecutar cálculo de reposición por ventana rodante de 24 horas exactas
  await autoReset24hRollingWindow(accounts);

  // 2. Filtrar cuentas activas con créditos disponibles
  const validAccounts = accounts.filter(acc => acc.status === 'active' && acc.daily_credits_used < acc.daily_credits_total);

  if (validAccounts.length === 0) {
    // Si todas están agotadas, calcular cuándo se repone la más próxima
    let nextAvailableTime = null;
    let nextAccEmail = '';
    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    for (const acc of accounts) {
      if (acc.tier === 'free') {
        const ref = acc.last_reset_at ? new Date(acc.last_reset_at).getTime() : new Date(acc.last_used_at).getTime();
        const availableAt = ref + TWENTY_FOUR_HOURS_MS;
        if (!nextAvailableTime || availableAt < nextAvailableTime) {
          nextAvailableTime = availableAt;
          nextAccEmail = acc.email;
        }
      }
    }

    const waitMins = nextAvailableTime ? Math.max(0, Math.round((nextAvailableTime - now) / 60000)) : 0;
    throw new Error(`Todas las cuentas de Google han alcanzado su límite de créditos. La más próxima (${nextAccEmail}) se repondrá en aprox. ${waitMins} minutos.`);
  }

  // validAccounts ya viene ordenada por priority ascendente (Free primero, Pro al final)
  // y por daily_credits_used ascendente.
  const selected = validAccounts[0];
  console.log(`🎯 Cuenta seleccionada para Render: ${selected.alias} (${selected.tier.toUpperCase()}) | Usados: ${selected.daily_credits_used}/${selected.daily_credits_total}`);
  return selected;
}

/**
 * Incrementa el uso de créditos de una cuenta y la marca agotada si alcanza el tope.
 * Si es el primer crédito que se consume en este ciclo, se fija last_reset_at para iniciar la cuenta de 24 horas exactas.
 */
export async function recordAccountUsage(accountId, creditsCost = 1) {
  const { data: account } = await supabase
    .from('google_accounts')
    .select('daily_credits_used, daily_credits_total, last_reset_at')
    .eq('id', accountId)
    .single();

  if (!account) return;

  const newUsed = account.daily_credits_used + creditsCost;
  const newStatus = newUsed >= account.daily_credits_total ? 'exhausted' : 'active';
  const updates = {
    daily_credits_used: newUsed,
    status: newStatus,
    last_used_at: new Date().toISOString()
  };

  // Si estaba en 0 y comienza a gastar, fijar el inicio de la ventana de 24 horas
  if (account.daily_credits_used === 0) {
    updates.last_reset_at = new Date().toISOString();
  }

  await supabase
    .from('google_accounts')
    .update(updates)
    .eq('id', accountId);
}
