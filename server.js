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

// ========== ОБНОВЛЕННЫЕ СХЕМЫ ==========

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

const UserProfile = mongoose.model('UserProfile', userProfileSchema);
const Umeyka = mongoose.model('Umeyka', umeykaSchema);
const Deal = mongoose.model('Deal', dealSchema);
const ProjectReview = mongoose.model('ProjectReview', projectReviewSchema);
const Chat = mongoose.model('Chat', chatSchema);
const Message = mongoose.model('Message', messageSchema);
const Review = mongoose.model('Review', reviewSchema);

// ========== СИСТЕМА ЗВЕЗД И МОНЕТИЗАЦИИ ==========

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

// ========== СИСТЕМА СДЕЛОК С КОМИССИЕЙ ==========

// Создание сделки с комиссией
app.post('/api/create-deal', async (req, res) => {
  try {
    const { 
      umeykaId, masterUserId, clientUserId, chatId, 
      title, description, period, amount, qualityLevel, 
      selectedOptions, additionalTerms 
    } = req.body;
    
    // Рассчитываем комиссию 5%
    const commission = amount * 0.05;
    const totalAmount = amount + commission;
    
    const newDeal = new Deal({
      umeykaId,
      masterUserId,
      clientUserId,
      chatId,
      title,
      description,
      period,
      amount,
      qualityLevel,
      selectedOptions,
      additionalTerms,
      commission,
      totalAmount,
      status: 'pending_signature'
    });
    
    await newDeal.save();
    
    res.json({ 
      success: true, 
      dealId: newDeal._id,
      commission: commission,
      totalAmount: totalAmount,
      message: 'Сделка создана и отправлена на подпись'
    });
    
  } catch (err) {
    console.error('Error creating deal:', err);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// Завершение сделки с начислением звезд
app.post('/api/complete-deal', async (req, res) => {
  try {
    const { dealId, userId, actualResults } = req.body;
    
    const deal = await Deal.findById(dealId);
    
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    // Проверяем, что пользователь является участником сделки
    if (deal.masterUserId !== userId && deal.clientUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    deal.status = 'completed';
    deal.completedAt = new Date();
    deal.actualResults = actualResults;
    
    await deal.save();
    
    // Начисляем звезды мастеру за завершенную сделку
    if (deal.masterUserId) {
      await fetch('http://localhost:3001/api/add-stars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: deal.masterUserId,
          stars: 1,
          reason: 'deal_completed'
        })
      });
    }
    
    res.json({ 
      success: true, 
      deal: deal,
      message: 'Сделка завершена! Начислена 1 звезда.'
    });
    
  } catch (err) {
    console.error('Error completing deal:', err);
    res.status(500).json({ error: 'Failed to complete deal' });
  }
});

// ========== СИСТЕМА ОТЗЫВОВ О ПРОЕКТЕ ==========

// Добавление отзыва о проекте
app.post('/api/add-project-review', async (req, res) => {
  try {
    const { userId, username, rating, comment } = req.body;
    
    const review = new ProjectReview({
      userId,
      username,
      rating,
      comment
    });
    
    await review.save();
    
    res.json({ 
      success: true, 
      reviewId: review._id,
      message: 'Спасибо за ваш отзыв!'
    });
    
  } catch (err) {
    console.error('Error adding project review:', err);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// Получение отзывов о проекте
app.get('/api/project-reviews', async (req, res) => {
  try {
    const reviews = await ProjectReview.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json(reviews);
    
  } catch (err) {
    console.error('Error fetching project reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ========== СУЩЕСТВУЮЩИЕ API ENDPOINTS ==========

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

// Добавление умейки
app.post('/api/add-umeyka', async (req, res) => {
  try {
    console.log('📝 Adding new umeyka');
    
    const { skill, experience, price, location, userId } = req.body;
    
    if (!skill || !experience || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newUmeyka = new Umeyka({ 
      skill, 
      experience, 
      price, 
      location: location || { lat: 55.7558, lon: 37.6173 },
      userId: userId || Math.floor(Math.random() * 10000),
      username: 'Demo User',
      telegramUsername: 'demo',
      photos: [],
      videos: [],
      description: '',
      tags: [],
      rating: {
        average: 0,
        count: 0,
        details: { quality: 0, speed: 0, communication: 0, price: 0 }
      }
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
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    version: '4.0.0',
    features: [
      'star-system',
      'premium-subscriptions', 
      'referral-program',
      'deal-commission',
      'project-reviews'
    ]
  });
});

app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    server: 'Umeyka API v4.0'
  });
});

// Для админ-панели
app.get('/api/admin/stats', (req, res) => {
    res.json({
        users: Object.keys(database.users).length,
        activeSkills: database.skills.filter(s => s.isActive).length,
        totalDeals: database.deals.length,
        revenue: database.deals.reduce((sum, deal) => sum + (deal.commission || 0), 0)
    });
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 Umeyka Mini App ready!`);
  console.log(`⭐ Star System: ENABLED`);
  console.log(`💰 Monetization: ENABLED`);
  console.log(`🎯 Referral Program: ENABLED`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
});

// server.js (дополняем существующий)
const express = require('express');
const path = require('path');
const db = require('./database'); // Добавляем эту строку

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Существующие маршруты оставляем как есть...

// ========== НОВЫЕ API ДЛЯ УМЕЕК ==========

// Получить все умейки (для карты)
app.get('/api/skills', (req, res) => {
    try {
        const skills = db.getAllSkills();
        res.json({
            success: true,
            skills: skills.map(skill => ({
                ...skill,
                // Не отправляем чувствительные данные
                contact: undefined,
                telegramId: undefined
            }))
        });
    } catch (error) {
        console.error('❌ Ошибка получения умейок:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Получить умейки пользователя
app.get('/api/skills/user/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const skills = db.getUserSkills(userId);
        res.json({ success: true, skills });
    } catch (error) {
        console.error('❌ Ошибка получения умейок пользователя:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Создать новую умейку
app.post('/api/skills', (req, res) => {
    try {
        const skillData = req.body;
        
        // Валидация
        if (!skillData.skill || !skillData.userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать умение и ID пользователя' 
            });
        }

        // Добавляем умолчания
        const newSkill = db.addSkill({
            skill: skillData.skill,
            experience: skillData.experience || 'Опыт не указан',
            price: skillData.price || 0,
            userId: skillData.userId,
            username: skillData.username || 'Аноним',
            rating: { average: 5.0, reviews: [] },
            isTopMaster: skillData.isTopMaster || false,
            location: skillData.location || { lat: 55.7558, lon: 37.6173 },
            category: skillData.category || 'другое',
            contact: skillData.contact || '',
            avatar: skillData.avatar || null,
            description: skillData.description || ''
        });

        if (newSkill) {
            res.json({ success: true, skill: newSkill });
        } else {
            res.status(500).json({ success: false, error: 'Ошибка сохранения' });
        }
    } catch (error) {
        console.error('❌ Ошибка создания умейки:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Обновить умейку
app.put('/api/skills/:skillId', (req, res) => {
    try {
        const skillId = req.params.skillId;
        const updates = req.body;
        
        if (db.updateSkill(skillId, updates)) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Умейка не найдена' });
        }
    } catch (error) {
        console.error('❌ Ошибка обновления умейки:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Удалить умейку
app.delete('/api/skills/:skillId', (req, res) => {
    try {
        const skillId = req.params.skillId;
        
        if (db.deleteSkill(skillId)) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Умейка не найдена' });
        }
    } catch (error) {
        console.error('❌ Ошибка удаления умейки:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Поиск умейок
app.get('/api/skills/search', (req, res) => {
    try {
        const query = req.query.q || '';
        const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice) : null;
        const minRating = req.query.minRating ? parseFloat(req.query.minRating) : null;
        
        const skills = db.searchSkills(query, { maxPrice, minRating });
        
        res.json({
            success: true,
            skills: skills.map(skill => ({
                ...skill,
                contact: undefined,
                telegramId: undefined
            })),
            count: skills.length
        });
    } catch (error) {
        console.error('❌ Ошибка поиска:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Увеличить счетчик просмотров
app.post('/api/skills/:skillId/view', (req, res) => {
    try {
        const skillId = req.params.skillId;
        
        if (db.incrementViews(skillId)) {
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
app.post('/api/skills/:skillId/contact', (req, res) => {
    try {
        const skillId = req.params.skillId;
        
        if (db.incrementContacts(skillId)) {
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
app.get('/api/skills/stats', (req, res) => {
    try {
        const skills = db.getAllSkills();
        
        const stats = {
            total: skills.length,
            active: skills.filter(s => s.isActive === true).length,
            totalViews: skills.reduce((sum, s) => sum + (s.views || 0), 0),
            totalContacts: skills.reduce((sum, s) => sum + (s.contacts || 0), 0),
            avgPrice: skills.length > 0 ? 
                skills.reduce((sum, s) => sum + (s.price || 0), 0) / skills.length : 0,
            avgRating: skills.length > 0 ?
                skills.reduce((sum, s) => sum + (s.rating?.average || 0), 0) / skills.length : 0,
            byCategory: {}
        };
        
        // Статистика по категориям
        skills.forEach(skill => {
            const category = skill.category || 'другое';
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        });
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('❌ Ошибка получения статистики:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Откройте в браузере: http://localhost:${PORT}`);
});
