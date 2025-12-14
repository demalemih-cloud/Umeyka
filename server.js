const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mongoose = require('mongoose');
// КОММЕНТИРУЕМ или УДАЛЯЕМ Telegraf
// const { Telegraf } = require('telegraf'); 
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

// Подключаемся к MongoDB (но не обязательно)
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      console.log('⚠️ Using JSON database as fallback');
    });
} else {
  console.log('⚠️ No MongoDB URI provided, using JSON fallback');
}

// ========== ПОДКЛЮЧЕНИЕ К MONGODB ==========

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/umeyka';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.log('⚠️ Using JSON database as fallback');
  });

// ========== СХЕМЫ MONGOOSE ==========

// Схема для профиля пользователя с системой звезд
const userProfileSchema = new mongoose.Schema({
  userId: { type: Number, unique: true, required: true },
  firstName: String,
  lastName: String,
  phone: String,
  bio: String,
  avatar: String,
  location: { lat: Number, lon: Number },
  
  // Система звезд и монетизация
  stars: { type: Number, default: 0 },
  premium: { 
    isActive: { type: Boolean, default: false },
    expiresAt: Date,
    subscriptionId: String
  },
  referralCode: String,
  referredBy: Number,
  referralCount: { type: Number, default: 0 },
  completedDeals: { type: Number, default: 0 },
  
  // Кастомизация профиля
  customProfile: {
    backgroundColor: { type: String, default: '#667eea' },
    textColor: { type: String, default: '#ffffff' },
    isGold: { type: Boolean, default: false }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Обновленная схема умейки с улучшенными рейтингами
const umeykaSchema = new mongoose.Schema({
  skill: String,
  experience: String,
  price: Number,
  location: { lat: Number, lon: Number },
  userId: Number,
  username: String,
  telegramUsername: String,
  isActive: { type: Boolean, default: true },
  
  // Медиа и описание
  photos: [String],
  videos: [String],
  description: String,
  tags: [String],
  
  // Рейтинги и отзывы
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    details: {
      quality: { type: Number, default: 0 },
      speed: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      price: { type: Number, default: 0 }
    }
  },
  
  // Продвижение
  isPromoted: { type: Boolean, default: false },
  promotionExpires: Date,
  isTopMaster: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Схема для сделок с комиссией
const dealSchema = new mongoose.Schema({
  umeykaId: mongoose.Schema.Types.ObjectId,
  masterUserId: Number,
  clientUserId: Number,
  chatId: mongoose.Schema.Types.ObjectId,
  
  // Основные условия сделки
  title: String,
  description: String,
  period: String,
  amount: Number,
  qualityLevel: String, // "premium", "standard", "economy"
  
  // Дополнительные условия
  selectedOptions: [String],
  additionalTerms: {
    quality: Boolean,
    price: Boolean,
    timeRange: Boolean
  },
  
  // Комиссия и оплата
  commission: { type: Number, default: 0 }, // 5% комиссия
  totalAmount: Number, // Сумма с комиссией
  isPaid: { type: Boolean, default: false },
  paymentId: String,
  
  // Статус и подписи
  status: {
    type: String,
    enum: ['draft', 'pending_signature', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  // Электронные подписи
  signatures: {
    master: {
      signed: { type: Boolean, default: false },
      signedAt: Date,
      ipAddress: String
    },
    client: {
      signed: { type: Boolean, default: false },
      signedAt: Date,
      ipAddress: String
    }
  },
  
  // Отзывы после завершения
  masterReview: {
    rating: Number,
    comment: String,
    createdAt: Date
  },
  clientReview: {
    rating: Number,
    comment: String,
    createdAt: Date
  },
  
  createdAt: { type: Date, default: Date.now },
  activatedAt: Date,
  completedAt: Date
});

// Схема для отзывов о проекте
const projectReviewSchema = new mongoose.Schema({
  userId: Number,
  username: String,
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
  isApproved: { type: Boolean, default: false },
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
  rating: { type: Number, min: 1, max: 10 },
  comment: String,
  details: {
    quality: { type: Number, min: 1, max: 10 },
    speed: { type: Number, min: 1, max: 10 },
    communication: { type: Number, min: 1, max: 10 },
    price: { type: Number, min: 1, max: 10 }
  },
  createdAt: { type: Date, default: Date.now }
});

// Создаем модели
const UserProfile = mongoose.model('UserProfile', userProfileSchema);
const Umeyka = mongoose.model('Umeyka', umeykaSchema);
const Deal = mongoose.model('Deal', dealSchema);
const ProjectReview = mongoose.model('ProjectReview', projectReviewSchema);
const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);
const Review = mongoose.model('Review', reviewSchema);

// ========== JSON ДАТАБЕЙЗ ДЛЯ ПРОСТЫХ УМЕЕК (FALLBACK) ==========

const fs = require('fs');
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Убедимся, что папка data существует
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Простая JSON база для умейок (если MongoDB недоступна)
const jsonDB = {
  // Инициализация базы данных
  init() {
    if (!fs.existsSync(DB_PATH)) {
      const initialData = {
        skills: [],
        users: {},
        chats: [],
        deals: []
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
      console.log('✅ JSON база данных создана');
    }
  },

  // Чтение всей базы
  read() {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Ошибка чтения JSON базы данных:', error);
      return null;
    }
  },

  // Запись в базу данных
  write(data) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Ошибка записи в JSON базу данных:', error);
      return false;
    }
  },

  // Получить все активные умейки
  getAllSkills() {
    const dbData = this.read();
    return dbData?.skills.filter(skill => skill.isActive !== false) || [];
  },

  // Получить умейки пользователя
  getUserSkills(userId) {
    const dbData = this.read();
    return dbData?.skills.filter(skill => 
      skill.userId === userId && skill.isActive !== false
    ) || [];
  },

  // Добавить новую умейку
  addSkill(skillData) {
    const dbData = this.read();
    if (!dbData) return false;

    const newSkill = {
      _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ...skillData,
      createdAt: new Date().toISOString(),
      isActive: true,
      views: 0,
      contacts: 0,
      rating: skillData.rating || { average: 5.0, reviews: [] }
    };

    dbData.skills.push(newSkill);
    
    if (this.write(dbData)) {
      console.log('✅ Умейка добавлена в JSON базу:', newSkill._id);
      return newSkill;
    }
    return false;
  },

  // Обновить умейку
  updateSkill(skillId, updates) {
    const dbData = this.read();
    if (!dbData) return false;

    const index = dbData.skills.findIndex(s => s._id === skillId);
    if (index === -1) return false;

    dbData.skills[index] = {
      ...dbData.skills[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return this.write(dbData);
  },

  // Удалить умейку (пометить как неактивную)
  deleteSkill(skillId) {
    return this.updateSkill(skillId, { isActive: false });
  },

  // Увеличить счетчик просмотров
  incrementViews(skillId) {
    const dbData = this.read();
    if (!dbData) return false;

    const skill = dbData.skills.find(s => s._id === skillId);
    if (skill) {
      skill.views = (skill.views || 0) + 1;
      return this.write(dbData);
    }
    return false;
  },

  // Увеличить счетчик контактов
  incrementContacts(skillId) {
    const dbData = this.read();
    if (!dbData) return false;

    const skill = dbData.skills.find(s => s._id === skillId);
    if (skill) {
      skill.contacts = (skill.contacts || 0) + 1;
      return this.write(dbData);
    }
    return false;
  },

  // Поиск умейок
  searchSkills(query, filters = {}) {
    const skills = this.getAllSkills();
    const searchTerm = query.toLowerCase();

    return skills.filter(skill => {
      // Поиск по тексту
      const matchesText = 
        skill.skill.toLowerCase().includes(searchTerm) ||
        skill.experience.toLowerCase().includes(searchTerm) ||
        (skill.description && skill.description.toLowerCase().includes(searchTerm)) ||
        (skill.category && skill.category.toLowerCase().includes(searchTerm));

      // Фильтры по цене
      const matchesPrice = !filters.maxPrice || skill.price <= filters.maxPrice;

      // Фильтры по рейтингу
      const matchesRating = !filters.minRating || 
        (skill.rating?.average || 0) >= filters.minRating;

      return matchesText && matchesPrice && matchesRating;
    });
  }
};

// Инициализируем JSON базу
jsonDB.init();

// ========== API ДЛЯ УМЕЕК (РАБОТАЕТ С MONGODB ИЛИ JSON) ==========

// Получить все умейки (для карты)
app.get('/api/skills', async (req, res) => {
  try {
    // Пробуем получить из MongoDB
    if (mongoose.connection.readyState === 1) {
      const skills = await Umeyka.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      
      // Форматируем для клиента
      const formattedSkills = skills.map(skill => ({
        _id: skill._id.toString(),
        skill: skill.skill,
        experience: skill.experience,
        price: skill.price,
        location: skill.location,
        userId: skill.userId,
        username: skill.username,
        rating: skill.rating,
        isTopMaster: skill.isTopMaster,
        views: skill.views || 0,
        contacts: skill.contacts || 0,
        createdAt: skill.createdAt
      }));
      
      return res.json({
        success: true,
        skills: formattedSkills,
        source: 'mongodb'
      });
    }
    
    // Fallback: используем JSON базу
    const skills = jsonDB.getAllSkills();
    
    res.json({
      success: true,
      skills: skills.map(skill => ({
        ...skill,
        // Не отправляем чувствительные данные
        contact: undefined,
        telegramId: undefined
      })),
      source: 'json'
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения умейок:', error);
    
    // Полный fallback: возвращаем пустой массив
    res.json({
      success: true,
      skills: [],
      source: 'fallback',
      message: 'Используется резервный режим'
    });
  }
});

// Получить умейки пользователя
app.get('/api/skills/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Пробуем получить из MongoDB
    if (mongoose.connection.readyState === 1) {
      const skills = await Umeyka.find({ 
        userId: parseInt(userId),
        isActive: true 
      }).sort({ createdAt: -1 }).lean();
      
      return res.json({ 
        success: true, 
        skills: skills.map(s => ({
          _id: s._id.toString(),
          skill: s.skill,
          experience: s.experience,
          price: s.price,
          rating: s.rating,
          views: s.views || 0,
          contacts: s.contacts || 0
        })),
        source: 'mongodb'
      });
    }
    
    // Fallback: используем JSON базу
    const skills = jsonDB.getUserSkills(userId);
    
    res.json({ 
      success: true, 
      skills,
      source: 'json'
    });
    
  } catch (error) {
    console.error('❌ Ошибка получения умейок пользователя:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера',
      skills: []
    });
  }
});

// Создать новую умейку
app.post('/api/skills', async (req, res) => {
  try {
    const skillData = req.body;
    
    // Валидация
    if (!skillData.skill || !skillData.userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать умение и ID пользователя' 
      });
    }

    // Пробуем сохранить в MongoDB
    if (mongoose.connection.readyState === 1) {
      const newUmeyka = new Umeyka({
        skill: skillData.skill,
        experience: skillData.experience || 'Опыт не указан',
        price: skillData.price || 0,
        location: skillData.location || { lat: 55.7558, lon: 37.6173 },
        userId: skillData.userId,
        username: skillData.username || 'Аноним',
        telegramUsername: skillData.telegramUsername || '',
        rating: {
          average: 5.0,
          count: 0,
          details: { quality: 0, speed: 0, communication: 0, price: 0 }
        }
      });
      
      await newUmeyka.save();
      
      return res.json({ 
        success: true, 
        skill: {
          _id: newUmeyka._id.toString(),
          skill: newUmeyka.skill,
          experience: newUmeyka.experience,
          price: newUmeyka.price,
          location: newUmeyka.location,
          userId: newUmeyka.userId,
          username: newUmeyka.username,
          rating: newUmeyka.rating
        },
        source: 'mongodb'
      });
    }
    
    // Fallback: сохраняем в JSON базу
    const newSkill = jsonDB.addSkill({
      skill: skillData.skill,
      experience: skillData.experience || 'Опыт не указан',
      price: skillData.price || 0,
      userId: skillData.userId,
      username: skillData.username || 'Аноним',
      isTopMaster: skillData.isTopMaster || false,
      location: skillData.location || { lat: 55.7558, lon: 37.6173 },
      category: skillData.category || 'другое',
      contact: skillData.contact || '',
      avatar: skillData.avatar || null,
      description: skillData.description || ''
    });

    if (newSkill) {
      res.json({ 
        success: true, 
        skill: newSkill,
        source: 'json'
      });
    } else {
      res.status(500).json({ success: false, error: 'Ошибка сохранения' });
    }
    
  } catch (error) {
    console.error('❌ Ошибка создания умейки:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Удалить умейку
app.delete('/api/skills/:skillId', async (req, res) => {
  try {
    const skillId = req.params.skillId;
    
    // Пробуем удалить из MongoDB
    if (mongoose.connection.readyState === 1) {
      const result = await Umeyka.findByIdAndUpdate(
        skillId, 
        { isActive: false, updatedAt: new Date() },
        { new: true }
      );
      
      if (result) {
        return res.json({ 
          success: true,
          source: 'mongodb'
        });
      }
    }
    
    // Fallback: удаляем из JSON базы
    if (jsonDB.deleteSkill(skillId)) {
      res.json({ 
        success: true,
        source: 'json'
      });
    } else {
      res.status(404).json({ success: false, error: 'Умейка не найдена' });
    }
    
  } catch (error) {
    console.error('❌ Ошибка удаления умейки:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Поиск умейок
app.get('/api/skills/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : null;
    const minRating = req.query.minRating ? parseFloat(req.query.minRating) : null;
    
    // Пробуем найти в MongoDB
    if (mongoose.connection.readyState === 1) {
      let filter = { isActive: true };
      
      if (query) {
        filter.skill = { $regex: query, $options: 'i' };
      }
      
      if (maxPrice) {
        filter.price = { $lte: maxPrice };
      }
      
      const skills = await Umeyka.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      
      // Фильтр по рейтингу
      let filteredSkills = skills;
      if (minRating) {
        filteredSkills = skills.filter(skill => 
          (skill.rating?.average || 0) >= minRating
        );
      }
      
      return res.json({
        success: true,
        skills: filteredSkills.map(skill => ({
          _id: skill._id.toString(),
          skill: skill.skill,
          experience: skill.experience,
          price: skill.price,
          location: skill.location,
          userId: skill.userId,
          username: skill.username,
          rating: skill.rating,
          isTopMaster: skill.isTopMaster,
          views: skill.views || 0,
          contacts: skill.contacts || 0
        })),
        count: filteredSkills.length,
        source: 'mongodb'
      });
    }
    
    // Fallback: используем JSON базу
    const skills = jsonDB.searchSkills(query, { maxPrice, minRating });
    
    res.json({
      success: true,
      skills: skills.map(skill => ({
        ...skill,
        contact: undefined,
        telegramId: undefined
      })),
      count: skills.length,
      source: 'json'
    });
    
  } catch (error) {
    console.error('❌ Ошибка поиска:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера',
      skills: [],
      count: 0
    });
  }
});

// Увеличить счетчик просмотров
app.post('/api/skills/:skillId/view', async (req, res) => {
  try {
    const skillId = req.params.skillId;
    
    // Пробуем обновить в MongoDB
    if (mongoose.connection.readyState === 1) {
      await Umeyka.findByIdAndUpdate(
        skillId,
        { $inc: { views: 1 } },
        { new: true }
      );
      
      return res.json({ success: true });
    }
    
    // Fallback: обновляем в JSON базе
    if (jsonDB.incrementViews(skillId)) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Умейка не найдена' });
    }
    
  } catch (error) {
    console.error('❌ Ошибка обновления просмотров:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Увеличить счетчик контактов
app.post('/api/skills/:skillId/contact', async (req, res) => {
  try {
    const skillId = req.params.skillId;
    
    // Пробуем обновить в MongoDB
    if (mongoose.connection.readyState === 1) {
      await Umeyka.findByIdAndUpdate(
        skillId,
        { $inc: { contacts: 1 } },
        { new: true }
      );
      
      return res.json({ success: true });
    }
    
    // Fallback: обновляем в JSON базе
    if (jsonDB.incrementContacts(skillId)) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Умейка не найдена' });
    }
    
  } catch (error) {
    console.error('❌ Ошибка обновления контактов:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить статистику по умейкам
app.get('/api/skills/stats', async (req, res) => {
  try {
    // Пробуем получить из MongoDB
    if (mongoose.connection.readyState === 1) {
      const skills = await Umeyka.find({ isActive: true }).lean();
      
      const stats = {
        total: skills.length,
        active: skills.length,
        totalViews: skills.reduce((sum, s) => sum + (s.views || 0), 0),
        totalContacts: skills.reduce((sum, s) => sum + (s.contacts || 0), 0),
        avgPrice: skills.length > 0 ? 
          Math.round(skills.reduce((sum, s) => sum + (s.price || 0), 0) / skills.length) : 0,
        avgRating: skills.length > 0 ?
          Math.round((skills.reduce((sum, s) => sum + (s.rating?.average || 0), 0) / skills.length) * 10) / 10 : 0,
        topMasters: skills.filter(s => s.isTopMaster).length,
        source: 'mongodb'
      };
      
      return res.json({ success: true, stats });
    }
    
    // Fallback: используем JSON базу
    const skills = jsonDB.getAllSkills();
    
    const stats = {
      total: skills.length,
      active: skills.filter(s => s.isActive === true).length,
      totalViews: skills.reduce((sum, s) => sum + (s.views || 0), 0),
      totalContacts: skills.reduce((sum, s) => sum + (s.contacts || 0), 0),
      avgPrice: skills.length > 0 ? 
        Math.round(skills.reduce((sum, s) => sum + (s.price || 0), 0) / skills.length) : 0,
      avgRating: skills.length > 0 ?
        Math.round((skills.reduce((sum, s) => sum + (s.rating?.average || 0), 0) / skills.length) * 10) / 10 : 0,
      topMasters: skills.filter(s => s.isTopMaster).length,
      source: 'json'
    };
    
    res.json({ success: true, stats });
    
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера',
      stats: {
        total: 0,
        active: 0,
        totalViews: 0,
        totalContacts: 0,
        avgPrice: 0,
        avgRating: 0,
        topMasters: 0,
        source: 'fallback'
      }
    });
  }
});

// ========== СУЩЕСТВУЮЩИЕ API ENDPOINTS (ОСТАВЛЯЕМ БЕЗ ИЗМЕНЕНИЙ) ==========

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

// Добавление умейки (старый endpoint для совместимости)
app.post('/api/add-umeyka', async (req, res) => {
  try {
    console.log('📝 Adding new umeyka');
    
    const { skill, experience, price, location, userId } = req.body;
    
    if (!skill || !experience || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Используем новый метод добавления
    const response = await fetch(`http://localhost:${port}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill, 
        experience, 
        price, 
        location: location || { lat: 55.7558, lon: 37.6173 },
        userId: userId || Math.floor(Math.random() * 10000),
        username: 'Demo User'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Умейка успешно добавлена!',
        id: result.skill._id 
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to save data' });
    }
    
  } catch (err) {
    console.error('❌ Error saving umeyka:', err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Поиск умейк (старый endpoint для совместимости)
app.get('/api/search-umeyka', async (req, res) => {
  try {
    const { query } = req.query;
    
    // Используем новый метод поиска
    const response = await fetch(`http://localhost:${port}/api/skills/search?q=${encodeURIComponent(query || '')}`);
    const result = await response.json();
    
    if (result.success) {
      res.json(result.skills);
    } else {
      // Возвращаем демо-данные в случае ошибки
      const demoSkills = [
        {
          _id: '1',
          skill: 'Ремонт смартфонов',
          experience: '5 лет опыта',
          price: 1500,
          location: { lat: 55.7558, lon: 37.6176 },
          username: 'Алексей',
          rating: { average: 8.7, count: 15, details: { quality: 9, speed: 8, communication: 9, price: 8 } },
          isTopMaster: true
        },
        {
          _id: '2', 
          skill: 'Установка кондиционеров',
          experience: '3 года опыта',
          price: 3000,
          location: { lat: 55.7520, lon: 37.6170 },
          username: 'Сергей',
          rating: { average: 7.2, count: 8, details: { quality: 7, speed: 8, communication: 7, price: 7 } }
        },
        {
          _id: '3',
          skill: 'Мастер по ремонту обуви',
          experience: '7 лет опыта', 
          price: 800,
          location: { lat: 55.7580, lon: 37.6160 },
          username: 'Марина',
          rating: { average: 9.5, count: 22, details: { quality: 10, speed: 9, communication: 9, price: 10 } },
          isTopMaster: true
        }
      ];
      
      // Фильтруем демо-данные по запросу
      const filteredDemoSkills = query ? 
        demoSkills.filter(skill => 
          skill.skill.toLowerCase().includes(query.toLowerCase())
        ) : 
        demoSkills;
      
      res.json(filteredDemoSkills);
    }
    
  } catch (err) {
    console.error('Error searching umeyka:', err);
    
    // Возвращаем демо-данные в случае ошибки
    const demoSkills = [
      {
        _id: '1',
        skill: 'Ремонт смартфонов',
        experience: '5 лет опыта',
        price: 1500,
        location: { lat: 55.7558, lon: 37.6176 },
        username: 'Алексей',
        rating: { average: 8.7, count: 15, details: { quality: 9, speed: 8, communication: 9, price: 8 } },
        isTopMaster: true
      }
    ];
    
    res.json(demoSkills);
  }
});

// Получение умейк пользователя (старый endpoint для совместимости)
app.get('/api/my-umeyka/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Используем новый метод
    const response = await fetch(`http://localhost:${port}/api/skills/user/${userId}`);
    const result = await response.json();
    
    if (result.success) {
      res.json(result.skills);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error('Error fetching user skills:', err);
    res.status(500).json({ error: 'Failed to fetch user skills' });
  }
});

// ========== ОСТАЛЬНЫЕ ENDPOINTS (ПОЛНЫЕ ВЕРСИИ) ==========

// Получение профиля пользователя
app.get('/api/user-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    let profile = await UserProfile.findOne({ userId: parseInt(userId) });
    
    if (!profile) {
      // Создаем базовый профиль если не существует
      const referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      profile = new UserProfile({
        userId: parseInt(userId),
        firstName: 'Пользователь',
        bio: 'Расскажите о себе...',
        location: { lat: 55.7558, lon: 37.6173 },
        referralCode: referralCode,
        stars: 3, // Начальные звезды для демо
        customProfile: {
          backgroundColor: '#667eea',
          textColor: '#ffffff',
          isGold: false
        }
      });
      await profile.save();
    }
    
    res.json(profile);
    
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Обновление профиля пользователя
app.post('/api/update-profile', async (req, res) => {
  try {
    const { userId, firstName, lastName, phone, bio, avatar, location } = req.body;
    
    let profile = await UserProfile.findOne({ userId: parseInt(userId) });
    
    if (!profile) {
      profile = new UserProfile({ userId: parseInt(userId) });
    }
    
    // Обновляем поля
    if (firstName !== undefined) profile.firstName = firstName;
    if (lastName !== undefined) profile.lastName = lastName;
    if (phone !== undefined) profile.phone = phone;
    if (bio !== undefined) profile.bio = bio;
    if (avatar !== undefined) profile.avatar = avatar;
    if (location !== undefined) profile.location = location;
    
    profile.updatedAt = new Date();
    
    await profile.save();
    
    res.json({ success: true, profile });
    
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ========== ВСЕ ОСТАЛЬНЫЕ ENDPOINTS (СИСТЕМА ЗВЕЗД, СДЕЛКИ, РЕФЕРАЛЫ) ==========

// Добавление звезд пользователю
app.post('/api/add-stars', async (req, res) => {
  try {
    const { userId, stars, reason } = req.body; // reason: 'referral', 'deal_completed'
    
    const user = await UserProfile.findOne({ userId: parseInt(userId) });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.stars += stars;
    user.updatedAt = new Date();
    
    // Обновляем статус топ-мастера
    if (user.stars >= 10) {
      await Umeyka.updateMany(
        { userId: parseInt(userId) },
        { isTopMaster: true }
      );
    }
    
    // Проверяем достижение 1000 звезд для золотой карточки
    if (user.stars >= 1000 && !user.customProfile.isGold) {
      user.customProfile.isGold = true;
    }
    
    await user.save();
    
    res.json({ 
      success: true, 
      newStars: user.stars,
      isTopMaster: user.stars >= 10,
      isGold: user.customProfile.isGold
    });
    
  } catch (err) {
    console.error('Error adding stars:', err);
    res.status(500).json({ error: 'Failed to add stars' });
  }
});

// Активация премиум-подписки
app.post('/api/activate-premium', async (req, res) => {
  try {
    const { userId, subscriptionId, durationMonths = 1 } = req.body;
    
    const user = await UserProfile.findOne({ userId: parseInt(userId) });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
    
    user.premium = {
      isActive: true,
      expiresAt: expiresAt,
      subscriptionId: subscriptionId
    };
    user.updatedAt = new Date();
    
    await user.save();
    
    res.json({ 
      success: true, 
      premium: user.premium,
      message: 'Премиум-подписка активирована!'
    });
    
  } catch (err) {
    console.error('Error activating premium:', err);
    res.status(500).json({ error: 'Failed to activate premium' });
  }
});

// Обновление кастомизации профиля
app.post('/api/update-profile-customization', async (req, res) => {
  try {
    const { userId, backgroundColor, textColor } = req.body;
    
    const user = await UserProfile.findOne({ userId: parseInt(userId) });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Проверяем, есть ли у пользователя достаточно звезд для кастомизации
    if (user.stars < 1) {
      return res.status(400).json({ error: 'Недостаточно звезд для кастомизации' });
    }
    
    if (backgroundColor) user.customProfile.backgroundColor = backgroundColor;
    if (textColor) user.customProfile.textColor = textColor;
    user.updatedAt = new Date();
    
    await user.save();
    
    res.json({ 
      success: true, 
      customProfile: user.customProfile
    });
    
  } catch (err) {
    console.error('Error updating customization:', err);
    res.status(500).json({ error: 'Failed to update customization' });
  }
});

// Реферальная система
app.post('/api/use-referral', async (req, res) => {
  try {
    const { userId, referralCode } = req.body;
    
    // Находим пользователя, который пригласил
    const referrer = await UserProfile.findOne({ referralCode });
    
    if (!referrer) {
      return res.status(404).json({ error: 'Реферальный код не найден' });
    }
    
    if (referrer.userId === parseInt(userId)) {
      return res.status(400).json({ error: 'Нельзя использовать собственный реферальный код' });
    }
    
    // Добавляем звезды пригласившему
    referrer.stars += 1;
    referrer.referralCount += 1;
    referrer.updatedAt = new Date();
    await referrer.save();
    
    // Обновляем профиль нового пользователя
    const newUser = await UserProfile.findOne({ userId: parseInt(userId) });
    if (newUser) {
      newUser.referredBy = referrer.userId;
      newUser.updatedAt = new Date();
      await newUser.save();
    }
    
    res.json({ 
      success: true,
      referrerName: referrer.firstName || 'Пользователь',
      starsAdded: 1
    });
    
  } catch (err) {
    console.error('Error using referral:', err);
    res.status(500).json({ error: 'Failed to use referral code' });
  }
});

// Генерация реферального кода
app.post('/api/generate-referral', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const user = await UserProfile.findOne({ userId: parseInt(userId) });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Генерируем уникальный реферальный код
    if (!user.referralCode) {
      const referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      user.referralCode = referralCode;
      user.updatedAt = new Date();
      await user.save();
    }
    
    res.json({ 
      success: true, 
      referralCode: user.referralCode,
      referralUrl: `https://t.me/umeyka_bot?start=${user.referralCode}`
    });
    
  } catch (err) {
    console.error('Error generating referral:', err);
    res.status(500).json({ error: 'Failed to generate referral' });
  }
});

// Получение сделок пользователя
app.get('/api/user-deals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const deals = await Deal.find({
      $or: [
        { masterUserId: parseInt(userId) },
        { clientUserId: parseInt(userId) }
      ]
    })
    .populate('umeykaId')
    .sort({ createdAt: -1 })
    .lean();
    
    res.json(deals);
    
  } catch (err) {
    console.error('Error fetching user deals:', err);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// Health check endpoints
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    version: '4.0.0',
    database: dbStatus,
    port: port,
    features: [
      'star-system',
      'premium-subscriptions', 
      'referral-program',
      'deal-commission',
      'project-reviews',
      'mongodb-fallback'
    ]
  });
});

app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    server: 'Umeyka API v4.0',
    database: mongoose.connection.readyState === 1 ? 'MongoDB' : 'JSON Fallback'
  });
});

// Для админ-панели
app.get('/api/admin/stats', async (req, res) => {
  try {
    const usersCount = await UserProfile.countDocuments();
    const activeSkillsCount = await Umeyka.countDocuments({ isActive: true });
    const totalDealsCount = await Deal.countDocuments();
    const revenueResult = await Deal.aggregate([
      { $group: { _id: null, totalCommission: { $sum: "$commission" } } }
    ]);
    const revenue = revenueResult[0]?.totalCommission || 0;
    
    res.json({
      users: usersCount,
      activeSkills: activeSkillsCount,
      totalDeals: totalDealsCount,
      revenue: revenue
    });
    
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    
    // Fallback stats
    res.json({
      users: 0,
      activeSkills: 0,
      totalDeals: 0,
      revenue: 0,
      source: 'fallback'
    });
  }
});

// Статический файл для простого интерфейса
app.get('/simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simple-index.html'));
});

// ========== ЗАПУСК СЕРВЕРА ==========

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${port}`);
  console.log(`🌐 Основное приложение: http://localhost:${port}`);
  console.log(`📱 Простой интерфейс: http://localhost:${port}/simple`);
  console.log(`💚 Проверка здоровья: http://localhost:${port}/health`);
  console.log(`📊 Статистика: http://localhost:${port}/api/admin/stats`);
  console.log(`⚡ База данных: ${mongoose.connection.readyState === 1 ? 'MongoDB' : 'JSON Fallback'}`);
  console.log(`⭐ Система звезд: ВКЛЮЧЕНА`);
  console.log(`💰 Монетизация: ВКЛЮЧЕНА`);
  console.log(`🎯 Реферальная программа: ВКЛЮЧЕНА`);
});
