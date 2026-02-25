/**
 * Supabase Database Types - BOSSNYUMBA
 *
 * Generated type definitions matching our Drizzle schema.
 * In production, regenerate with: npx supabase gen types typescript --project-id <id>
 *
 * These types ensure end-to-end type safety from Supabase to the UI.
 */

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: 'active' | 'suspended' | 'pending' | 'trial' | 'cancelled';
          subscription_tier: 'starter' | 'professional' | 'enterprise' | 'custom';
          primary_email: string;
          primary_phone: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string;
          settings: Record<string, unknown>;
          billing_settings: Record<string, unknown>;
          max_users: number;
          max_properties: number;
          max_units: number;
          current_users: number;
          current_properties: number;
          current_units: number;
          trial_ends_at: string | null;
          created_at: string;
          updated_at: string;
          last_activity_at: string | null;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };

      users: {
        Row: {
          id: string;
          tenant_id: string;
          organization_id: string | null;
          email: string;
          phone: string | null;
          password_hash: string | null;
          first_name: string;
          last_name: string;
          display_name: string | null;
          avatar_url: string | null;
          status: 'pending_activation' | 'active' | 'suspended' | 'deactivated';
          is_owner: boolean;
          mfa_enabled: boolean;
          mfa_secret: string | null;
          failed_login_attempts: number;
          locked_until: string | null;
          password_changed_at: string | null;
          must_change_password: boolean;
          invitation_token: string | null;
          invitation_expires_at: string | null;
          invited_by: string | null;
          last_login_at: string | null;
          last_activity_at: string | null;
          last_login_ip: string | null;
          preferences: Record<string, unknown>;
          timezone: string;
          locale: string;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };

      /**
       * User contexts - enables dynamic roles (same person can be owner AND tenant)
       * This is the key table for the "anyone can be anything" architecture.
       */
      user_contexts: {
        Row: {
          id: string;
          user_id: string;
          auth_uid: string;
          context_type: 'owner' | 'tenant' | 'technician' | 'manager' | 'admin';
          tenant_id: string | null;
          is_active: boolean;
          is_primary: boolean;
          display_name: string | null;
          entity_type: 'individual' | 'company';
          company_name: string | null;
          company_reg_number: string | null;
          enabled_features: string[];
          feature_usage: Record<string, unknown>;
          onboarding_completed: boolean;
          onboarding_step: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_contexts']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_contexts']['Insert']>;
      };

      properties: {
        Row: {
          id: string;
          tenant_id: string;
          owner_id: string;
          property_code: string;
          name: string;
          type: 'apartment_complex' | 'single_family' | 'multi_family' | 'townhouse' | 'commercial' | 'mixed_use' | 'estate' | 'other';
          status: 'draft' | 'active' | 'inactive' | 'under_maintenance' | 'sold' | 'archived';
          description: string | null;
          address_line1: string;
          address_line2: string | null;
          city: string;
          state: string | null;
          postal_code: string | null;
          country: string;
          latitude: string | null;
          longitude: string | null;
          total_units: number;
          occupied_units: number;
          vacant_units: number;
          default_currency: string;
          amenities: unknown[];
          features: Record<string, unknown>;
          manager_id: string | null;
          management_notes: string | null;
          images: unknown[];
          documents: unknown[];
          year_built: number | null;
          acquired_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['properties']['Insert']>;
      };

      units: {
        Row: {
          id: string;
          tenant_id: string;
          property_id: string;
          block_id: string | null;
          unit_code: string;
          name: string;
          type: string;
          status: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'not_available';
          description: string | null;
          floor: number | null;
          building: string | null;
          wing: string | null;
          square_meters: string | null;
          bedrooms: number;
          bathrooms: string;
          base_rent_amount: number;
          base_rent_currency: string;
          deposit_amount: number | null;
          amenities: unknown[];
          features: Record<string, unknown>;
          furnishing: string;
          utilities_included: unknown[];
          images: unknown[];
          floor_plan: string | null;
          current_lease_id: string | null;
          current_customer_id: string | null;
          last_inspection_date: string | null;
          next_inspection_due: string | null;
          inspection_notes: string | null;
          available_from: string | null;
          minimum_lease_term: number | null;
          maximum_lease_term: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['units']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['units']['Insert']>;
      };

      customers: {
        Row: {
          id: string;
          tenant_id: string;
          customer_code: string;
          email: string;
          phone: string;
          alternate_phone: string | null;
          first_name: string;
          last_name: string;
          middle_name: string | null;
          date_of_birth: string | null;
          nationality: string | null;
          occupation: string | null;
          employer: string | null;
          monthly_income: number | null;
          income_currency: string;
          status: 'prospect' | 'applicant' | 'approved' | 'active' | 'former' | 'blacklisted';
          kyc_status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired';
          id_document_type: string | null;
          id_document_number: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          preferred_contact_method: string;
          portal_access_enabled: boolean;
          avatar_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };

      leases: {
        Row: {
          id: string;
          tenant_id: string;
          unit_id: string;
          customer_id: string;
          lease_number: string;
          status: 'draft' | 'pending_approval' | 'active' | 'expired' | 'terminated' | 'renewed';
          type: string;
          start_date: string;
          end_date: string;
          rent_amount: number;
          rent_currency: string;
          deposit_amount: number | null;
          deposit_paid: number | null;
          payment_due_day: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['leases']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['leases']['Insert']>;
      };

      payments: {
        Row: {
          id: string;
          tenant_id: string;
          invoice_id: string | null;
          customer_id: string;
          amount: number;
          currency: string;
          method: string;
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
          reference: string;
          external_reference: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };

      invoices: {
        Row: {
          id: string;
          tenant_id: string;
          number: string;
          customer_id: string;
          lease_id: string | null;
          status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'void';
          type: string;
          period_start: string | null;
          period_end: string | null;
          due_date: string;
          subtotal: number;
          tax: number;
          total: number;
          amount_paid: number;
          amount_due: number;
          currency: string;
          line_items: unknown[];
          paid_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
      };

      work_orders: {
        Row: {
          id: string;
          tenant_id: string;
          unit_id: string;
          property_id: string;
          customer_id: string | null;
          vendor_id: string | null;
          assigned_to: string | null;
          category: string;
          priority: 'low' | 'medium' | 'high' | 'emergency';
          status: 'submitted' | 'triaged' | 'assigned' | 'in_progress' | 'pending_review' | 'completed' | 'cancelled';
          title: string;
          description: string;
          reported_at: string;
          scheduled_at: string | null;
          completed_at: string | null;
          sla_deadline: string | null;
          estimated_cost: number | null;
          actual_cost: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['work_orders']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['work_orders']['Insert']>;
      };

      vendors: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          company_name: string | null;
          email: string | null;
          phone: string;
          categories: string[];
          is_available: boolean;
          rating: number | null;
          completed_jobs: number;
          response_time_hours: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>;
      };

      /** Tracks which features a user has discovered/enabled for progressive UI */
      feature_discovery: {
        Row: {
          id: string;
          user_context_id: string;
          feature_key: string;
          discovered_at: string;
          enabled: boolean;
          usage_count: number;
          last_used_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['feature_discovery']['Row'], 'id' | 'discovered_at'> & {
          id?: string;
          discovered_at?: string;
        };
        Update: Partial<Database['public']['Tables']['feature_discovery']['Insert']>;
      };
    };

    Views: Record<string, never>;

    Functions: {
      get_user_contexts: {
        Args: { p_auth_uid: string };
        Returns: Database['public']['Tables']['user_contexts']['Row'][];
      };
      switch_context: {
        Args: { p_auth_uid: string; p_context_id: string };
        Returns: Database['public']['Tables']['user_contexts']['Row'];
      };
    };

    Enums: {
      tenant_status: 'active' | 'suspended' | 'pending' | 'trial' | 'cancelled';
      subscription_tier: 'starter' | 'professional' | 'enterprise' | 'custom';
      user_status: 'pending_activation' | 'active' | 'suspended' | 'deactivated';
      context_type: 'owner' | 'tenant' | 'technician' | 'manager' | 'admin';
      property_type: 'apartment_complex' | 'single_family' | 'multi_family' | 'townhouse' | 'commercial' | 'mixed_use' | 'estate' | 'other';
      property_status: 'draft' | 'active' | 'inactive' | 'under_maintenance' | 'sold' | 'archived';
      unit_status: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'not_available';
      work_order_priority: 'low' | 'medium' | 'high' | 'emergency';
    };
  };
}
