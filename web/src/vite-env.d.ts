/// <reference types="vite/client" />
/// <reference path="../../renderer/vite-env.d.ts" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

export type RegisterInput = {
  nome: string
  nomeEmpresa: string
  cnpj: string
  email: string
  senha: string
  /** Telefone da empresa (somente dígitos ou formatado) */
  telefone?: string
}
