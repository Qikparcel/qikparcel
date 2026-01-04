/**
 * Database Types for QikParcel MVP
 * Generated from Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          phone_number: string
          full_name: string | null
          role: 'sender' | 'courier' | 'admin'
          whatsapp_number: string | null
          address: string | null
          street_address: string | null
          address_line_2: string | null
          city: string | null
          state: string | null
          postcode: string | null
          country: string | null
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone_number: string
          full_name?: string | null
          role: 'sender' | 'courier' | 'admin'
          whatsapp_number?: string | null
          address?: string | null
          street_address?: string | null
          address_line_2?: string | null
          city?: string | null
          state?: string | null
          postcode?: string | null
          country?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          full_name?: string | null
          role?: 'sender' | 'courier' | 'admin'
          whatsapp_number?: string | null
          address?: string | null
          street_address?: string | null
          address_line_2?: string | null
          city?: string | null
          state?: string | null
          postcode?: string | null
          country?: string | null
          email?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      parcels: {
        Row: {
          id: string
          sender_id: string
          pickup_address: string
          pickup_latitude: number | null
          pickup_longitude: number | null
          delivery_address: string
          delivery_latitude: number | null
          delivery_longitude: number | null
          description: string | null
          weight_kg: number | null
          dimensions: string | null
          estimated_value: number | null
          status: 'pending' | 'matched' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
          matched_trip_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          pickup_address: string
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          delivery_address: string
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          description?: string | null
          weight_kg?: number | null
          dimensions?: string | null
          estimated_value?: number | null
          status?: 'pending' | 'matched' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
          matched_trip_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          pickup_address?: string
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          delivery_address?: string
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          description?: string | null
          weight_kg?: number | null
          dimensions?: string | null
          estimated_value?: number | null
          status?: 'pending' | 'matched' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
          matched_trip_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          courier_id: string
          origin_address: string
          origin_latitude: number | null
          origin_longitude: number | null
          destination_address: string
          destination_latitude: number | null
          destination_longitude: number | null
          departure_time: string | null
          estimated_arrival: string | null
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          available_capacity: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          courier_id: string
          origin_address: string
          origin_latitude?: number | null
          origin_longitude?: number | null
          destination_address: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          departure_time?: string | null
          estimated_arrival?: string | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          available_capacity?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          courier_id?: string
          origin_address?: string
          origin_latitude?: number | null
          origin_longitude?: number | null
          destination_address?: string
          destination_latitude?: number | null
          destination_longitude?: number | null
          departure_time?: string | null
          estimated_arrival?: string | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          available_capacity?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      parcel_trip_matches: {
        Row: {
          id: string
          parcel_id: string
          trip_id: string
          match_score: number | null
          status: 'pending' | 'accepted' | 'rejected' | 'expired'
          matched_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          parcel_id: string
          trip_id: string
          match_score?: number | null
          status?: 'pending' | 'accepted' | 'rejected' | 'expired'
          matched_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          parcel_id?: string
          trip_id?: string
          match_score?: number | null
          status?: 'pending' | 'accepted' | 'rejected' | 'expired'
          matched_at?: string
          accepted_at?: string | null
        }
      }
      message_threads: {
        Row: {
          id: string
          parcel_id: string | null
          sender_phone: string
          courier_phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parcel_id?: string | null
          sender_phone: string
          courier_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parcel_id?: string | null
          sender_phone?: string
          courier_phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          thread_id: string
          whatsapp_message_id: string | null
          from_phone: string
          to_phone: string
          message_text: string | null
          message_type: 'text' | 'image' | 'document' | 'location'
          direction: 'inbound' | 'outbound'
          status: 'sent' | 'delivered' | 'read' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          whatsapp_message_id?: string | null
          from_phone: string
          to_phone: string
          message_text?: string | null
          message_type?: 'text' | 'image' | 'document' | 'location'
          direction: 'inbound' | 'outbound'
          status?: 'sent' | 'delivered' | 'read' | 'failed'
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          whatsapp_message_id?: string | null
          from_phone?: string
          to_phone?: string
          message_text?: string | null
          message_type?: 'text' | 'image' | 'document' | 'location'
          direction?: 'inbound' | 'outbound'
          status?: 'sent' | 'delivered' | 'read' | 'failed'
          created_at?: string
        }
      }
      courier_kyc: {
        Row: {
          id: string
          courier_id: string
          id_document_url: string | null
          id_document_type: string | null
          verification_status: 'pending' | 'approved' | 'rejected'
          verified_by: string | null
          verified_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          courier_id: string
          id_document_url?: string | null
          id_document_type?: string | null
          verification_status?: 'pending' | 'approved' | 'rejected'
          verified_by?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          courier_id?: string
          id_document_url?: string | null
          id_document_type?: string | null
          verification_status?: 'pending' | 'approved' | 'rejected'
          verified_by?: string | null
          verified_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      disputes: {
        Row: {
          id: string
          parcel_id: string
          raised_by: string
          dispute_type: 'damage' | 'delay' | 'lost' | 'wrong_delivery' | 'other'
          description: string
          status: 'open' | 'investigating' | 'resolved' | 'closed'
          resolved_by: string | null
          resolved_at: string | null
          resolution_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parcel_id: string
          raised_by: string
          dispute_type: 'damage' | 'delay' | 'lost' | 'wrong_delivery' | 'other'
          description: string
          status?: 'open' | 'investigating' | 'resolved' | 'closed'
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parcel_id?: string
          raised_by?: string
          dispute_type?: 'damage' | 'delay' | 'lost' | 'wrong_delivery' | 'other'
          description?: string
          status?: 'open' | 'investigating' | 'resolved' | 'closed'
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payouts: {
        Row: {
          id: string
          courier_id: string
          parcel_id: string
          amount: number
          status: 'pending' | 'processed' | 'paid' | 'failed'
          processed_by: string | null
          processed_at: string | null
          payment_reference: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          courier_id: string
          parcel_id: string
          amount: number
          status?: 'pending' | 'processed' | 'paid' | 'failed'
          processed_by?: string | null
          processed_at?: string | null
          payment_reference?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          courier_id?: string
          parcel_id?: string
          amount?: number
          status?: 'pending' | 'processed' | 'paid' | 'failed'
          processed_by?: string | null
          processed_at?: string | null
          payment_reference?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      parcel_status_history: {
        Row: {
          id: string
          parcel_id: string
          status: string
          notes: string | null
          location: string | null
          created_at: string
        }
        Insert: {
          id?: string
          parcel_id: string
          status: string
          notes?: string | null
          location?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          parcel_id?: string
          status?: string
          notes?: string | null
          location?: string | null
          created_at?: string
        }
      }
      otp_codes: {
        Row: {
          id: string
          phone_number: string
          otp_code: string
          expires_at: string
          used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          phone_number: string
          otp_code: string
          expires_at: string
          used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          otp_code?: string
          expires_at?: string
          used?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_courier: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_sender: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}



