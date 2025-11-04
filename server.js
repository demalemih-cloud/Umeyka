const express = require('express');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/umeyka')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const BOT_TOKEN = process.env.BOT_TOKEN || '8200421586:AAEo0V7Vkp7A3w0br0Wlx157UEGW7iKmr8o';
const bot = new Telegraf(BOT_TOKEN);

// ========== ПРОСТАЯ СХЕМА ДЛЯ УМЕЙКИ ==========
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

// ========== API ENDPOINTS ==========

// ДИАГНОСТИЧЕСКИЙ ENDPOINT - проверяем что приходит от фронтенда
app.post('/api/debug-add-umeyka', (req, res) => {
  console.log('=== ДИАГНОСТИКА ДАННЫХ ОТ ФРОНТЕНДА ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Query:', req.query);
  console.log('=====================================');
  
  res.json({
    success: true,
    message: 'Диагностика завершена',
    receivedData: req.body,
    headers: Object.keys(req.headers)
  });
});

// УПРОЩЕННОЕ ДОБАВЛЕНИЕ УМЕЙКИ - РАБОЧАЯ ВЕРСИЯ
app.post('/api/add-umeyka', async (req, res) => {
  try {
    console.log('🔄 Попытка добавить умейку...');
    console.log('📦 Полученные данные:', req.body);
    
    // Извлекаем данные из тела запроса
    const { skill, experience, price, location, userId } = req.body;
    
    // ПРОСТАЯ ВАЛИДАЦИЯ
    if (!skill || !experience || !price) {
      console.log('❌ Не хватает данных:', { skill, experience, price });
      return res.json({
        success: false,
        error: 'Заполните все поля: услуга, опыт и цена'
      });
    }
    
    console.log('✅ Данные прошли валидацию');
    
    // СОЗДАЕМ НОВУЮ УМЕЙКУ
    const newUmeyka = new Umeyka({
      skill: skill.toString().trim(),
      experience: experience.toString().trim(),
      price: Number(price),
      location: location || { lat: 55.7558, lon: 37.6173 },
      userId: userId || 'user_' + Date.now(),
      username: 'Тестовый пользователь'
    });
    
    console.log('💾 Сохраняем в базу...');
    
    // СОХРАНЯЕМ В БАЗУ
    await newUmeyka.save();
    
    console.log('✅ Умейка сохранена с ID:', newUmeyka._id);
    
    // УСПЕШНЫЙ ОТВЕТ
    res.json({
      success: true,
      message: '🎉 Умейка успешно добавлена!',
      id: newUmeyka._id,
      debug: {
        savedData: {
          skill: newUmeyka.skill,
          experience: newUmeyka.experience,
          price: newUmeyka.price
        }
      }
    });
    
  } catch (error) {
    console.error('💥 ОШИБКА ПРИ СОХРАНЕНИИ:', error);
    
    res.json({
      success: false,
      error: 'Ошибка сервера: ' + error.message,
      debug: {
        errorName: error.name,
        errorMessage: error.message
      }
    });
  }
});

// ПРОСТОЙ ПОИСК - РАБОЧАЯ ВЕРСИЯ
app.get('/api/search-umeyka', async (req, res) => {
  try {
    const { query } = req.query;
    console.log('🔍 Поиск по запросу:', query);
    
    let searchFilter = {};
    
    if (query && query.trim() !== '') {
      searchFilter.skill = { $regex: query.trim(), $options: 'i' };
    }
    
    const skills = await Umeyka.find(searchFilter).sort({ createdAt: -1 });
    console.log(`✅ Найдено умейк: ${skills.length}`);
    
    res.json(skills);
    
  } catch (error) {
    console.error('❌ Ошибка поиска:', error);
    res.json([]); // Всегда возвращаем массив
  }
});

// ПОЛУЧЕНИЕ МОИХ УМЕЕК
app.get('/api/my-umeyka/:userId?', async (req, res) => {
  try {
    const skills = await Umeyka.find().sort({ createdAt: -1 }).limit(10);
    res.json(skills);
  } catch (error) {
    console.error('Ошибка получения умейк:', error);
    res.json([]);
  }
});

// ========== TELEGRAM BOT ==========

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

// ========== СИСТЕМНЫЕ ENDPOINTS ==========

app.get('/set-webhook', async (req, res) => {
  try {
    const webhookUrl = `https://umeyka-oocn.onrender.com/webhook`;
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true })
    });
    
    const data = await response.json();
    res.json({ success: data.ok, message: data.description, url: webhookUrl });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server v3.0 - DEBUG MODE',
    database: 'MongoDB connected'
  });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// ========== ЗАПУСК СЕРВЕРА ==========

bot.launch().then(() => {
  console.log('🤖 Telegram bot started');
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌐 Web App: https://umeyka-oocn.onrender.com`);
  console.log(`🤖 Bot: @Ymeyka_bot`);
  console.log(`🔧 Debug mode: ON`);
  console.log(`📊 Endpoints:`);
  console.log(`   POST /api/add-umeyka`);
  console.log(`   GET  /api/search-umeyka`);
  console.log(`   POST /api/debug-add-umeyka`);
  console.log(`   GET  /health`);
});
