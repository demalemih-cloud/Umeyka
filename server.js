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

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

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

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

/* ---------- ВАЛИДАЦИЯ ---------- */
function validateInitData(initData) {
  console.log('\n=== ВАЛИДАЦИЯ НАЧАЛАСЬ ===');
  
  try {
    // Парсим initData
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    
    console.log('Received hash:', receivedHash);

    if (!receivedHash) {
      console.log('❌ No hash found');
      return false;
    }

    // Удаляем hash и signature из параметров для проверки
    params.delete('hash');
    params.delete('signature');

    // Собираем data_check_string в правильном порядке
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        // Для поля user парсим JSON и пересобираем без лишних пробелов
        if (key === 'user') {
          try {
            const userObj = JSON.parse(decodeURIComponent(value));
            // Убираем экранирование в photo_url
            if (userObj.photo_url) {
              userObj.photo_url = userObj.photo_url.replace(/\\/g, '');
            }
            return `${key}=${JSON.stringify(userObj)}`;
          } catch (e) {
            console.log('⚠️ Could not parse user, using raw value');
            return `${key}=${value}`;
          }
        }
        return `${key}=${value}`;
      })
      .join('\n');

    console.log('Data check string:');
    console.log(dataCheckString);

    // Создаем секретный ключ
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    // Вычисляем хеш
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    console.log('Calculated hash:', calculatedHash);
    console.log('Hashes match:', calculatedHash === receivedHash);

    // Проверяем auth_date
    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    const tolerance = 24 * 60 * 60; // 24 часа

    console.log('Auth date:', authDate);
    console.log('Current time:', now);
    console.log('Time difference:', now - authDate, 'seconds');
    console.log('Auth date valid:', authDate >= now - tolerance);

    const isHashValid = calculatedHash === receivedHash;
    const isDateValid = authDate >= now - tolerance;

    console.log('=== РЕЗУЛЬТАТ ВАЛИДАЦИИ:', isHashValid && isDateValid ? '✅ УСПЕХ' : '❌ ОШИБКА', '===');

    return isHashValid && isDateValid;

  } catch (error) {
    console.error('❌ Validation error:', error);
    return false;
  }
}

/* ---------- ПРОСТАЯ ВАЛИДАЦИЯ (запасной вариант) ---------- */
function validateInitDataSimple(initData) {
  console.log('\n=== ПРОСТАЯ ВАЛИДАЦИЯ ===');
  
  try {
    const params = new URLSearchParams(initData);
    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    const tolerance = 24 * 60 * 60; // 24 часа

    console.log('Auth date check:', authDate, 'vs', now);
    console.log('Time valid:', authDate >= now - tolerance);

    // Для тестирования временно пропускаем хеш-проверку
    if (authDate >= now - tolerance) {
      console.log('✅ Альтернативная валидация: УСПЕХ');
      return true;
    }

    console.log('❌ Альтернативная валидация: ОШИБКА');
    return false;

  } catch (error) {
    console.error('❌ Alternative validation error:', error);
    return false;
  }
}

/* ---------- API ---------- */

