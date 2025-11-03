const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(express.static('public'));

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Схема для умейк
const umeykaSchema = new mongoose.Schema({
  skill: String,
  experience: String,
  price: Number,
  location: { lat: Number, lon: Number },
  userId: Number,
  username: String,
  telegramUsername: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Схема для чатов
const chatSchema = new mongoose.Schema({
  clientUserId: Number,
  masterUserId: Number,
  umeykaId: mongoose.Schema.Types.ObjectId,
  status: { 
    type: String, 
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

// Схема для сообщений
const messageSchema = new mongoose.Schema({
  chatId: mongoose.Schema.Types.ObjectId,
  fromUserId: Number,
  text: String,
  createdAt: { type: Date, default: Date.now }
});

// Схема для отзывов
const reviewSchema = new mongoose.Schema({
  chatId: mongoose.Schema.Types.ObjectId,
  clientUserId: Number,
  masterUserId: Number,
  umeykaId: mongoose.Schema.Types.ObjectId,
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

const Umeyka = mongoose.model('Umeyka', umeykaSchema);
const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);
const Review = mongoose.model('Review', reviewSchema);

const BOT_TOKEN = process.env.BOT_TOKEN || '8200421586:AAEo0V7Vkp7A3w0br0Wlx157UEGW7iKmr8o';
const bot = new Telegraf(BOT_TOKEN);

// ========== WEBHOOK НАСТРОЙКА ==========

// GET endpoint для установки webhook через браузер
app.get('/set-webhook', async (req, res) => {
  try {
    console.log('🔄 Setting up webhook...');
    
    const webhookUrl = `https://umeyka-oocn.onrender.com/webhook`;
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true,
        allowed_updates: ['message', 'callback_query']
      })
    });
    
    const data = await response.json();
    
    // Простой HTML ответ
    res.send(`
      <html>
        <head><title>Umeyka Webhook</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>🤖 Umeyka Webhook Setup</h1>
          <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; display: inline-block;">
            <h2 style="color: ${data.ok ? 'green' : 'red'};">
              ${data.ok ? '✅ SUCCESS' : '❌ ERROR'}
            </h2>
            <p><strong>URL:</strong> ${webhookUrl}</p>
            <p><strong>Message:</strong> ${data.description}</p>
            ${data.result ? `<p><strong>Result:</strong> ${data.result}</p>` : ''}
          </div>
          <div style="margin-top: 20px;">
            <a href="/" style="padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Open App</a>
            <a href="https://t.me/Ymeyka_bot" style="padding: 10px 20px; background: #48bb78; color: white; text-decoration: none; border-radius: 5px; margin-left: 10px;">Open Bot</a>
          </div>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ Webhook setup error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Webhook Error</h1>
          <p>${error.message}</p>
          <a href="/">Go Home</a>
        </body>
      </html>
    `);
  }
});

// Webhook endpoint для Telegram
app.post('/webhook', (req, res) => {
  console.log('📨 Received webhook update');
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// ========== TELEGRAM BOT КОМАНДЫ ==========

bot.start((ctx) => {
  ctx.reply(
    `🤝✨ Добро пожаловать в Умейку!\n\n` +
    `Просто найди мастера для любого дела\n` +
    `Или стань тем, кого ищут другие\n\n` +
    `Откройте веб-приложение чтобы начать:`,
    {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🚀 Открыть Umeyka',
            web_app: { url: 'https://umeyka-oocn.onrender.com' }
          }
        ]]
      }
    }
  );
});

bot.command('search', (ctx) => {
  ctx.reply('🔍 Поиск мастера - откройте веб-приложение:', {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🔍 Открыть поиск',
          web_app: { url: 'https://umeyka-oocn.onrender.com' }
        }
      ]]
    }
  });
});

bot.command('add', (ctx) => {
  ctx.reply('✨ Добавление услуги - откройте веб-приложение:', {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '✨ Добавить услугу',
          web_app: { url: 'https://umeyka-oocn.onrender.com' }
        }
      ]]
    }
  });
});

// ========== ВАЛИДАЦИЯ TELEGRAM WEB APP ==========

function validateInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    
    if (!receivedHash) return false;

    params.delete('hash');
    params.delete('signature');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        if (key === 'user') {
          try {
            const userObj = JSON.parse(decodeURIComponent(value));
            if (userObj.photo_url) {
              userObj.photo_url = userObj.photo_url.replace(/\\/g, '');
            }
            return `${key}=${JSON.stringify(userObj)}`;
          } catch (e) {
            return `${key}=${value}`;
          }
        }
        return `${key}=${value}`;
      })
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    const tolerance = 24 * 60 * 60;

    return calculatedHash === receivedHash && authDate >= now - tolerance;

  } catch (error) {
    console.error('❌ Validation error:', error);
    return false;
  }
}

// ========== API ЭНДПОИНТЫ ==========

// Добавление умейки
app.post('/api/add-umeyka', async (req, res) => {
  try {
    const initData = req.headers.authorization || req.body.initData || req.query.initData;

    if (!initData || !validateInitData(initData)) {
      return res.status(401).json({ error: 'Invalid initData' });
    }

    const { skill, experience, price, location, userId } = req.body;

    if (!skill || !experience || !price || !location || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Извлекаем username из initData
    let username = 'Аноним';
    let telegramUsername = '';
    try {
      const params = new URLSearchParams(initData);
      const userData = params.get('user');
      if (userData) {
        const user = JSON.parse(decodeURIComponent(userData));
        username = user.username || user.first_name || 'Аноним';
        telegramUsername = user.username || '';
      }
    } catch (e) {
      console.log('⚠️ Could not extract username');
    }

    const newUmeyka = new Umeyka({ 
      skill, 
      experience, 
      price, 
      location, 
      userId,
      username,
      telegramUsername
    });
    
    await newUmeyka.save();
    
    res.json({ 
      success: true, 
      message: 'Умейка успешно добавлена!',
      id: newUmeyka._id 
    });
    
  } catch (err) {
    console.error('❌ Error saving umeyka:', err);
    res.status(500).json({ error: 'Failed to save data: ' + err.message });
  }
});

// Поиск умейк
app.get('/api/search-umeyka', async (req, res) => {
  try {
    const { query } = req.query;
    let filter = { isActive: true };
    
    if (query && query.trim() !== '') {
      filter.skill = { $regex: query.trim(), $options: 'i' };
    }

    const skills = await Umeyka.find(filter).sort({ createdAt: -1 });
    res.json(skills);
    
  } catch (err) {
    console.error('Error searching umeyka:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Получение умейк пользователя
app.get('/api/my-umeyka/:userId', async (req, res) => {
  try {
    const skills = await Umeyka.find({ 
      userId: parseInt(req.params.userId),
      isActive: true 
    }).sort({ createdAt: -1 });
    res.json(skills);
  } catch (err) {
    console.error('Error fetching user skills:', err);
    res.status(500).json({ error: 'Failed to fetch user skills' });
  }
});

// ========== ОСНОВНЫЕ ЭНДПОИНТЫ ==========

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    bot: 'Ymeyka_bot'
  });
});

// ========== ЗАПУСК СЕРВЕРА ==========

bot.launch().then(() => {
  console.log('🤖 Telegram bot started');
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🌐 Web App: https://umeyka-oocn.onrender.com`);
  console.log(`🤖 Bot: @Ymeyka_bot`);
  console.log(`🔧 Webhook: https://umeyka-oocn.onrender.com/set-webhook`);
});
