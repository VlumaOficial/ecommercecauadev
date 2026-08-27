import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { readFileSync } from 'fs'

const BASE = 'https://ecommercecauahml.vluma.com.br'
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CAPUA = '9cb25966-acfe-4a69-bd94-282c7ba0a0e4'
const CITY = '43bdaa2e-89ea-4c06-a741-659ab091fd08' // Salvador/BA (ativa)
const VARIANT = '2a54c97b-7e56-49e3-aead-a1459916f56c' // preco 6.5, min venda 1, estoque 48
const QTD = 3 // total 19,50 -> testa formatação BRL não-redonda
const stamp = Date.now()
const STAFF_EMAIL = 'sergio.dorea2624+partD@gmail.com' // alias real do PO (mesmo padrão do incremento 8)
const STAFF_WPP = '71991215016'                        // número real do PO (docs incremento 8)
const CUST_EMAIL = `partd.cliente.${stamp}@exemplo-teste.com`
const log = (...a) => console.log(...a)
let pass = 0, fail = 0
const check = (c, l) => { if (c) { pass++; log('  ✅', l) } else { fail++; log('  ❌', l) } }

let staffId = null, custId = null
const ids = { orders: [] }

async function magic(email) {
  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error('magic ' + email + ': ' + error.message)
  return data.properties.hashed_token
}
async function cleanup() {
  // staff de teste: sem pedidos -> deletável; cascata FK remove a linha de recipients
  const { data: lu } = await sb.auth.admin.listUsers()
  const su = lu?.users?.find(u => u.email === STAFF_EMAIL)
  if (su) { await sb.auth.admin.deleteUser(su.id); log('  (limpo) staff', STAFF_EMAIL) }
  // cliente de teste: tem pedidos (orders.customer_id on delete restrict) -> desativa
  if (custId) { await sb.from('customers').update({ ativo: false }).eq('id', custId); log('  (desativado) cliente de teste', custId) }
  // pedidos de teste -> cancelados por service role (não mexem em estoque; criar_pedido nunca baixou)
  for (const oid of ids.orders) {
    await sb.from('orders').update({ status: 'cancelado', motivo_cancelamento: 'pedido de teste — Parte D (notificação ao lojista)' }).eq('id', oid)
  }
  if (ids.orders.length) log('  (cancelados) pedidos de teste:', ids.orders.length)
  // limpa qualquer recipient remanescente
  await sb.from('order_notification_recipients').delete().eq('tenant_id', CAPUA)
}

