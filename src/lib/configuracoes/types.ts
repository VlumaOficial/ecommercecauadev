// Item (4) da sequencia pre-incremento 8 (ESCOPO_PROJETO.md §0 item
// 49/50) - modulo de Configuracao do painel. 4 grupos de campos de
// store_settings sem tela ate agora: Status da loja, Cadastro, Pedido
// minimo, Cancelamento automatico. Fora de escopo de proposito:
// baixa_estoque_na_reserva/minutos_expiracao_reserva (pertencem ao
// Fluxo B - reserva desde o carrinho - ainda nao implementado) e os
// campos de identidade/banner/selos/whatsapp (ja tem tela propria em
// /painel/vitrine).
export type ConfiguracoesCampos = {
  loja_aberta: boolean
  mensagem_loja_fechada: string
  pedidos_abertos: boolean
  mensagem_pedidos_fechados: string
  permite_autocadastro: boolean
  valor_minimo_pedido_habilitado: boolean
  valor_minimo_pedido: number
  cancelamento_automatico_habilitado: boolean
  prazo_cancelamento_automatico_horas: number
}
