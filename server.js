const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const path = require("path")
const { v4: uuidv4 } = require("uuid")

const app = express()
const server = http.createServer(app)

// Проверка разрешенных доменов
const allowedDomains = [
  "https://acto-uimuz.vercel.app", // Твой новый домен
  "https://actogr.onrender.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const isAllowed = allowedDomains.some((domain) => origin.startsWith(domain))
      if (isAllowed) {
        callback(null, true)
      } else {
        callback(new Error("Not allowed by CORS - Domain access restricted"))
      }
    },
    methods: ["GET", "POST"],
  },
})

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const isAllowed = allowedDomains.some((domain) => origin.startsWith(domain))
      if (isAllowed) {
        callback(null, true)
      } else {
        callback(new Error("Not allowed by CORS"))
      }
    },
  }),
)

app.use(express.json())

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, "public")))

// Хранилище данных в памяти
const users = new Map()
const chats = new Map()
const messages = new Map()

// Создаем общий чат при запуске
const generalChatId = "general"
chats.set(generalChatId, {
  id: generalChatId,
  name: "Общий чат Actogram",
  isGroup: true,
  participants: [],
  createdAt: new Date(),
})
messages.set(generalChatId, [])

// Middleware для проверки домена
const checkDomain = (req, res, next) => {
  const origin = req.get("origin") || req.get("host")
  const isAllowed = allowedDomains.some(
    (domain) =>
      origin && (origin.includes("vercel.app") || origin.includes("render.com") || origin.includes("localhost")),
  )

  if (!isAllowed && req.path.startsWith("/api")) {
    return res.status(403).json({ error: "Domain access restricted" })
  }
  next()
}

