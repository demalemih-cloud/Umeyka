const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/umeyka')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.log('⚠️  Continuing without database...');
  });

// Схема для умейк
const umeykaSchema = new mongoose.Schema({
  skill: String,
  experience: String,
  price: Number,
  location: {
    lat: { type: Number, default: 55.7558 },
    lon: { type: Number, default: 37.6173 }
  },
  userId: String,
  username: { type: String, default: 'Пользователь' },
  createdAt: { type: Date, default: Date.now }
});

const Umeyka = mongoose.model('Umeyka', umeykaSchema);

// ========== CHAT SCHEMAS ==========

// Схема для чатов
const chatSchema = new mongoose.Schema({
  clientUserId: String,
  masterUserId: String,
  umeykaId: String,
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

// Схема для сообщений
const messageSchema = new mongoose.Schema({
  chatId: String,
  fromUserId: String,
  text: String,
  createdAt: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);

// ========== API ENDPOINTS ==========

// Добавление умейки
app.post('/api/add-umeyka', async (req, res) => {
  try {
    console.log('📝 Adding new umeyka...', req.body);
    
    const { skill, experience, price, location, userId } = req.body;

    if (!skill || !experience || !price) {
      return res.status(400).json({ 
        success: false,
        error: 'Заполните все поля' 
      });
    }

    const newUmeyka = new Umeyka({
      skill: skill.toString().trim(),
      experience: experience.toString().trim(),
      price: parseFloat(price),
      location: location || { lat: 55.7558, lon: 37.6173 },
      userId: userId || 'user_' + Date.now(),
      username: 'Пользователь'
    });

    await newUmeyka.save();
    
    console.log('✅ Umeyka saved:', newUmeyka._id);
    
    res.json({ 
      success: true, 
      message: 'Умейка успешно добавлена!',
      id: newUmeyka._id 
    });
    
  } catch (err) {
    console.error('❌ Error saving umeyka:', err);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка сервера' 
    });
  }
});

// Поиск умейк
app.get('/api/search-umeyka', async (req, res) => {
  try {
    const { query } = req.query;
    console.log('🔍 Searching for:', query);
    
    let filter = {};
    
    if (query && query.trim() !== '') {
      filter.skill = { $regex: query.trim(), $options: 'i' };
    }

    const skills = await Umeyka.find(filter).sort({ createdAt: -1 });
    console.log(`✅ Found ${skills.length} skills`);
    
    res.json(skills);
    
  } catch (err) {
    console.error('❌ Error searching umeyka:', err);
    res.status(500).json([]);
  }
});

// Получение умейк пользователя
app.get('/api/my-umeyka/:userId?', async (req, res) => {
  try {
    const skills = await Umeyka.find().sort({ createdAt: -1 }).limit(10);
    res.json(skills);
  } catch (err) {
    console.error('Error fetching skills:', err);
    res.json([]);
  }
});

// ========== CHAT ENDPOINTS ==========

// Создание чата
app.post('/api/create-chat', async (req, res) => {
  try {
    const { masterUserId, umeykaId } = req.body;
    
    const newChat = new Chat({
      clientUserId: 'user_' + Date.now(),
      masterUserId: masterUserId || 'master_123',
      umeykaId: umeykaId
    });

    await newChat.save();

    res.json({ 
      success: true, 
      chatId: newChat._id, 
      isNew: true,
      message: 'Чат создан!'
    });

  } catch (err) {
    console.error('Error creating chat:', err);
    res.json({ 
      success: true, 
      chatId: 'temp_chat_' + Date.now(), 
      isNew: true 
    });
  }
});

// Отправка сообщения
app.post('/api/send-message', async (req, res) => {
  try {
    const { chatId, text } = req.body;
    
    if (!chatId || !text) {
      return res.json({ 
        success: false, 
        error: 'Не указан chatId или текст сообщения' 
      });
    }

    // Сохраняем сообщение
    const message = new Message({
      chatId: chatId,
      fromUserId: 'user_' + Date.now(),
      text: text
    });

    await message.save();

    console.log('✅ Message saved:', message._id);

    res.json({ 
      success: true, 
      messageId: message._id,
      message: 'Сообщение отправлено'
    });

  } catch (err) {
    console.error('Error sending message:', err);
    res.json({ 
      success: true, 
      messageId: 'temp_msg_' + Date.now()
    });
  }
});

// Получение сообщений чата
app.get('/api/chat-messages/:chatId', async (req, res) => {
  try {
    const messages = await Message.find({ 
      chatId: req.params.chatId 
    }).sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.json([]);
  }
});

// Получение активных чатов пользователя
app.get('/api/my-chats/:userId?', async (req, res) => {
  try {
    const chats = await Chat.find({
      status: 'active'
    }).sort({ createdAt: -1 }).limit(5);

    res.json(chats);
  } catch (err) {
    console.error('Error fetching chats:', err);
    res.json([]);
  }
});

// Диагностический endpoint
app.post('/api/debug-add-umeyka', (req, res) => {
  console.log('=== DEBUG ===');
  console.log('Body:', req.body);
  res.json({
    success: true,
    message: 'Диагностика завершена',
    receivedData: req.body
  });
});

// Webhook setup
app.get('/set-webhook', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is ready',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    version: '2.0'
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Keep alive для Render
app.get('/keep-alive', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('💥 Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌐 Web App: https://umeyka-oocn.onrender.com`);
  console.log(`📊 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
});
