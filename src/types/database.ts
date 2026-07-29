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
          tenant_id: string
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
          tenant_id: string
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
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          ordem?: number
          principal?: boolean
          product_id: string
          storage_path: string
          tenant_id: string
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
          quantidade_minima: number
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
          quantidade_minima?: number
          saldo_estoque?: number
          sku?: string | null
          tenant_id: string
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
          quantidade_minima?: number
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
          created_at: string
          descricao: string | null
          destaque: boolean
          id: string
          nome: string
          ordem: number
          slug: string
          tenant_id: string
          unidade_venda: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          category_id: string
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          nome: string
          ordem?: number
          slug: string
          tenant_id: string
          unidade_venda?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          category_id?: string
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          tenant_id?: string
          unidade_venda?: string
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
      store_settings: {
        Row: {
          baixa_estoque_na_reserva: boolean
          created_at: string
          loja_aberta: boolean
          mensagem_loja_fechada: string | null
          minutos_expiracao_reserva: number
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
          minutos_expiracao_reserva?: number
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
          minutos_expiracao_reserva?: number
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
          unidade_venda: string | null
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
    }
    Enums: {
      field_type: "texto" | "numero" | "selecao" | "booleano" | "data"
      stock_mode: "quantitativo" | "disponibilidade"
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
