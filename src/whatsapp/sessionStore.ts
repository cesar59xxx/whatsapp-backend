import { supabase } from "../config/supabase"

export class SessionStore {
  async saveSession(instanceId: string, sessionData: any) {
    const { error } = await supabase
      .from("whatsapp_instances")
      .update({
        session_data: sessionData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", instanceId)

    if (error) {
      console.error("[v0] Error saving session:", error)
      throw error
    }
  }

  async loadSession(instanceId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("session_data")
      .eq("id", instanceId)
      .single()

    if (error) {
      console.error("[v0] Error loading session:", error)
      return null
    }

    return data?.session_data || null
  }

  async deleteSession(instanceId: string) {
    const { error } = await supabase
      .from("whatsapp_instances")
      .update({
        session_data: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", instanceId)

    if (error) {
      console.error("[v0] Error deleting session:", error)
      throw error
    }
  }
}
