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

// Схема для профиля пользователя
const userProfileSchema = new mongoose.Schema({
  userId: { type: Number, unique: true, required: true },
  firstName: String,
  lastName: String,
  phone: String,
  bio: String,
  avatar: String,
  location: { lat: Number, lon: Number },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Обновленная схема умейки с медиа и рейтингами
const umeykaSchema = new mongoose.Schema({
  skill: String,
  experience: String,
  price: Number,
  location: { lat: Number, lon: Number },
  userId: Number,
  username: String,
  telegramUsername: String,
  isActive: { type: Boolean, default: true },
  
  // НОВЫЕ ПОЛЯ ДЛЯ ЛИЧНОГО КАБИНЕТА:
  photos: [String],
  videos: [String],
  description: String,
  tags: [String],
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
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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

// Обновленная схема отзывов с детальными рейтингами
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

// ========== СУЩЕСТВУЮЩИЕ API ROUTES ==========

// Добавление умейки (упрощенное для демо)
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
          rating: { average: 8.7, count: 15, details: { quality: 9, speed: 8, communication: 9, price: 8 } }
        },
        {
          _id: '2', 
          skill: 'Установка кондиционеров',
          experience: '3 года опыта',
          price: 3000,
          location: { lat: 55.7520, lon: 37.6170 },
          username: 'Сергей',
          rating: { average: 9.2, count: 8, details: { quality: 9, speed: 10, communication: 8, price: 9 } }
        },
        {
          _id: '3',
          skill: 'Мастер по ремонту обуви',
          experience: '7 лет опыта', 
          price: 800,
          location: { lat: 55.7580, lon: 37.6160 },
          username: 'Марина',
          rating: { average: 7.8, count: 22, details: { quality: 8, speed: 7, communication: 9, price: 7 } }
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

// ========== НОВЫЕ API ROUTES ДЛЯ ЛИЧНОГО КАБИНЕТА ==========

// Получение профиля пользователя
app.get('/api/user-profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    let profile = await UserProfile.findOne({ userId: parseInt(userId) });
    
    if (!profile) {
      // Создаем базовый профиль если не существует
      profile = new UserProfile({
        userId: parseInt(userId),
        firstName: 'Пользователь',
        bio: 'Расскажите о себе...',
        location: { lat: 55.7558, lon: 37.6173 }
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

// Обновление умейки (добавление фото, видео, описания)
app.post('/api/update-umeyka', async (req, res) => {
  try {
    const { umeykaId, photos, videos, description, tags } = req.body;
    
    const umeyka = await Umeyka.findById(umeykaId);
    
    if (!umeyka) {
      return res.status(404).json({ error: 'Umeyka not found' });
    }
    
    if (photos !== undefined) umeyka.photos = photos;
    if (videos !== undefined) umeyka.videos = videos;
    if (description !== undefined) umeyka.description = description;
    if (tags !== undefined) umeyka.tags = tags;
    
    umeyka.updatedAt = new Date();
    
    await umeyka.save();
    
    res.json({ success: true, umeyka });
    
  } catch (err) {
    console.error('Error updating umeyka:', err);
    res.status(500).json({ error: 'Failed to update umeyka' });
  }
});

// Добавление рейтинга к умейке (10-бальная система)
app.post('/api/add-rating', async (req, res) => {
  try {
    const { umeykaId, rating, quality, speed, communication, price, comment, clientUserId } = req.body;
    
    const umeyka = await Umeyka.findById(umeykaId);
    
    if (!umeyka) {
      return res.status(404).json({ error: 'Umeyka not found' });
    }
    
    // Проверяем валидность рейтингов (1-10)
    if (rating < 1 || rating > 10 || quality < 1 || quality > 10 || 
        speed < 1 || speed > 10 || communication < 1 || communication > 10 || 
        price < 1 || price > 10) {
      return res.status(400).json({ error: 'Ratings must be between 1 and 10' });
    }
    
    // Обновляем общий рейтинг
    const newCount = umeyka.rating.count + 1;
    const newAverage = (umeyka.rating.average * umeyka.rating.count + rating) / newCount;
    
    // Обновляем детальные рейтинги
    const details = umeyka.rating.details;
    details.quality = (details.quality * umeyka.rating.count + quality) / newCount;
    details.speed = (details.speed * umeyka.rating.count + speed) / newCount;
    details.communication = (details.communication * umeyka.rating.count + communication) / newCount;
    details.price = (details.price * umeyka.rating.count + price) / newCount;
    
    umeyka.rating = {
      average: parseFloat(newAverage.toFixed(1)),
      count: newCount,
      details: {
        quality: parseFloat(details.quality.toFixed(1)),
        speed: parseFloat(details.speed.toFixed(1)),
        communication: parseFloat(details.communication.toFixed(1)),
        price: parseFloat(details.price.toFixed(1))
      }
    };
    
    await umeyka.save();
    
    // Создаем запись отзыва
    const review = new Review({
      umeykaId,
      clientUserId,
      masterUserId: umeyka.userId,
      rating,
      comment,
      details: { quality, speed, communication, price },
      createdAt: new Date()
    });
    
    await review.save();
    
    res.json({ 
      success: true, 
      newRating: umeyka.rating,
      reviewId: review._id 
    });
    
  } catch (err) {
    console.error('Error adding rating:', err);
    res.status(500).json({ error: 'Failed to add rating' });
  }
});

// Получение отзывов для умейки
app.get('/api/umeyka-reviews/:umeykaId', async (req, res) => {
  try {
    const { umeykaId } = req.params;
    
    const reviews = await Review.find({ umeykaId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json(reviews);
    
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Создание чата с мастером
app.post('/api/create-chat', async (req, res) => {
  try {
    const { clientUserId, masterUserId, umeykaId } = req.body;
    
    // Проверяем существующий активный чат
    const existingChat = await Chat.findOne({
      clientUserId,
      masterUserId,
      umeykaId,
      status: 'active'
    });

    if (existingChat) {
      return res.json({ 
        success: true, 
        chatId: existingChat._id, 
        isNew: false 
      });
    }

    // Создаем новый чат
    const newChat = new Chat({
      clientUserId,
      masterUserId,
      umeykaId
    });

    await newChat.save();

    res.json({ 
      success: true, 
      chatId: newChat._id, 
      isNew: true 
    });

  } catch (err) {
    console.error('Error creating chat:', err);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Отправка сообщения в чат
app.post('/api/send-message', async (req, res) => {
  try {
    const { chatId, fromUserId, text } = req.body;
    
    if (!chatId || !fromUserId || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Проверяем существование чата
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Создаем сообщение
    const message = new Message({
      chatId,
      fromUserId,
      text
    });

    await message.save();

    res.json({ 
      success: true, 
      messageId: message._id,
      createdAt: message.createdAt 
    });

  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Получение сообщений чата
app.get('/api/chat-messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);

  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Получение активных чатов пользователя
app.get('/api/user-chats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const chats = await Chat.find({
      $or: [
        { clientUserId: parseInt(userId) },
        { masterUserId: parseInt(userId) }
      ],
      status: 'active'
    })
    .populate('umeykaId')
    .sort({ createdAt: -1 })
    .lean();
    
    // Добавляем последние сообщения для каждого чата
    const chatsWithLastMessage = await Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await Message.findOne({ chatId: chat._id })
          .sort({ createdAt: -1 })
          .lean();
        
        const unreadCount = await Message.countDocuments({
          chatId: chat._id,
          fromUserId: { $ne: parseInt(userId) },
          createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // за последние 24 часа
        });
        
        return {
          ...chat,
          lastMessage: lastMessage?.text || 'Чат начат',
          lastMessageTime: lastMessage?.createdAt || chat.createdAt,
          unreadCount
        };
      })
    );
    
    res.json(chatsWithLastMessage);
    
  } catch (err) {
    console.error('Error fetching user chats:', err);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Завершение чата
app.post('/api/complete-chat', async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    
    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Проверяем, что пользователь является участником чата
    if (chat.clientUserId !== parseInt(userId) && chat.masterUserId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    chat.status = 'completed';
    chat.completedAt = new Date();
    
    await chat.save();
    
    res.json({ success: true, chat });
    
  } catch (err) {
    console.error('Error completing chat:', err);
    res.status(500).json({ error: 'Failed to complete chat' });
  }
});

// Удаление умейки
app.delete('/api/delete-umeyka/:umeykaId', async (req, res) => {
  try {
    const { umeykaId } = req.params;
    const { userId } = req.body;
    
    const umeyka = await Umeyka.findById(umeykaId);
    
    if (!umeyka) {
      return res.status(404).json({ error: 'Umeyka not found' });
    }
    
    // Проверяем, что пользователь является владельцем умейки
    if (umeyka.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Мягкое удаление - деактивация
    umeyka.isActive = false;
    await umeyka.save();
    
    res.json({ success: true, message: 'Umeyka deleted successfully' });
    
  } catch (err) {
    console.error('Error deleting umeyka:', err);
    res.status(500).json({ error: 'Failed to delete umeyka' });
  }
});

// Получение статистики пользователя
app.get('/api/user-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const totalUmeykas = await Umeyka.countDocuments({ 
      userId: parseInt(userId), 
      isActive: true 
    });
    
    const totalChats = await Chat.countDocuments({
      $or: [
        { clientUserId: parseInt(userId) },
        { masterUserId: parseInt(userId) }
      ],
      status: 'active'
    });
    
    const completedChats = await Chat.countDocuments({
      $or: [
        { clientUserId: parseInt(userId) },
        { masterUserId: parseInt(userId) }
      ],
      status: 'completed'
    });
    
    // Средний рейтинг пользователя
    const userUmeykas = await Umeyka.find({ 
      userId: parseInt(userId) 
    });
    
    let totalRating = 0;
    let ratedUmeykas = 0;
    
    userUmeykas.forEach(umeyka => {
      if (umeyka.rating.count > 0) {
        totalRating += umeyka.rating.average;
        ratedUmeykas++;
      }
    });
    
    const averageRating = ratedUmeykas > 0 ? totalRating / ratedUmeykas : 0;
    
    res.json({
      totalUmeykas,
      totalChats,
      completedChats,
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: ratedUmeykas
    });
    
  } catch (err) {
    console.error('Error fetching user stats:', err);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// ========== HEALTH CHECK ENDPOINTS ==========

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    version: '3.0.0',
    features: ['personal-cabinet', '10-point-ratings', 'chat-system', 'media-uploads']
  });
});

app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    server: 'Umeyka API v3.0',
    endpoints: [
      '/api/user-profile/:userId',
      '/api/update-profile',
      '/api/update-umeyka', 
      '/api/add-rating',
      '/api/user-chats/:userId',
      '/api/create-chat',
      '/api/send-message',
      '/api/chat-messages/:chatId'
    ]
  });
});

// ========== ЗАПУСК СЕРВЕРА ==========

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 Umeyka Mini App ready!`);
  console.log(`👤 Personal Cabinet features: ENABLED`);
  console.log(`⭐ 10-point rating system: ENABLED`);
  console.log(`💬 Chat system: ENABLED`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
  console.log(`📊 API Documentation: http://localhost:${port}/keep-alive`);
});
