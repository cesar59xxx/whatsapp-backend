import express from "express"
import cors from "cors"
import { Server } from "socket.io"
import { createServer } from "http"
import { config } from "./config/env"
import { ClientManager } from "./whatsapp/clientManager"
import { createInstancesRouter } from "./routes/instances"
import { createMessagesRouter } from "./routes/messages"
import { createDashboardRouter } from "./routes/dashboard"
import { createWebhooksRouter } from "./routes/webhooks"

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: config.server.frontendUrl,
    methods: ["GET", "POST"],
  },
})

// Middleware
app.use(cors({ origin: config.server.frontendUrl }))
app.use(express.json())

// Initialize WhatsApp client manager
const clientManager = new ClientManager(io)

// Routes
app.use("/api/instances", createInstancesRouter(clientManager))
app.use("/api/instances", createMessagesRouter(clientManager))
app.use("/api/dashboard", createDashboardRouter())
app.use("/api/webhooks", createWebhooksRouter())

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" })
})

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("[v0] Client connected:", socket.id)

  socket.on("disconnect", () => {
    console.log("[v0] Client disconnected:", socket.id)
  })
})

// Start server
httpServer.listen(config.server.port, () => {
  console.log(`[v0] Server running on port ${config.server.port}`)
})
