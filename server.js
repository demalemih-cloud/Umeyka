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

// Схемы (оставляем ваши существующие схемы)
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

const messageSchema = new mongoose.Schema({
  chatId: mongoose.Schema.Types.ObjectId,
  fromUserId: Number,
  text: String,
  createdAt: { type: Date, default: Date.now }
});

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
    console.log('🔄 Setting up webhook via GET...');
    
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
    console.log('Webhook setup result:', data);
    
    // Красивый HTML ответ
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Umeyka - Webhook Setup</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            text-align: center; 
            padding: 50px; 
            margin: 0;
          }
          .container { 
            background: rgba(255,255,255,0.1); 
            padding: 40px; 
            border-radius: 20px; 
            backdrop-filter: blur(10px);
            max-width: 600px;
            margin: 0 auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          }
          .success { color: #48bb78; font-size: 24px; }
          .error { color: #f56565; font-size: 24px; }
          .button { 
            background: #48bb78; 
            color: white; 
            padding: 15px 30px; 
            border: none; 
            border-radius: 10px; 
            text-decoration: none;
            display: inline-block;
            margin: 15px;
            font-size: 16px;
            font-weight: bold;
            transition: all 0.3s;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
          }
          .info {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="font-size: 60px; margin-bottom: 20px;">🤖</div>
          <h1>Umeyka Bot Webhook Setup</h1>
          
          ${data.ok ? 
            `<p class="success">✅ Webhook успешно установлен!</p>
             <div class="info">
               <p><strong>URL:</strong> ${webhookUrl}</p>
               <p><strong>Статус:</strong> ${data.description || 'Успешно'}</p>
               <p><strong>Результат:</strong> ${data.result ? '✅ ' + data.result : 'Настроено'}</p>
             </div>` 
            : 
            `<p class="error">❌ Ошибка установки webhook</p>
             <div class="info">
               <p><strong>Ошибка:</strong> ${data.description || 'Неизвестная ошибка'}</p>
               <p><strong>Код ошибки:</strong> ${data.error_code || 'N/A'}</p>
             </div>`
          }
          
          <div style="margin-top: 30px;">
            <a href="https://t.me/Ymeyka_bot" class="button" target="_blank">📱 Открыть бота</a>
            <a href="https://umeyka-oocn.onrender.com" class="button" style="background: #667eea;">🌐 Открыть приложение</a>
            <a href="/health" class="button" style="background: #ed8936;">❤️ Проверить здоровье</a>
          </div>
          
          <div style="margin-top: 30px; font-size: 14px; opacity: 0.7;">
            <p>Bot: @Ymeyka_bot | Server: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('❌ Webhook setup error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Umeyka - Webhook Error</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            text-align: center; 
            padding: 50px; 
          }
          .container { 
            background: rgba(255,255,255,0.1); 
            padding: 30px; 
            border-radius: 15px; 
            backdrop-filter: blur(10px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Webhook Setup Error</h1>
          <p>${error.message}</p>
          <a href="/" style="color: white; text-decoration: underline;">На главную</a>
        </div>
      </body>
      </html>
    `);
  }
});

// POST endpoint для webhook (для Telegram)
app.post('/webhook', (req, res) => {
  console.log('📨 Received webhook update');
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// ========== ОСТАЛЬНОЙ КОД ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ ==========
// [Ваш существующий код для бота, API endpoints и т.д.]

// Эндпоинт для основной страницы
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    bot: 'Ymeyka_bot',
    webhook: 'Active'
  });
});

// Запускаем бота
bot.launch().then(() => {
  console.log('🤖 Telegram bot started');
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🌐 Web App: https://umeyka-oocn.onrender.com`);
  console.log(`🤖 Bot: @Ymeyka_bot`);
  console.log(`🔧 Webhook Setup: https://umeyka-oocn.onrender.com/set-webhook`);
});
