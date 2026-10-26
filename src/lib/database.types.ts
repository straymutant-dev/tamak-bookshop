export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          details_json: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          staff_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          details_json?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          staff_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          details_json?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          staff_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      book_changes: {
        Row: {
          action: string;
          book_id: string;
          changed_at: string;
          changed_by: string | null;
          changes: Json;
          id: string;
          note: string | null;
        };
        Insert: {
          action: string;
          book_id: string;
          changed_at?: string;
          changed_by?: string | null;
          changes?: Json;
          id?: string;
          note?: string | null;
        };
        Update: {
          action?: string;
          book_id?: string;
          changed_at?: string;
          changed_by?: string | null;
          changes?: Json;
          id?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "book_changes_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      books: {
        Row: {
          academic_year: string;
          author: string;
          buying_cost_pesewas: number;
          category: string;
          class_level: Database["public"]["Enums"]["class_grade_level"];
          cover_image_url: string | null;
          status: string;
          last_edited_at: string | null;
          last_edited_by: string | null;
          created_at: string;
          customer_price_pesewas: number;
          damaged_quantity: number;
          id: string;
          is_active: boolean;
          low_stock_threshold: number;
          stock_quantity: number;
          subject: string | null;
          title: string;
          updated_at: string;
          vendor_price_pesewas: number;
        };
        Insert: {
          academic_year?: string;
          author: string;
          buying_cost_pesewas: number;
          category: string;
          class_level?: Database["public"]["Enums"]["class_grade_level"];
          cover_image_url?: string | null;
          status?: string;
          last_edited_at?: string | null;
          last_edited_by?: string | null;
          created_at?: string;
          customer_price_pesewas: number;
          damaged_quantity?: number;
          id?: string;
          is_active?: boolean;
          low_stock_threshold?: number;
          stock_quantity?: number;
          subject?: string | null;
          title: string;
          updated_at?: string;
          vendor_price_pesewas: number;
        };
        Update: {
          academic_year?: string;
          author?: string;
          buying_cost_pesewas?: number;
          category?: string;
          class_level?: Database["public"]["Enums"]["class_grade_level"];
          cover_image_url?: string | null;
          status?: string;
          last_edited_at?: string | null;
          last_edited_by?: string | null;
          created_at?: string;
          customer_price_pesewas?: number;
          damaged_quantity?: number;
          id?: string;
          is_active?: boolean;
          low_stock_threshold?: number;
          stock_quantity?: number;
          subject?: string | null;
          title?: string;
          updated_at?: string;
          vendor_price_pesewas?: number;
        };
        Relationships: [];
      };
      cashier_shifts: {
        Row: {
          actual_closing_cash_pesewas: number | null;
          closed_at: string | null;
          expected_cash_pesewas: number | null;
          expected_credit_pesewas: number | null;
          expected_momo_pesewas: number | null;
          id: string;
          notes: string | null;
          opened_at: string;
          opening_cash_pesewas: number;
          shift_discrepancy_pesewas: number | null;
          staff_id: string;
        };
        Insert: {
          actual_closing_cash_pesewas?: number | null;
          closed_at?: string | null;
          expected_cash_pesewas?: number | null;
          expected_credit_pesewas?: number | null;
          expected_momo_pesewas?: number | null;
          id?: string;
          notes?: string | null;
          opened_at?: string;
          opening_cash_pesewas?: number;
          shift_discrepancy_pesewas?: number | null;
          staff_id: string;
        };
        Update: {
          actual_closing_cash_pesewas?: number | null;
          closed_at?: string | null;
          expected_cash_pesewas?: number | null;
          expected_credit_pesewas?: number | null;
          expected_momo_pesewas?: number | null;
          id?: string;
          notes?: string | null;
          opened_at?: string;
          opening_cash_pesewas?: number;
          shift_discrepancy_pesewas?: number | null;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cashier_shifts_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_repayments: {
        Row: {
          amount_pesewas: number;
          created_at: string;
          id: string;
          notes: string | null;
          payment_method: Database["public"]["Enums"]["pay_method"];
          payment_reference: string | null;
          received_by_staff_id: string;
          vendor_id: string;
        };
        Insert: {
          amount_pesewas: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payment_method: Database["public"]["Enums"]["pay_method"];
          payment_reference?: string | null;
          received_by_staff_id: string;
          vendor_id: string;
        };
        Update: {
          amount_pesewas?: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["pay_method"];
          payment_reference?: string | null;
          received_by_staff_id?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_repayments_received_by_staff_id_fkey";
            columns: ["received_by_staff_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_repayments_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      repayment_requests: {
        Row: {
          amount_pesewas: number;
          contact_phone: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          payment_method: Database["public"]["Enums"]["pay_method"];
          payment_reference: string | null;
          repayment_id: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          vendor_id: string;
        };
        Insert: {
          amount_pesewas: number;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payment_method: Database["public"]["Enums"]["pay_method"];
          payment_reference?: string | null;
          repayment_id?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          vendor_id: string;
        };
        Update: {
          amount_pesewas?: number;
          contact_phone?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payment_method?: Database["public"]["Enums"]["pay_method"];
          payment_reference?: string | null;
          repayment_id?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "repayment_requests_repayment_id_fkey";
            columns: ["repayment_id"];
            isOneToOne: false;
            referencedRelation: "credit_repayments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "repayment_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "repayment_requests_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_accounts: {
        Row: {
          account_name: string;
          account_number: string;
          created_at: string;
          details: string | null;
          id: string;
          is_active: boolean;
          kind: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          account_name: string;
          account_number: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          is_active?: boolean;
          kind: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          account_name?: string;
          account_number?: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      login_attempts: {
        Row: {
          email: string;
          failed_count: number;
          last_attempt_at: string;
          locked_until: string | null;
        };
        Insert: {
          email: string;
          failed_count?: number;
          last_attempt_at?: string;
          locked_until?: string | null;
        };
        Update: {
          email?: string;
          failed_count?: number;
          last_attempt_at?: string;
          locked_until?: string | null;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          book_id: string;
          id: string;
          line_total_pesewas: number;
          order_id: string;
          quantity: number;
          unit_price_pesewas: number;
        };
        Insert: {
          book_id: string;
          id?: string;
          line_total_pesewas: number;
          order_id: string;
          quantity: number;
          unit_price_pesewas: number;
        };
        Update: {
          book_id?: string;
          id?: string;
          line_total_pesewas?: number;
          order_id?: string;
          quantity?: number;
          unit_price_pesewas?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_returns: {
        Row: {
          book_id: string;
          condition: Database["public"]["Enums"]["return_condition"];
          created_at: string;
          id: string;
          notes: string | null;
          order_id: string;
          quantity: number;
          refund_pesewas: number;
          staff_id: string;
        };
        Insert: {
          book_id: string;
          condition: Database["public"]["Enums"]["return_condition"];
          created_at?: string;
          id?: string;
          notes?: string | null;
          order_id: string;
          quantity: number;
          refund_pesewas?: number;
          staff_id: string;
        };
        Update: {
          book_id?: string;
          condition?: Database["public"]["Enums"]["return_condition"];
          created_at?: string;
          id?: string;
          notes?: string | null;
          order_id?: string;
          quantity?: number;
          refund_pesewas?: number;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_returns_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_returns_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_returns_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          cheque_cleared: boolean | null;
          cheque_number: string | null;
          cheque_received_at: string | null;
          customer_notified_at: string | null;
          client_operation_id: string | null;
          contact_name: string | null;
          contact_email: string | null;
          placed_email_sent_at: string | null;
          paid_email_sent_at: string | null;
          contact_phone: string | null;
          created_at: string;
          delivery_address: string | null;
          delivery_notes: string | null;
          discount_pesewas: number;
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          id: string;
          order_number: string;
          order_status: Database["public"]["Enums"]["order_status"];
          order_type: Database["public"]["Enums"]["order_kind"];
          payment_method: Database["public"]["Enums"]["pay_method"];
          payment_reference: string | null;
          payment_reported_at: string | null;
          payment_status: Database["public"]["Enums"]["pay_status"];
          staff_id: string | null;
          subtotal_pesewas: number;
          total_pesewas: number;
          user_id: string | null;
        };
        Insert: {
          cheque_cleared?: boolean | null;
          cheque_number?: string | null;
          cheque_received_at?: string | null;
          customer_notified_at?: string | null;
          client_operation_id?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          placed_email_sent_at?: string | null;
          paid_email_sent_at?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          delivery_address?: string | null;
          delivery_notes?: string | null;
          discount_pesewas?: number;
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"];
          id?: string;
          order_number: string;
          order_status?: Database["public"]["Enums"]["order_status"];
          order_type: Database["public"]["Enums"]["order_kind"];
          payment_method: Database["public"]["Enums"]["pay_method"];
          payment_reference?: string | null;
          payment_reported_at?: string | null;
          payment_status?: Database["public"]["Enums"]["pay_status"];
          staff_id?: string | null;
          subtotal_pesewas: number;
          total_pesewas: number;
          user_id?: string | null;
        };
        Update: {
          cheque_cleared?: boolean | null;
          cheque_number?: string | null;
          cheque_received_at?: string | null;
          customer_notified_at?: string | null;
          client_operation_id?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          placed_email_sent_at?: string | null;
          paid_email_sent_at?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          delivery_address?: string | null;
          delivery_notes?: string | null;
          discount_pesewas?: number;
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"];
          id?: string;
          order_number?: string;
          order_status?: Database["public"]["Enums"]["order_status"];
          order_type?: Database["public"]["Enums"]["order_kind"];
          payment_method?: Database["public"]["Enums"]["pay_method"];
          payment_reference?: string | null;
          payment_reported_at?: string | null;
          payment_status?: Database["public"]["Enums"]["pay_status"];
          staff_id?: string | null;
          subtotal_pesewas?: number;
          total_pesewas?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          business_name: string | null;
          contact_email: string | null;
          created_at: string;
          credit_limit_pesewas: number;
          full_name: string;
          id: string;
          invite_accepted_at: string | null;
          is_super_admin: boolean;
          last_login_at: string | null;
          outstanding_balance_pesewas: number;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
          vendor_status: Database["public"]["Enums"]["vendor_approval"];
        };
        Insert: {
          business_name?: string | null;
          contact_email?: string | null;
          created_at?: string;
          credit_limit_pesewas?: number;
          full_name: string;
          id: string;
          invite_accepted_at?: string | null;
          is_super_admin?: boolean;
          last_login_at?: string | null;
          outstanding_balance_pesewas?: number;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          vendor_status?: Database["public"]["Enums"]["vendor_approval"];
        };
        Update: {
          business_name?: string | null;
          contact_email?: string | null;
          created_at?: string;
          credit_limit_pesewas?: number;
          full_name?: string;
          id?: string;
          invite_accepted_at?: string | null;
          is_super_admin?: boolean;
          last_login_at?: string | null;
          outstanding_balance_pesewas?: number;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          vendor_status?: Database["public"]["Enums"]["vendor_approval"];
        };
        Relationships: [];
      };
      receipt_prints: {
        Row: {
          id: string;
          order_id: string;
          printed_at: string;
          staff_id: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          printed_at?: string;
          staff_id?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          printed_at?: string;
          staff_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipt_prints_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_prints_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      low_stock_count: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      approve_vendor_credit_order: {
        Args: { p_order_id: string; p_fulfillment: Database["public"]["Enums"]["fulfillment_type"] };
        Returns: undefined;
      };
      confirm_repayment_request: {
        Args: {
          p_request_id: string;
          p_amount_pesewas?: number;
          p_method?: Database["public"]["Enums"]["pay_method"];
          p_reference?: string;
          p_cheque_cleared?: boolean;
        };
        Returns: undefined;
      };
      confirm_vendor_order_payment: {
        Args: {
          p_order_id: string;
          p_method: Database["public"]["Enums"]["pay_method"];
          p_reference: string;
          p_fulfillment: Database["public"]["Enums"]["fulfillment_type"];
          p_cheque_cleared?: boolean;
        };
        Returns: undefined;
      };
      record_vendor_repayment: {
        Args: {
          p_vendor_id: string;
          p_amount_pesewas: number;
          p_method: Database["public"]["Enums"]["pay_method"];
          p_reference: string;
          p_notes?: string;
          p_cheque_cleared?: boolean;
        };
        Returns: string;
      };
      bounce_walkin_cheque: { Args: { p_phone: string; p_cheque_number: string; p_note?: string }; Returns: undefined };
      clear_walkin_cheque: { Args: { p_phone: string; p_cheque_number: string }; Returns: number };
      mark_walkin_customer_notified: { Args: { p_phone: string; p_cheque_number: string }; Returns: undefined };
      receive_walkin_cheque: { Args: { p_order_ids: string[]; p_cheque_number: string }; Returns: number };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: undefined };
      report_order_payment: { Args: { p_order_id: string; p_reference: string }; Returns: undefined };
      pos_vendor_sale: {
        Args: {
          p_vendor_id: string | null;
          p_walkin_name: string | null;
          p_walkin_phone: string | null;
          p_items: Json;
          p_method: Database["public"]["Enums"]["pay_method"];
          p_reference?: string;
        };
        Returns: Json;
      };
      sync_pos_sale: {
        Args: {
          p_client_uuid: string;
          p_order_number: string;
          p_sold_at: string;
          p_customer_name: string | null;
          p_method: Database["public"]["Enums"]["pay_method"];
          p_reference: string | null;
          p_items: Json;
        };
        Returns: Json;
      };
      reject_repayment_request: { Args: { p_request_id: string; p_note?: string }; Returns: undefined };
      reject_vendor_order: { Args: { p_order_id: string; p_reason?: string }; Returns: undefined };
      require_staff_or_admin: { Args: Record<PropertyKey, never>; Returns: string };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      decrement_book_stock: { Args: { book_id: string; qty: number }; Returns: undefined };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      class_grade_level:
        | "KG"
        | "Primary 1-3"
        | "Primary 4-6"
        | "JHS 1-3"
        | "SHS 1-3"
        | "Tertiary"
        | "General";
      fulfillment_type: "pickup" | "delivery";
      order_kind: "storefront_client" | "storefront_vendor" | "counter_pos";
      order_status: "pending" | "in_transit" | "completed";
      pay_method: "cash" | "mobile_money" | "bank_transfer" | "credit" | "cheque";
      pay_status: "paid" | "payment_pending" | "credit_pending" | "credit_approved" | "partially_paid";
      return_condition: "resellable" | "damaged";
      user_role: "client" | "vendor" | "staff" | "admin";
      vendor_approval: "not_applicable" | "pending" | "approved" | "rejected" | "frozen";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      class_grade_level: [
        "KG",
        "Primary 1-3",
        "Primary 4-6",
        "JHS 1-3",
        "SHS 1-3",
        "Tertiary",
        "General",
      ],
      fulfillment_type: ["pickup", "delivery"],
      order_kind: ["storefront_client", "storefront_vendor", "counter_pos"],
      order_status: ["pending", "in_transit", "completed"],
      pay_method: ["cash", "mobile_money", "bank_transfer", "credit", "cheque"],
      pay_status: ["paid", "payment_pending", "credit_pending", "credit_approved", "partially_paid"],
      return_condition: ["resellable", "damaged"],
      user_role: ["client", "vendor", "staff", "admin"],
      vendor_approval: ["not_applicable", "pending", "approved", "rejected", "frozen"],
    },
  },
} as const;