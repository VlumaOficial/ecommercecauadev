export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          // prefixo_codigo adicionado na migration 016 (Codigo do Produto).
          // Opcional: vazio ate o lojista salvar a categoria (deriva do
          // nome) ou digitar um proprio. Unico por tenant (indice parcial).
          prefixo_codigo: string | null
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          prefixo_codigo?: string | null
          slug: string
          // tenant_id ganha DEFAULT current_tenant_id() na migration 010;
          // opcional no insert. Ajustado a mao (sem acesso ao projeto pra
          // `npm run types`).
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          prefixo_codigo?: string | null
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      category_attributes: {
        Row: {
          ativo: boolean
          category_id: string
          chave: string
          created_at: string
          id: string
          obrigatorio: boolean
          opcoes: Json | null
          ordem: number
          rotulo: string
          tenant_id: string
          tipo: Database["public"]["Enums"]["field_type"]
          updated_at: string
          usar_em_filtro: boolean
        }
        Insert: {
          ativo?: boolean
          category_id: string
          chave: string
          created_at?: string
          id?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          rotulo: string
          // tenant_id ganha DEFAULT current_tenant_id() na migration 012;
          // opcional no insert. Ajustado a mao (sem acesso ao projeto pra
          // `npm run types`).
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["field_type"]
          updated_at?: string
          usar_em_filtro?: boolean
        }
        Update: {
          ativo?: boolean
          category_id?: string
          chave?: string
          created_at?: string
          id?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          rotulo?: string
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["field_type"]
          updated_at?: string
          usar_em_filtro?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "category_attributes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_attributes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      // Adicionada na migration 016 (Codigo do Produto): contador de
      // sequencia por categoria, usado pela RPC gerar_codigo_produto pra
      // montar PREFIXO-NNNN de forma atomica. tenant_id ganha DEFAULT
      // current_tenant_id() ja na criacao (016), sem gap de isolamento.
      category_code_sequences: {
        Row: {
          category_id: string
          tenant_id: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          category_id: string
          tenant_id?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          tenant_id?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_code_sequences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_code_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          ativo: boolean
          auth_user_id: string
          cidade_entrega: string | null
          created_at: string
          delivery_city_id: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          tenant_id: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          auth_user_id: string
          cidade_entrega?: string | null
          created_at?: string
          delivery_city_id?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          tenant_id: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string
          cidade_entrega?: string | null
          created_at?: string
          delivery_city_id?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          tenant_id?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_delivery_city_id_fkey"
            columns: ["delivery_city_id"]
            isOneToOne: false
            referencedRelation: "delivery_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_cities: {
        Row: {
          ativo: boolean
          created_at: string
          horario: string | null
          id: string
          nome: string
          observacoes: string | null
          ordem: number
          ponto_entrega: string | null
          tenant_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          horario?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          ordem?: number
          ponto_entrega?: string | null
          // tenant_id ganhou DEFAULT current_tenant_id() em 008; opcional no
          // insert. Ajustado a mao (sem acesso ao projeto pra `npm run types`).
          tenant_id?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          horario?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          ordem?: number
          ponto_entrega?: string | null
          tenant_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_cities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      keepalive_ping: {
        Row: {
          ambiente: string
          id: number
          last_ping: string
        }
        Insert: {
          ambiente: string
          id?: number
          last_ping?: string
        }
        Update: {
          ambiente?: string
          id?: number
          last_ping?: string
        }
        Relationships: []
      }
      // Adicionada na migration 024 (Codigo do Produto - modo
      // "automatico" derivado do NOME, decisao #24): contador de
      // sequencia por PREFIXO (nao por categoria nem por produto),
      // usado pela RPC gerar_codigo_produto_por_prefixo.
      product_code_sequences: {
        Row: {
          prefixo: string
          tenant_id: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          prefixo: string
          tenant_id?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          prefixo?: string
          tenant_id?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_code_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_values: {
        Row: {
          attribute_id: string
          created_at: string
          id: string
          product_id: string
          tenant_id: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          attribute_id: string
          created_at?: string
          id?: string
          product_id: string
          // Opcional desde a migration 025 (DEFAULT current_tenant_id()) -
          // mesmo gap ja fechado nas outras tabelas de dominio.
          tenant_id?: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          attribute_id?: string
          created_at?: string
          id?: string
          product_id?: string
          tenant_id?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_values_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "category_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_field_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_field_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          ordem: number
          principal: boolean
          product_id: string
          storage_path: string
          tenant_id: string
          // Adicionado na migration 023 (Produtos Etapa 3): null =
          // imagem do produto (galeria compartilhada); preenchido =
          // imagem especifica de uma variacao. Capa (principal) so
          // pode ser imagem de produto (chk_product_images_capa_so_produto).
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          ordem?: number
          principal?: boolean
          product_id: string
          storage_path: string
          // tenant_id ganhou DEFAULT current_tenant_id() na migration
          // 023 (gap que product_images nunca tinha corrigido, ao
          // contrario de toda outra tabela de dominio); opcional no insert.
          tenant_id?: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          ordem?: number
          principal?: boolean
          product_id?: string
          storage_path?: string
          tenant_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          id: string
          preco_anterior: number | null
          preco_novo: number
          product_id: string
          tenant_id: string
          variant_id: string | null
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          id?: string
          preco_anterior?: number | null
          preco_novo: number
          product_id: string
          tenant_id: string
          variant_id?: string | null
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          id?: string
          preco_anterior?: number | null
          preco_novo?: number
          product_id?: string
          tenant_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          modo_estoque: Database["public"]["Enums"]["stock_mode"]
          nome: string
          ordem: number
          preco: number
          preco_promocional: number | null
          product_id: string
          // Renomeada de "quantidade_minima" + nova coluna
          // "quantidade_minima_venda" na migration 027 (dois minimos
          // distintos - decisao de produto 07/08/2026).
          quantidade_minima_estoque: number
          quantidade_minima_venda: number
          saldo_estoque: number
          sku: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          modo_estoque?: Database["public"]["Enums"]["stock_mode"]
          nome?: string
          ordem?: number
          preco?: number
          preco_promocional?: number | null
          product_id: string
          quantidade_minima_estoque?: number
          quantidade_minima_venda?: number
          saldo_estoque?: number
          sku?: string | null
          // tenant_id ganha DEFAULT current_tenant_id() na migration 015;
          // opcional no insert. Ajustado a mao (sem acesso ao projeto pra
          // `npm run types`).
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          modo_estoque?: Database["public"]["Enums"]["stock_mode"]
          nome?: string
          ordem?: number
          preco?: number
          preco_promocional?: number | null
          product_id?: string
          quantidade_minima_estoque?: number
          quantidade_minima_venda?: number
          saldo_estoque?: number
          sku?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ativo: boolean
          category_id: string
          // codigo/codigo_visivel adicionados na migration 016 (Codigo do
          // Produto). codigo e imutavel apos criado (trigger
          // trg_products_codigo_imutavel) - gerado pela RPC
          // gerar_codigo_produto (automatico) ou digitado (manual). Unico
          // por tenant (indice parcial, aceita null).
          codigo: string | null
          codigo_visivel: boolean
          created_at: string
          descricao: string | null
          destaque: boolean
          id: string
          nome: string
          ordem: number
          slug: string
          tenant_id: string
          // unidade_venda (texto livre) substituida por unidade_venda_id na
          // migration 019/020 (cadastro de Unidades de Venda por tenant) -
          // coluna antiga dropada na 020 (view products_com_status recriada
          // com security_invoker=true, ver comentario no arquivo .sql).
          unidade_venda_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          category_id: string
          codigo?: string | null
          codigo_visivel?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          nome: string
          ordem?: number
          slug: string
          // tenant_id ganha DEFAULT current_tenant_id() na migration 015;
          // opcional no insert. Ajustado a mao (sem acesso ao projeto pra
          // `npm run types`).
          tenant_id?: string
          unidade_venda_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          category_id?: string
          codigo?: string | null
          codigo_visivel?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          tenant_id?: string
          unidade_venda_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unidade_venda_id_fkey"
            columns: ["unidade_venda_id"]
            isOneToOne: false
            referencedRelation: "unidades_venda"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_venda: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          // tenant_id ganha DEFAULT current_tenant_id() desde a criacao
          // (migration 019) - opcional no insert.
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_venda_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          pode_aceitar_pedido: boolean
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id: string
          nome: string
          pode_aceitar_pedido?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          pode_aceitar_pedido?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          id: string
          tenant_id: string
          variant_id: string
          product_id: string
          tipo: Database["public"]["Enums"]["stock_movement_type"]
          quantidade: number
          saldo_anterior: number
          saldo_novo: number
          motivo: string | null
          referencia_tipo: string | null
          referencia_id: string | null
          usuario_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string
          variant_id: string
          product_id: string
          tipo: Database["public"]["Enums"]["stock_movement_type"]
          quantidade: number
          saldo_anterior: number
          saldo_novo: number
          motivo?: string | null
          referencia_tipo?: string | null
          referencia_id?: string | null
          usuario_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          variant_id?: string
          product_id?: string
          tipo?: Database["public"]["Enums"]["stock_movement_type"]
          quantidade?: number
          saldo_anterior?: number
          saldo_novo?: number
          motivo?: string | null
          referencia_tipo?: string | null
          referencia_id?: string | null
          usuario_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          baixa_estoque_na_reserva: boolean
          created_at: string
          loja_aberta: boolean
          mensagem_loja_fechada: string | null
          mensagem_pedidos_fechados: string | null
          minutos_expiracao_reserva: number
          pedidos_abertos: boolean
          permite_autocadastro: boolean
          tenant_id: string
          updated_at: string
          valor_minimo_pedido: number
        }
        Insert: {
          baixa_estoque_na_reserva?: boolean
          created_at?: string
          loja_aberta?: boolean
          mensagem_loja_fechada?: string | null
          mensagem_pedidos_fechados?: string | null
          minutos_expiracao_reserva?: number
          pedidos_abertos?: boolean
          permite_autocadastro?: boolean
          tenant_id: string
          updated_at?: string
          valor_minimo_pedido?: number
        }
        Update: {
          baixa_estoque_na_reserva?: boolean
          created_at?: string
          loja_aberta?: boolean
          mensagem_loja_fechada?: string | null
          mensagem_pedidos_fechados?: string | null
          minutos_expiracao_reserva?: number
          pedidos_abertos?: boolean
          permite_autocadastro?: boolean
          tenant_id?: string
          updated_at?: string
          valor_minimo_pedido?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      products_com_status: {
        Row: {
          ativo: boolean | null
          category_id: string | null
          // categoria_nome, codigo, codigo_visivel adicionados na migration
          // 016 (view recriada com DROP+CREATE - ver comentario no arquivo
          // .sql). categoria_nome vem do join com categories, evita N+1 na
          // listagem do painel.
          categoria_nome: string | null
          codigo: string | null
          codigo_visivel: boolean | null
          created_at: string | null
          descricao: string | null
          destaque: boolean | null
          em_promocao: boolean | null
          esgotado: boolean | null
          estoque_total: number | null
          id: string | null
          nome: string | null
          novidade: boolean | null
          ordem: number | null
          preco_a_partir_de: number | null
          slug: string | null
          tenant_id: string | null
          unidade_venda_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unidade_venda_id_fkey"
            columns: ["unidade_venda_id"]
            isOneToOne: false
            referencedRelation: "unidades_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      set_category_ativo_cascade: {
        Args: { p_category_id: string; p_ativo: boolean }
        Returns: undefined
      }
      // Adicionadas na migration 016 (Codigo do Produto).
      gerar_codigo_produto: {
        Args: { p_category_id: string }
        Returns: string
      }
      // Adicionada na migration 024 (modo "automatico" derivado do
      // NOME do produto, decisao #24) - recebe o prefixo ja derivado
      // em TypeScript (derivarPrefixo), so reserva o proximo numero.
      gerar_codigo_produto_por_prefixo: {
        Args: { p_prefixo: string }
        Returns: string
      }
      // p_caracteristicas adicionado na migration 025 (Etapa 2,
      // Caracteristicas) - opcional, default '[]'::jsonb no banco.
      criar_produto_com_variacoes: {
        Args: { p_produto: Json; p_variacoes: Json; p_caracteristicas?: Json }
        Returns: Database["public"]["Tables"]["products"]["Row"]
      }
      // Adicionada na migration 017. p_caracteristicas adicionado na 025.
      atualizar_produto_com_variacoes: {
        Args: { p_product_id: string; p_produto: Json; p_variacoes: Json; p_caracteristicas?: Json }
        Returns: Database["public"]["Tables"]["products"]["Row"]
      }
      // Adicionada na migration 021 (modulo de Estoque). p_quantidade
      // (delta assinado) OU p_saldo_novo_desejado (so pra tipo=ajuste,
      // a funcao calcula o delta) - nunca os dois.
      registrar_movimentacao_estoque: {
        Args: {
          p_variant_id: string
          p_tipo: Database["public"]["Enums"]["stock_movement_type"]
          p_quantidade?: number | null
          p_saldo_novo_desejado?: number | null
          p_motivo?: string | null
          p_referencia_tipo?: string | null
          p_referencia_id?: string | null
        }
        Returns: Database["public"]["Tables"]["stock_movements"]["Row"]
      }
      // Adicionada na migration 023 (Produtos Etapa 3 - Imagens). So
      // aceita imagem de PRODUTO (variant_id null) - recusa imagem de
      // variacao.
      definir_imagem_principal: {
        Args: { p_image_id: string }
        Returns: undefined
      }
      // Adicionadas na migration 028 (Vitrine Fase 0 - tenant publico
      // por host). SECURITY DEFINER, grant pra anon/authenticated -
      // usadas pela Vitrine ((loja)/**), nunca pelo painel.
      resolve_tenant_by_host: {
        Args: { p_host: string }
        Returns: { tenant_id: string; slug: string }[]
      }
      get_public_store_settings: {
        Args: { p_tenant_slug: string }
        Returns: {
          nome: string
          loja_aberta: boolean
          pedidos_abertos: boolean
          mensagem_loja_fechada: string | null
          mensagem_pedidos_fechados: string | null
          valor_minimo_pedido: number
          // Vitrine Fase 1 Etapa 3 (migration 030) - ver src/lib/loja/rpc.ts
          // pros defaults usados enquanto a migration nao estiver aplicada.
          banner_titulo: string
          banner_subtitulo: string
          banner_botao_texto: string
          banner_botao_href: string
          banner_tipo_fundo: string
          banner_cor_fundo: string
          banner_imagem_path: string | null
          selos: Json
          whatsapp_numero: string | null
          whatsapp_mensagem: string
          cor_principal: string
        }[]
      }
      get_public_categories: {
        Args: { p_tenant_slug: string }
        Returns: { id: string; nome: string; slug: string; parent_id: string | null; ordem: number }[]
      }
      get_public_products: {
        Args: { p_tenant_slug: string; p_category_id?: string | null }
        Returns: {
          id: string
          nome: string
          slug: string
          descricao: string | null
          category_id: string
          destaque: boolean
          novidade: boolean
          em_promocao: boolean
          esgotado: boolean
          preco_a_partir_de: number | null
          // preco_varia: migration 029 - true quando ha variacoes
          // ativas com preco base diferente entre si (nao considera
          // promocional). UI so mostra "a partir de" quando true.
          preco_varia: boolean
          codigo: string | null
          imagem_principal: string | null
          unidade_venda: string
        }[]
      }
      // Retorna jsonb (nao um Row tipado) - a RPC monta o objeto
      // inteiro (imagens/caracteristicas/variacoes aninhadas) via
      // jsonb_build_object no banco. Ver ProdutoDetalhe em
      // src/lib/loja/types.ts pro shape usado no app.
      get_public_product_detail: {
        Args: { p_tenant_slug: string; p_slug: string }
        Returns: Json
      }
    }
    Enums: {
      field_type: "texto" | "numero" | "selecao" | "booleano" | "data"
      stock_mode: "quantitativo" | "disponibilidade"
      // Adicionado na migration 021 (modulo de Estoque).
      stock_movement_type: "entrada" | "saida" | "ajuste" | "inventario" | "devolucao"
      user_role: "admin" | "operador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      field_type: ["texto", "numero", "selecao", "booleano", "data"],
      stock_mode: ["quantitativo", "disponibilidade"],
      user_role: ["admin", "operador"],
    },
  },
} as const
