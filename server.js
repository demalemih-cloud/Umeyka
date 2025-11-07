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

// Подключаемся к MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/umeyka';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Схемы остаются теми же
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

// Упрощенная валидация для демо
function validateInitDataSimple(initData) {
  console.log('🔐 Simplified validation');
  try {
    const params = new URLSearchParams(initData);
    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    const tolerance = 24 * 60 * 60;

    return authDate >= now - tolerance;
  } catch (error) {
    console.log('Validation error:', error);
    return false;
  }
}

// API Routes

// Добавление умейки (упрощенное для демо)
app.post('/api/add-umeyka', async (req, res) => {
  try {
    console.log('📝 Adding new umeyka');
    
    const { skill, experience, price, location } = req.body;
    
    if (!skill || !experience || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newUmeyka = new Umeyka({ 
      skill, 
      experience, 
      price, 
      location: location || { lat: 55.7558, lon: 37.6173 },
      userId: Math.floor(Math.random() * 10000), // Для демо
      username: 'Demo User',
      telegramUsername: 'demo'
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
    res.status(500).json({ error: 'Failed to save data' });
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

    const skills = await Umeyka.find(filter).sort({ createdAt: -1 }).limit(50);
    console.log(`🔍 Found ${skills.length} skills`);
    
    // Добавляем демо-данные если нет реальных
    if (skills.length === 0) {
      const demoSkills = [
        {
          _id: '1',
          skill: 'Ремонт смартфонов',
          experience: '5 лет опыта',
          price: 1500,
          location: { lat: 55.7558, lon: 37.6176 },
          username: 'Алексей'
        },
        {
          _id: '2', 
          skill: 'Установка кондиционеров',
          experience: '3 года опыта',
          price: 3000,
          location: { lat: 55.7520, lon: 37.6170 },
          username: 'Сергей'
        },
        {
          _id: '3',
          skill: 'Мастер по ремонту обуви',
          experience: '7 лет опыта', 
          price: 800,
          location: { lat: 55.7580, lon: 37.6160 },
          username: 'Марина'
        }
      ];
      return res.json(demoSkills);
    }
    
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
      userId: parseInt(req.params.userId)
    }).sort({ createdAt: -1 });
    
    res.json(skills);
  } catch (err) {
    console.error('Error fetching user skills:', err);
    res.status(500).json({ error: 'Failed to fetch user skills' });
  }
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    version: '2.0.0'
  });
});

app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    server: 'Umeyka API v2.0'
  });
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 Umeyka Mini App ready!`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
});
