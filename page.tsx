"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Users, Settings, Search, Send, Phone, Video, MoreVertical, Wifi, WifiOff } from "lucide-react"
import { io, type Socket } from "socket.io-client"

interface User {
  id: string
  username: string
  avatar?: string
  isOnline: boolean
  lastSeen?: string
}

interface Message {
  id: string
  senderId: string
  senderName: string
  content: string
  chatId: string
  timestamp: Date
  type: "text" | "image" | "file"
}

interface Chat {
  id: string
  name: string
  avatar?: string
  lastMessage?: Message
  unreadCount: number
  isGroup: boolean
  participants: User[]
  messageCount: number
}

export default function Actogram() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDomainAllowed, setIsDomainAllowed] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Проверка домена
  useEffect(() => {
    const checkDomain = () => {
      const hostname = window.location.hostname
      const allowedDomains = ["acto-uimuz.vercel.app", "render.com", "vercel.app", "localhost"]
      const isAllowed = allowedDomains.some((domain) => hostname.includes(domain) || hostname === "localhost")
      setIsDomainAllowed(isAllowed)
    }

    checkDomain()
  }, [])

  // Подключение к серверу
  useEffect(() => {
    if (!isDomainAllowed) return

    const serverUrl = "https://actogr.onrender.com"

    socketRef.current = io(serverUrl, {
      transports: ["websocket", "polling"],
    })

    const socket = socketRef.current

    socket.on("connect", () => {
      console.log("✅ Подключено к Actogram серверу")
      setIsConnected(true)
    })

    socket.on("disconnect", () => {
      console.log("❌ Отключено от сервера")
      setIsConnected(false)
    })

    socket.on("new_message", (message: Message) => {
      setMessages((prev) => [...prev, message])

      // Обновляем последнее сообщение в чате
      setChats((prev) => prev.map((chat) => (chat.id === message.chatId ? { ...chat, lastMessage: message } : chat)))
    })

    socket.on("user_joined", (data) => {
      console.log("👋", data.message)
    })

    socket.on("user_left", (data) => {
      console.log("👋", data.message)
    })

    socket.on("users_update", (users: User[]) => {
      setActiveUsers(users)
    })

    socket.on("user_typing", (data) => {
      if (data.chatId === selectedChat?.id) {
        setTypingUsers((prev) => [...prev.filter((u) => u !== data.username), data.username])
      }
    })

    socket.on("user_stop_typing", (data) => {
      setTypingUsers((prev) => prev.filter((u) => u !== data.username))
    })

    return () => {
      socket.disconnect()
    }
  }, [isDomainAllowed, selectedChat?.id])

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleLogin = () => {
    if (!username.trim() || !socketRef.current) return

    const user: User = {
      id: Date.now().toString(),
      username: username.trim(),
      isOnline: true,
    }

    setCurrentUser(user)
    setIsAuthenticated(true)

    // Регистрируем пользователя на сервере
    socketRef.current.emit("register", user)

    // Загружаем чаты
    loadChats()
  }

  const loadChats = async () => {
    try {
      const response = await fetch("https://actogr.onrender.com/api/chats")
      if (response.ok) {
        const chatsData = await response.json()
        setChats(chatsData)

        // Автоматически выбираем общий чат
        const generalChat = chatsData.find((chat: Chat) => chat.id === "general")
        if (generalChat) {
          selectChat(generalChat)
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки чатов:", error)
      // Fallback к локальному чату
      const generalChat: Chat = {
        id: "general",
        name: "Общий чат Actogram",
        isGroup: true,
        participants: [],
        unreadCount: 0,
        messageCount: 0,
      }
      setChats([generalChat])
      selectChat(generalChat)
    }
  }

  const loadMessages = async (chatId: string) => {
    try {
      const response = await fetch(`https://actogr.onrender.com/api/messages/${chatId}`)
      if (response.ok) {
        const messagesData = await response.json()
        setMessages(messagesData)
      }
    } catch (error) {
      console.error("Ошибка загрузки сообщений:", error)
      setMessages([])
    }
  }

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedChat || !currentUser || !socketRef.current) return

    const messageData = {
      content: newMessage.trim(),
      chatId: selectedChat.id,
      type: "text",
    }

    socketRef.current.emit("send_message", messageData)
    setNewMessage("")

    // Останавливаем индикатор печати
    socketRef.current.emit("stop_typing", { chatId: selectedChat.id })
  }

  const selectChat = (chat: Chat) => {
    setSelectedChat(chat)
    loadMessages(chat.id)

    // Присоединяемся к чату на сервере
    if (socketRef.current) {
      socketRef.current.emit("join_chat", chat.id)
    }
  }

  const handleTyping = () => {
    if (selectedChat && socketRef.current) {
      socketRef.current.emit("typing", { chatId: selectedChat.id })

      // Автоматически останавливаем через 3 секунды
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.emit("stop_typing", { chatId: selectedChat.id })
        }
      }, 3000)
    }
  }

  const filteredChats = chats.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase()))

  if (!isDomainAllowed) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Доступ запрещен</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Actogram доступен только с разрешенных доменов</p>
            <p className="text-sm text-gray-500 mt-2">Текущий домен не авторизован</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-blue-600">Actogram</CardTitle>
            <p className="text-gray-600">Добро пожаловать в чат</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-green-500 text-sm">Подключено к серверу</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-red-500 text-sm">Подключение к серверу...</span>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Введите ваше имя"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button onClick={handleLogin} className="w-full" disabled={!isConnected}>
              {isConnected ? "Войти в Actogram" : "Ожидание подключения..."}
            </Button>
            <p className="text-xs text-gray-500 text-center">Сервер: actogr.onrender.com</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Боковая панель */}
      <div className="w-80 bg-white border-r flex flex-col">
        {/* Заголовок */}
        <div className="p-4 border-b bg-blue-600 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Actogram</h1>
            <div className="flex items-center gap-2">
              {isConnected ? <Wifi className="h-4 w-4 text-green-300" /> : <WifiOff className="h-4 w-4 text-red-300" />}
              <Badge variant="secondary" className="bg-blue-500">
                {currentUser?.username}
              </Badge>
              <Button variant="ghost" size="icon" className="text-white hover:bg-blue-700">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-xs text-blue-200 mt-1">
            Онлайн: {activeUsers.length} • Сервер: {isConnected ? "🟢" : "🔴"}
          </div>
        </div>

        {/* Поиск */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Поиск чатов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Список чатов */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => selectChat(chat)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                selectedChat?.id === chat.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={chat.avatar || "/placeholder.svg"} />
                  <AvatarFallback>{chat.isGroup ? <Users className="h-4 w-4" /> : chat.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium truncate">{chat.name}</h3>
                    {chat.lastMessage && (
                      <span className="text-xs text-gray-500">
                        {new Date(chat.lastMessage.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  {chat.lastMessage && (
                    <p className="text-sm text-gray-600 truncate">
                      {chat.lastMessage.senderName}: {chat.lastMessage.content}
                    </p>
                  )}
                  <div className="text-xs text-gray-500">
                    {chat.messageCount} сообщений • {chat.participants.length} участников
                  </div>
                </div>
                {chat.unreadCount > 0 && <Badge className="bg-blue-500">{chat.unreadCount}</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Область чата */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Заголовок чата */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={selectedChat.avatar || "/placeholder.svg"} />
                  <AvatarFallback>
                    {selectedChat.isGroup ? <Users className="h-4 w-4" /> : selectedChat.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="font-semibold">{selectedChat.name}</h2>
                  <p className="text-sm text-gray-500">
                    {selectedChat.isGroup
                      ? `${selectedChat.participants.length} участников • ${activeUsers.length} онлайн`
                      : isConnected
                        ? "онлайн"
                        : "оффлайн"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Пока нет сообщений</p>
                  <p className="text-sm">Начните общение первым!</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.senderId === currentUser?.id ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.senderId === currentUser?.id ? "bg-blue-500 text-white" : "bg-white border"
                    }`}
                  >
                    {message.senderId !== currentUser?.id && (
                      <p className="text-xs text-gray-500 mb-1 font-medium">{message.senderName}</p>
                    )}
                    <p>{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.senderId === currentUser?.id ? "text-blue-100" : "text-gray-500"
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Индикатор печати */}
              {typingUsers.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 px-4 py-2 rounded-lg">
                    <p className="text-sm text-gray-600">{typingUsers.join(", ")} печатает...</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Поле ввода */}
            <div className="p-4 border-t bg-white">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Напишите сообщение..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    if (e.target.value.length === 1) {
                      handleTyping()
                    }
                  }}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  className="flex-1"
                  disabled={!isConnected}
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim() || !isConnected}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {!isConnected && <p className="text-xs text-red-500 mt-1">Нет соединения с сервером</p>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600">Добро пожаловать в Actogram</h3>
              <p className="text-gray-500">Выберите чат, чтобы начать общение</p>
              <div className="mt-2 text-sm text-gray-400">
                {isConnected ? "🟢 Подключено к серверу" : "🔴 Нет соединения с сервером"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
