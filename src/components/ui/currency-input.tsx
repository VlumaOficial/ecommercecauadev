'use client'

import { forwardRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'

function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Mascara de moeda (Real): usuario so digita numeros, cada digito
// entra como centavo, preenchendo da direita pra esquerda (padrao de
// mascara monetaria) - nunca chega a mostrar "0" como valor de
// verdade (campo vazio fica vazio, so o placeholder mostra "R$ 0,00")
// nem zero a esquerda sobrevive (sempre normalizado antes de formatar).
export const CurrencyInput = forwardRef<
  HTMLInputElement,
  {
    value: number | ''
    onChange: (value: number | '') => void
    onBlur?: () => void
    id?: string
    'aria-invalid'?: boolean
    placeholder?: string
  }
>(function CurrencyInput({ value, onChange, onBlur, id, placeholder, ...props }, ref) {
  const centavosDoValor = value === '' ? 0 : Math.round(value * 100)
  const [digitos, setDigitos] = useState(String(centavosDoValor))

  // Sincroniza quando o valor muda por fora (reset do form, edicao
  // carregando dados existentes) - nao só na digitação local.
  useEffect(() => {
    setDigitos(String(value === '' ? 0 : Math.round(value * 100)))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const somenteDigitos = e.target.value.replace(/\D/g, '')
    const semZerosEsquerda = somenteDigitos.replace(/^0+(?=\d)/, '') || '0'
    setDigitos(semZerosEsquerda)
    const centavos = parseInt(semZerosEsquerda, 10)
    onChange(centavos === 0 ? '' : centavos / 100)
  }

  const centavosAtuais = parseInt(digitos, 10)
  const exibido = centavosAtuais === 0 ? '' : formatarCentavos(centavosAtuais)

  return (
    <Input
      ref={ref}
      id={id}
      inputMode="numeric"
      value={exibido}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder ?? 'R$ 0,00'}
      {...props}
    />
  )
})
