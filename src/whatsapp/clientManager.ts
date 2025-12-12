import { Client, LocalAuth, Events } from "whatsapp-web.js"
import { SessionStore } from "./sessionStore"
import { supabase } from "../config/supabase"
import type { Server } from "socket.io"

export class ClientManager {
  private clients: Map<string, Client> = new Map()
  private sessionStore: SessionStore
  private io: Server

  constructor(io: Server) {
    this.sessionStore = new SessionStore()
    this.io = io
  }

  async startInstance(instanceId: string) {
    console.log("[v0] Starting instance:", instanceId)

    // Check if instance already exists
    if (this.clients.has(instanceId)) {
      console.log("[v0] Instance already running:", instanceId)
      return
    }

    // Load instance data from database
    const { data: instance, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instanceId)
      .single()

    if (error || !instance) {
      console.error("[v0] Instance not found:", instanceId)
      throw new Error("Instance not found")
    }

    // Create WhatsApp client
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: instanceId,
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      },
    })

    // Setup event listeners
    this.setupClientEvents(client, instanceId)

    // Store client
    this.clients.set(instanceId, client)

    // Initialize client
    await client.initialize()

    // Update status to QR_PENDING
    await this.updateInstanceStatus(instanceId, "QR_PENDING")
  }

  private setupClientEvents(client: Client, instanceId: string) {
    // QR Code event
    client.on(Events.QR_RECEIVED, async (qr: string) => {
      console.log("[v0] QR received for instance:", instanceId)

      // Save QR to database
      await supabase.from("whatsapp_instances").update({ last_qr: qr }).eq("id", instanceId)

      // Emit via Socket.IO
      this.io.emit("qr", { instanceId, qr })
    })

    // Ready event
    client.on(Events.READY, async () => {
      console.log("[v0] Client ready for instance:", instanceId)

      // Get phone number
      const info = client.info
      const phoneNumber = info?.wid?.user || null

      // Update instance status
      await supabase
        .from("whatsapp_instances")
        .update({
          status: "CONNECTED",
          phone_number: phoneNumber,
          last_connected_at: new Date().toISOString(),
          last_qr: null,
        })
        .eq("id", instanceId)

      // Emit via Socket.IO
      this.io.emit("instance_status", {
        instanceId,
        status: "CONNECTED",
        phoneNumber,
      })
    })

    // Authenticated event
    client.on(Events.AUTHENTICATED, async () => {
      console.log("[v0] Client authenticated for instance:", instanceId)
    })

    // Disconnected event
    client.on(Events.DISCONNECTED, async (reason: string) => {
      console.log("[v0] Client disconnected for instance:", instanceId, reason)

      await this.updateInstanceStatus(instanceId, "DISCONNECTED")

      this.io.emit("instance_status", {
        instanceId,
        status: "DISCONNECTED",
      })
    })

    // Message event
    client.on(Events.MESSAGE_CREATE, async (message: any) => {
      // Only process incoming messages
      if (!message.fromMe) {
        await this.handleIncomingMessage(instanceId, message)
      }
    })

    // Authentication failure
    client.on(Events.AUTHENTICATION_FAILURE, async () => {
      console.error("[v0] Authentication failed for instance:", instanceId)
      await this.updateInstanceStatus(instanceId, "ERROR")
    })
  }

  private async handleIncomingMessage(instanceId: string, message: any) {
    try {
      const contactWaId = message.from
      const phoneNumber = contactWaId.replace("@c.us", "")
      const content = message.body

      // Get or create contact
      let { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("instance_id", instanceId)
        .eq("wa_id", contactWaId)
        .single()

      if (contactError || !contact) {
        // Create new contact
        const { data: newContact, error: createError } = await supabase
          .from("contacts")
          .insert({
            instance_id: instanceId,
            wa_id: contactWaId,
            phone_number: phoneNumber,
            name: message.notifyName || null,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (createError) {
          console.error("[v0] Error creating contact:", createError)
          return
        }

        contact = newContact
      } else {
        // Update last message timestamp
        await supabase.from("contacts").update({ last_message_at: new Date().toISOString() }).eq("id", contact.id)
      }

      // Save message
      const { data: savedMessage, error: messageError } = await supabase
        .from("messages")
        .insert({
          instance_id: instanceId,
          contact_id: contact.id,
          direction: "INBOUND",
          wa_message_id: message.id._serialized,
          content: content,
          is_from_agent: false,
          created_at: new Date(message.timestamp * 1000).toISOString(),
        })
        .select()
        .single()

      if (messageError) {
        console.error("[v0] Error saving message:", messageError)
        return
      }

      // Emit via Socket.IO
      this.io.emit("message_received", {
        instanceId,
        contactId: contact.id,
        message: savedMessage,
      })
    } catch (error) {
      console.error("[v0] Error handling incoming message:", error)
    }
  }

  async sendMessage(instanceId: string, contactId: string, content: string) {
    const client = this.clients.get(instanceId)

    if (!client) {
      throw new Error("Instance not initialized")
    }

    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("wa_id")
      .eq("id", contactId)
      .single()

    if (contactError || !contact) {
      throw new Error("Contact not found")
    }

    // Send message via WhatsApp
    const sentMessage = await client.sendMessage(contact.wa_id, content)

    // Save to database
    const { data: savedMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        instance_id: instanceId,
        contact_id: contactId,
        direction: "OUTBOUND",
        wa_message_id: sentMessage.id._serialized,
        content: content,
        is_from_agent: true,
      })
      .select()
      .single()

    if (messageError) {
      throw messageError
    }

    return savedMessage
  }

  async stopInstance(instanceId: string) {
    const client = this.clients.get(instanceId)

    if (client) {
      await client.destroy()
      this.clients.delete(instanceId)
      await this.updateInstanceStatus(instanceId, "DISCONNECTED")
    }
  }

  private async updateInstanceStatus(instanceId: string, status: string) {
    await supabase.from("whatsapp_instances").update({ status }).eq("id", instanceId)
  }

  getClient(instanceId: string): Client | undefined {
    return this.clients.get(instanceId)
  }

  getAllInstances(): string[] {
    return Array.from(this.clients.keys())
  }
}