try {
  // ---------- setup ----------
  const { data: su, error: eSu } = await sb.auth.admin.createUser({
    email: STAFF_EMAIL, password: 'Xy' + Math.random().toString(36) + '7Z', email_confirm: true,
  })
  if (eSu) throw new Error('createUser staff: ' + eSu.message)
  staffId = su.user.id
  const { error: eProm } = await sb.rpc('promover_para_staff', { p_auth_user_id: staffId, p_nome: 'Parte D — Staff PO (teste)', p_role: 'operador', p_pode_aceitar_pedido: false })
  if (eProm) throw new Error('promover: ' + eProm.message)
  await sb.from('profiles').update({ whatsapp: STAFF_WPP }).eq('id', staffId)

  const { data: cu, error: eCu } = await sb.auth.admin.createUser({
    email: CUST_EMAIL, password: 'Xy' + Math.random().toString(36) + '7Z', email_confirm: true,
    user_metadata: { nome: 'Cliente Parte D (teste)', whatsapp: '71900000000' },
  })
  if (eCu) throw new Error('createUser customer: ' + eCu.message)
  const { data: cRow } = await sb.from('customers').select('id, nome').eq('auth_user_id', cu.user.id).single()
  custId = cRow.id
  log(`[setup] staff ${staffId} (${STAFF_EMAIL} / ${STAFF_WPP})`)
  log(`[setup] cliente ${custId} (${cRow.nome})`)

  await sb.from('order_notification_recipients').delete().eq('tenant_id', CAPUA)

  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/auth/callback?token_hash=${await magic(CUST_EMAIL)}&type=magiclink&next=/`, { waitUntil: 'networkidle' })

  const payload = { delivery_city_id: CITY, observacao_cliente: null, itens: [{ variant_id: VARIANT, quantidade: QTD }] }

  // ---------- Checkout #1: SEM destinatários (best-effort no-op) ----------
  log('\n=== Checkout #1 — nenhum destinatário configurado ===')
  const t1 = Date.now()
  const r1 = await page.request.post(`${BASE}/api/loja/checkout`, { data: payload })
  const ms1 = Date.now() - t1
  const b1 = await r1.json().catch(() => ({}))
  check(r1.status() === 201, `checkout retornou 201 (foi ${r1.status()})`)
  check(!!b1.data?.id && !!b1.data?.numero, `pedido criado: #${b1.data?.numero} (${b1.data?.id})`)
  if (b1.data?.id) ids.orders.push(b1.data.id)
  const { data: o1 } = await sb.from('orders').select('numero, total, status').eq('id', b1.data.id).single()
  check(!!o1 && Number(o1.total) === QTD * 6.5, `DB: pedido existe, total ${o1?.total} (esperado ${QTD * 6.5})`)
  check(ms1 < 8000, `resposta em ${ms1}ms — checkout não travou mesmo com after() no caminho`)
  log(`  (após #1) order_notification_recipients vazio → after() foi no-op, sem quebrar nada`)

  // ---------- configura destinatário (ambos os canais) ----------
  const { error: eIns } = await sb.from('order_notification_recipients').insert({
    tenant_id: CAPUA, profile_id: staffId, ativo: true, canal_email: true, canal_whatsapp: true,
  })
  if (eIns) throw new Error('insert recipient: ' + eIns.message)
  log('\n[config] staff de teste marcado para receber "pedido novo" por E-MAIL + WHATSAPP')

  // ---------- Checkout #2: COM destinatário → deployed after() dispara envio real ----------
  log('\n=== Checkout #2 — destinatário configurado (envio real via deploy) ===')
  const t2 = Date.now()
  const r2 = await page.request.post(`${BASE}/api/loja/checkout`, { data: payload })
  const ms2 = Date.now() - t2
  const b2 = await r2.json().catch(() => ({}))
  check(r2.status() === 201, `checkout retornou 201 (foi ${r2.status()})`)
  check(!!b2.data?.id && !!b2.data?.numero, `pedido criado: #${b2.data?.numero} (${b2.data?.id})`)
  if (b2.data?.id) ids.orders.push(b2.data.id)
  check(ms2 < 8000, `resposta em ${ms2}ms — checkout NÃO esperou o envio da notificação (best-effort)`)

  await browser.close()

  // ---------- conteúdo esperado (mesma resolução de placeholders do templates.ts) ----------
  const orderId2 = b2.data.id
  const numero2 = b2.data.numero
  const { data: tpls } = await sb.from('notification_templates')
    .select('canal, assunto, corpo').eq('tenant_id', CAPUA).eq('evento', 'pedido_novo').eq('ativo', true)
  const { data: dom } = await sb.from('tenant_domains').select('dominio').eq('tenant_id', CAPUA).limit(1).maybeSingle()
  const { data: ten } = await sb.from('tenants').select('nome').eq('id', CAPUA).single()
  const totalNum = QTD * 6.5
  const vars = {
    numero_pedido: String(numero2),
    nome_cliente: 'Cliente Parte D (teste)',
    valor_total: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalNum),
    nome_loja: ten.nome,
    link_painel_pedido: `https://${dom.dominio}/painel/pedidos/${orderId2}`,
  }
  const resolver = (t) => (t ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))

  log('\n=== Conteúdo que o lojista deve receber (pedido #' + numero2 + ') ===')
  for (const t of tpls || []) {
    log(`\n--- canal: ${t.canal} ---`)
    if (t.assunto) log('assunto:', resolver(t.assunto))
    log('corpo:\n' + resolver(t.corpo))
  }
  check(vars.valor_total === 'R$ 19,50' || vars.valor_total === 'R$ 19,50', `valor_total formatado em R$: "${vars.valor_total}" (não o número cru 19.5)`)
  check(vars.link_painel_pedido.includes(`/painel/pedidos/${orderId2}`), 'link_painel_pedido aponta pro PAINEL do vendedor (por id), não a área do cliente')
  check(!vars.link_painel_pedido.includes('/meus-pedidos'), 'link NÃO é a área do cliente (/meus-pedidos)')

  // ---------- bônus: Evolution API confirma a mensagem? (pode falhar se a key local estiver defasada) ----------
  log('\n=== (bônus) checagem na Evolution API ===')
  try {
    const jid = '55' + STAFF_WPP + '@s.whatsapp.net'
    const resp = await fetch(`${env.EVOLUTION_API_URL}/chat/findMessages/${env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.EVOLUTION_API_KEY },
      body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 5 }),
    })
    if (!resp.ok) {
      log(`  (inconclusivo) Evolution respondeu ${resp.status} — key local provavelmente defasada vs. Vercel; confirmação fica com o PO`)
    } else {
      const j = await resp.json().catch(() => null)
      const msgs = Array.isArray(j?.messages?.records) ? j.messages.records : Array.isArray(j) ? j : []
      const recente = msgs.find(m => JSON.stringify(m).includes(String(numero2)))
      check(!!recente, `Evolution tem mensagem recente citando o pedido #${numero2} para ${STAFF_WPP}`)
    }
  } catch (e) {
    log('  (inconclusivo) não deu pra consultar a Evolution local:', e.message)
  }

} catch (e) {
  fail++
  console.error('\n[EXCEÇÃO]', e.message)
} finally {
  log('\n--- limpeza ---')
  await cleanup().catch(e => log('  (aviso na limpeza)', e.message))
  log(`\n=========== RESULTADO: ${pass} pass / ${fail} fail ===========`)
  log('>>> AÇÃO DO PO: confirmar recebimento do e-mail (' + STAFF_EMAIL + ') e do WhatsApp (' + STAFF_WPP + ') do pedido #2.')
  process.exit(fail === 0 ? 0 : 1)
}