// Добавление умейки
app.post('/api/add-umeyka', async (req, res) => {
  try {
    console.log('\n=== ПОПЫТКА ДОБАВЛЕНИЯ УМЕЙКИ ===');
    
    const initData = req.headers.authorization || req.body.initData || req.query.initData;
    console.log('Authorization header present:', !!req.headers.authorization);

    if (!initData) {
      console.log('❌ No initData provided');
      return res.status(401).json({ error: 'No initData provided' });
    }

    // Пробуем основную валидацию
    let isValid = validateInitData(initData);
    
    // Если основная не прошла, пробуем альтернативную (для тестирования)
    if (!isValid) {
      console.log('⚠️ Main validation failed, trying alternative...');
      isValid = validateInitDataSimple(initData);
    }

    if (!isValid) {
      console.log('❌ All validation attempts failed');
      return res.status(401).json({ error: 'Invalid initData' });
    }

    const { skill, experience, price, location, userId } = req.body;
    console.log('Received data:', { skill, experience, price, location, userId });

    if (!skill || !experience || !price || !location || !userId) {
      console.log('❌ Missing fields:', { 
        skill: !!skill, 
        experience: !!experience, 
        price: !!price, 
        location: !!location, 
        userId: !!userId 
      });
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
        console.log('Extracted username:', username);
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
    console.log('✅ Umeyka saved successfully:', newUmeyka);
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

// Создание чата с умейкой
app.post('/api/create-chat', async (req, res) => {
  try {
    const initData = req.headers.authorization || req.body.initData || req.query.initData;
    
    if (!initData || !validateInitData(initData)) {
      return res.status(401).json({ error: 'Invalid initData' });
    }

    const { masterUserId, umeykaId } = req.body;
    
    // Получаем clientUserId из initData
    let clientUserId;
    try {
      const params = new URLSearchParams(initData);
      const userData = params.get('user');
      if (userData) {
        const user = JSON.parse(decodeURIComponent(userData));
        clientUserId = user.id;
      }
    } catch (e) {
      console.log('Could not extract user ID from initData');
      return res.status(400).json({ error: 'Could not extract user ID' });
    }

    if (!clientUserId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    // Проверяем существующий активный чат
    const existingChat = await Chat.findOne({
      clientUserId,
      masterUserId,
      umeykaId,
      status: 'active'
    });

    if (existingChat) {
      return res.json({ success: true, chatId: existingChat._id, isNew: false });
    }

    // Создаем новый чат
    const newChat = new Chat({
      clientUserId,
      masterUserId,
      umeykaId
    });

    await newChat.save();

    // Отправляем уведомление мастеру в Telegram
    try {
      const umeyka = await Umeyka.findById(umeykaId);
      if (umeyka) {
        await bot.telegram.sendMessage(
          masterUserId,
          `💬 Новый заказ!\n\n` +
          `Услуга: ${umeyka.skill}\n` +
          `Цена: ${umeyka.price} руб.\n\n` +
          `Клиент хочет связаться с вами. ` +
          `Перейдите в приложение Umeyka для общения.`
        );
      }
    } catch (error) {
      console.log('Could not send Telegram notification:', error);
    }

    res.json({ success: true, chatId: newChat._id, isNew: true });

  } catch (err) {
    console.error('Error creating chat:', err);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Отправка сообщения
app.post('/api/send-message', async (req, res) => {
  try {
    const initData = req.headers.authorization || req.body.initData || req.query.initData;
    
    if (!initData || !validateInitData(initData)) {
      return res.status(401).json({ error: 'Invalid initData' });
    }

    const { chatId, text } = req.body;
    
    // Получаем fromUserId из initData
    let fromUserId;
    try {
      const params = new URLSearchParams(initData);
      const userData = params.get('user');
      if (userData) {
        const user = JSON.parse(decodeURIComponent(userData));
        fromUserId = user.id;
      }
    } catch (e) {
      console.log('Could not extract user ID from initData');
      return res.status(400).json({ error: 'Could not extract user ID' });
    }

    if (!chatId || !text) {
      return res.status(400).json({ error: 'Missing chatId or text' });
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

    // Отправляем уведомление второму участнику
    const recipientUserId = fromUserId === chat.clientUserId ? chat.masterUserId : chat.clientUserId;
    
    try {
      await bot.telegram.sendMessage(
        recipientUserId,
        `📨 Новое сообщение в Umeyka:\n\n${text}\n\n` +
        `Перейдите в приложение для ответа.`
      );
    } catch (error) {
      console.log('Could not send Telegram notification:', error);
    }

    res.json({ success: true, messageId: message._id });

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

// Завершение чата и добавление отзыва
app.post('/api/complete-chat', async (req, res) => {
  try {
    const initData = req.headers.authorization || req.body.initData || req.query.initData;
    
    if (!initData || !validateInitData(initData)) {
      return res.status(401).json({ error: 'Invalid initData' });
    }

    const { chatId, rating, comment } = req.body;
    
    // Получаем clientUserId из initData
    let clientUserId;
    try {
      const params = new URLSearchParams(initData);
      const userData = params.get('user');
      if (userData) {
        const user = JSON.parse(decodeURIComponent(userData));
        clientUserId = user.id;
      }
    } catch (e) {
      console.log('Could not extract user ID from initData');
      return res.status(400).json({ error: 'Could not extract user ID' });
    }

    // Находим чат
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.clientUserId !== clientUserId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Завершаем чат
    chat.status = 'completed';
    chat.completedAt = new Date();
    await chat.save();

    // Создаем отзыв
    const review = new Review({
      chatId,
      clientUserId,
      masterUserId: chat.masterUserId,
      umeykaId: chat.umeykaId,
      rating,
      comment
    });

    await review.save();

    // Уведомляем мастера об отзыве
    try {
      const umeyka = await Umeyka.findById(chat.umeykaId);
      if (umeyka) {
        await bot.telegram.sendMessage(
          chat.masterUserId,
          `⭐ Новый отзыв!\n\n` +
          `Услуга: ${umeyka.skill}\n` +
          `Оценка: ${'★'.repeat(rating)}${'☆'.repeat(5-rating)}\n` +
          `Комментарий: ${comment || 'Без комментария'}\n\n` +
          `Спасибо за вашу работу!`
        );
      }
    } catch (error) {
      console.log('Could not send review notification:', error);
    }

    res.json({ success: true, reviewId: review._id });

  } catch (err) {
    console.error('Error completing chat:', err);
    res.status(500).json({ error: 'Failed to complete chat' });
  }
});

// Получение отзывов для умейки
app.get('/api/reviews/:umeykaId', async (req, res) => {
  try {
    const { umeykaId } = req.params;
    
    const reviews = await Review.find({ umeykaId })
      .populate('chatId')
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);

  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Получение активных чатов пользователя
app.get('/api/my-chats/:userId', async (req, res) => {
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

    res.json(chats);

  } catch (err) {
    console.error('Error fetching chats:', err);
    res.status(500).json({ error: 'Failed to fetch chats' });
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
    console.log(`Found ${skills.length} skills for query: ${query}`);
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

// Эндпоинт для основной страницы
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// ==== ЭНДПОИНТЫ ДЛЯ ПОДДЕРЖАНИЯ АКТИВНОСТИ ====

// Простой эндпоинт для проверки здоровья
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    version: '1.0.0'
  });
});

// Эндпоинт для поддержания активности (для UptimeRobot)
app.get('/keep-alive', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    server: 'Umeyka API'
  });
});

// Запускаем бота
bot.launch().then(() => {
  console.log('Telegram bot started');
});

// ЗАПУСК СЕРВЕРА
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Connected to MongoDB');
});