// Главная страница
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Actogram Server</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
            }
            .container {
                background: rgba(255,255,255,0.1);
                padding: 30px;
                border-radius: 15px;
                backdrop-filter: blur(10px);
            }
            h1 { color: #fff; text-align: center; margin-bottom: 30px; }
            .status { 
                background: rgba(0,255,0,0.2); 
                padding: 15px; 
                border-radius: 8px; 
                margin: 20px 0;
                text-align: center;
                font-size: 18px;
            }
            .info {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 8px;
                margin: 15px 0;
            }
            .api-link {
                color: #fff;
                text-decoration: none;
                background: rgba(255,255,255,0.2);
                padding: 8px 15px;
                border-radius: 5px;
                display: inline-block;
                margin: 5px;
                transition: all 0.3s;
            }
            .api-link:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-2px);
            }
            .client-link {
                background: rgba(0,255,0,0.3);
                color: white;
                padding: 15px 25px;
                border-radius: 10px;
                text-decoration: none;
                display: inline-block;
                margin: 10px 0;
                font-size: 18px;
                font-weight: bold;
                transition: all 0.3s;
            }
            .client-link:hover {
                background: rgba(0,255,0,0.4);
                transform: scale(1.05);
            }
            code {
                background: rgba(0,0,0,0.3);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 Actogram Server</h1>
            
            <div class="status">
                ✅ Сервер работает отлично!
            </div>
            
            <div class="info">
                <h3>💬 Клиентское приложение:</h3>
                <a href="https://acto-uimuz.vercel.app" class="client-link" target="_blank">
                    🌐 Открыть Actogram Chat
                </a>
                <p>Основное приложение развернуто на Vercel</p>
            </div>
            
            <div class="info">
                <h3>📊 Статистика сервера:</h3>
                <p>• Активных пользователей: <strong>${users.size}</strong></p>
                <p>• Активных чатов: <strong>${chats.size}</strong></p>
                <p>• Сообщений в общем чате: <strong>${messages.get(generalChatId)?.length || 0}</strong></p>
                <p>• Время работы: <strong>${Math.floor(process.uptime() / 60)} минут</strong></p>
                <p>• Последнее обновление: <strong>${new Date().toLocaleString("ru-RU")}</strong></p>
            </div>
            
            <div class="info">
                <h3>🔗 API Endpoints:</h3>
                <a href="/api/health" class="api-link" target="_blank">Health Check</a>
                <a href="/api/chats" class="api-link" target="_blank">Список чатов</a>
                <p style="margin-top: 10px; font-size: 14px; opacity: 0.8;">
                    API доступно только для разрешенных доменов
                </p>
            </div>
            
            <div class="info">
                <h3>🌐 Разрешенные домены:</h3>
                ${allowedDomains.map((domain) => `<p>• <code>${domain}</code></p>`).join("")}
            </div>
            
            <div class="info">
                <h3>⚡ WebSocket соединение:</h3>
                <p>Socket.IO сервер: <code>${req.protocol}://${req.get("host")}</code></p>
                <p>Статус: <span id="ws-status">Проверяем...</span></p>
            </div>
        </div>
        
        <script src="/socket.io/socket.io.js"></script>
        <script>
            // Проверка WebSocket соединения
            const socket = io();
            const statusEl = document.getElementById('ws-status');
            
            socket.on('connect', () => {
                statusEl.innerHTML = '<span style="color: #00ff00;">🟢 Подключен</span>';
                console.log('WebSocket подключен:', socket.id);
            });
            
            socket.on('disconnect', () => {
                statusEl.innerHTML = '<span style="color: #ff0000;">🔴 Отключен</span>';
            });
            
            socket.on('connect_error', () => {
                statusEl.innerHTML = '<span style="color: #ff0000;">❌ Ошибка подключения</span>';
            });
        </script>
    </body>
    </html>
  `)
})

// API Routes
app.get("/api/health", checkDomain, (req, res) => {
  res.json({
    status: "Actogram server is running perfectly",
    timestamp: new Date().toISOString(),
    activeUsers: users.size,
    activeChats: chats.size,
    uptime: process.uptime(),
    clientUrl: "https://acto-uimuz.vercel.app",
    version: "1.0.0",
  })
})

app.get("/api/chats", checkDomain, (req, res) => {
  const chatList = Array.from(chats.values()).map((chat) => ({
    ...chat,
    lastMessage: messages.get(chat.id)?.slice(-1)[0] || null,
    messageCount: messages.get(chat.id)?.length || 0,
  }))
  res.json(chatList)
})

app.get("/api/messages/:chatId", checkDomain, (req, res) => {
  const { chatId } = req.params
  const chatMessages = messages.get(chatId) || []
  res.json(chatMessages)
})

// Socket.IO обработка соединений
io.on("connection", (socket) => {
  console.log("Новое подключение:", socket.id)

  // Проверка домена для WebSocket
  const origin = socket.handshake.headers.origin
  const isAllowed = allowedDomains.some(
    (domain) =>
      origin && (origin.includes("vercel.app") || origin.includes("render.com") || origin.includes("localhost")),
  )

  if (!isAllowed && origin) {
    console.log("Отклонено подключение с домена:", origin)
    socket.disconnect()
    return
  }

  // Регистрация пользователя
  socket.on("register", (userData) => {
    const user = {
      id: userData.id || uuidv4(),
      username: userData.username,
      socketId: socket.id,
      isOnline: true,
      joinedAt: new Date(),
    }

    users.set(socket.id, user)

    // Добавляем пользователя в общий чат
    const generalChat = chats.get(generalChatId)
    if (generalChat && !generalChat.participants.find((p) => p.id === user.id)) {
      generalChat.participants.push(user)
    }

    socket.join(generalChatId)

    // Уведомляем всех о новом пользователе
    socket.to(generalChatId).emit("user_joined", {
      user: user,
      message: `${user.username} присоединился к Actogram`,
    })

    // Отправляем список активных пользователей
    const activeUsers = Array.from(users.values())
    io.emit("users_update", activeUsers)

    console.log(`Пользователь ${user.username} зарегистрирован`)
  })

  // Присоединение к чату
  socket.on("join_chat", (chatId) => {
    socket.join(chatId)
    console.log(`Пользователь присоединился к чату: ${chatId}`)
  })

  // Отправка сообщения
  socket.on("send_message", (messageData) => {
    const user = users.get(socket.id)
    if (!user) return

    const message = {
      id: uuidv4(),
      senderId: user.id,
      senderName: user.username,
      content: messageData.content,
      chatId: messageData.chatId,
      timestamp: new Date(),
      type: messageData.type || "text",
    }

    // Сохраняем сообщение
    if (!messages.has(messageData.chatId)) {
      messages.set(messageData.chatId, [])
    }
    messages.get(messageData.chatId).push(message)

    // Отправляем сообщение всем в чате
    io.to(messageData.chatId).emit("new_message", message)

    console.log(`Сообщение от ${user.username} в чат ${messageData.chatId}: ${messageData.content}`)
  })

  // Пользователь печатает
  socket.on("typing", (data) => {
    const user = users.get(socket.id)
    if (user) {
      socket.to(data.chatId).emit("user_typing", {
        userId: user.id,
        username: user.username,
        chatId: data.chatId,
      })
    }
  })

  // Пользователь перестал печатать
  socket.on("stop_typing", (data) => {
    const user = users.get(socket.id)
    if (user) {
      socket.to(data.chatId).emit("user_stop_typing", {
        userId: user.id,
        chatId: data.chatId,
      })
    }
  })

  // Отключение пользователя
  socket.on("disconnect", () => {
    const user = users.get(socket.id)
    if (user) {
      // Удаляем пользователя из общего чата
      const generalChat = chats.get(generalChatId)
      if (generalChat) {
        generalChat.participants = generalChat.participants.filter((p) => p.id !== user.id)
      }

      // Уведомляем о выходе пользователя
      socket.to(generalChatId).emit("user_left", {
        user: user,
        message: `${user.username} покинул Actogram`,
      })

      users.delete(socket.id)

      // Обновляем список активных пользователей
      const activeUsers = Array.from(users.values())
      io.emit("users_update", activeUsers)

      console.log(`Пользователь ${user.username} отключился`)
    }
  })
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 Actogram server запущен на порту ${PORT}`)
  console.log(`📱 Клиент: https://acto-uimuz.vercel.app`)
  console.log(`🌐 Сервер: https://actogr.onrender.com`)
  console.log(`💬 Общий чат создан с ID: ${generalChatId}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Получен SIGTERM, завершаем сервер...")
  server.close(() => {
    console.log("Сервер остановлен")
    process.exit(0)
  })
})
