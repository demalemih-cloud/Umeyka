const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { Telegraf } = require('telegraf');

// Создаем бота (токен должен быть в переменных окружения!)
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const bot = new Telegraf(BOT_TOKEN);

// Проверяем токен бота
if (!BOT_TOKEN || BOT_TOKEN.trim() === '') {
    console.error('❌ ОШИБКА: Не указан токен Telegram бота!');
    console.log('ℹ️  Чтобы получить токен:');
    console.log('1. Найдите @BotFather в Telegram');
    console.log('2. Создайте нового бота или получите токен существующего');
    console.log('3. Добавьте токен в .env файл: BOT_TOKEN=ваш_токен');
} else {
    // Запускаем бота
    bot.launch().then(() => {
        console.log('🤖 Telegram бот успешно запущен!');
        console.log('👤 Бот доступен по ссылке: https://t.me/' + (bot.botInfo?.username || 'ваш_бот'));
    }).catch(err => {
        console.error('❌ Ошибка запуска бота:', err.message);
    });
}

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== ПРОСТОЙ JSON ДАТАБЕЙЗ ==========

const fs = require('fs');
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Убедимся, что папка data существует
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Простая JSON база
const db = {
  init() {
    if (!fs.existsSync(DB_PATH)) {
      const initialData = {
        skills: [],
        users: {},
        chats: [],
        deals: [],
        telegramUsers: {} // Новое поле для хранения привязанных Telegram аккаунтов
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
      console.log('✅ JSON база данных создана');
    }
  },

  read() {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Ошибка чтения базы данных:', error);
      return null;
    }
  },

  write(data) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Ошибка записи в базу данных:', error);
      return false;
    }
  },

  getAllSkills() {
    const dbData = this.read();
    return dbData?.skills.filter(skill => skill.isActive !== false) || [];
  },

  getUserSkills(userId) {
    const dbData = this.read();
    return dbData?.skills.filter(skill => 
      skill.userId === userId && skill.isActive !== false
    ) || [];
  },

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
      rating: { average: 5.0, reviews: [] }
    };

    dbData.skills.push(newSkill);
    
    if (this.write(dbData)) {
      console.log('✅ Умейка добавлена в базу:', newSkill._id);
      return newSkill;
    }
    return false;
  },

  deleteSkill(skillId) {
    const dbData = this.read();
    if (!dbData) return false;

    const index = dbData.skills.findIndex(s => s._id === skillId);
    if (index === -1) return false;

    dbData.skills[index].isActive = false;
    dbData.skills[index].updatedAt = new Date().toISOString();

    return this.write(dbData);
  },

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

  searchSkills(query, filters = {}) {
    const skills = this.getAllSkills();
    const searchTerm = query.toLowerCase();

    return skills.filter(skill => {
      const matchesText = 
        skill.skill.toLowerCase().includes(searchTerm) ||
        skill.experience.toLowerCase().includes(searchTerm) ||
        (skill.description && skill.description.toLowerCase().includes(searchTerm)) ||
        (skill.category && skill.category.toLowerCase().includes(searchTerm));

      const matchesPrice = !filters.maxPrice || skill.price <= filters.maxPrice;
      const matchesRating = !filters.minRating || 
        (skill.rating?.average || 0) >= filters.minRating;

      return matchesText && matchesPrice && matchesRating;
    });
  },

  // Новые методы для работы с Telegram пользователями
  getUserByTelegramId(telegramId) {
    const dbData = this.read();
    if (!dbData) return null;

    return dbData.telegramUsers[telegramId] || null;
  },

  getUserByUserId(userId) {
    const dbData = this.read();
    if (!dbData) return null;

    // Ищем пользователя по userId в telegramUsers
    for (const [telegramId, userData] of Object.entries(dbData.telegramUsers)) {
      if (userData.userId === userId) {
        return { telegramId, ...userData };
      }
    }
    return null;
  },

  bindTelegramUser(telegramId, userId, userData = {}) {
    const dbData = this.read();
    if (!dbData) return false;

    if (!dbData.telegramUsers) {
      dbData.telegramUsers = {};
    }

    dbData.telegramUsers[telegramId] = {
      userId,
      username: userData.username || 'Пользователь',
      firstName: userData.first_name || '',
      lastName: userData.last_name || '',
      boundAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    // Также сохраняем в users для обратной совместимости
    if (!dbData.users) {
      dbData.users = {};
    }
    
    if (!dbData.users[userId]) {
      dbData.users[userId] = {};
    }
    
    dbData.users[userId].telegramId = telegramId;
    dbData.users[userId].username = userData.username || 'Пользователь';

    return this.write(dbData);
  },

  updateUserLastActive(userId) {
    const dbData = this.read();
    if (!dbData) return false;

    // Обновляем в telegramUsers
    if (dbData.telegramUsers) {
      for (const [telegramId, userData] of Object.entries(dbData.telegramUsers)) {
        if (userData.userId === userId) {
          userData.lastActive = new Date().toISOString();
          return this.write(dbData);
        }
      }
    }

    return false;
  }
};

// Инициализируем базу
db.init();

// Создаем демо данные если их нет
function createDemoData() {
  const skills = db.getAllSkills();
  if (skills.length === 0) {
    console.log('🔄 Создание демо-данных...');
    
    const demoSkills = [
      {
        _id: 'demo_1',
        skill: 'Ремонт смартфонов',
        experience: '5 лет опыта',
        price: 1500,
        userId: 'demo1',
        username: 'Алексей',
        rating: { average: 4.8, reviews: [] },
        isTopMaster: true,
        location: { lat: 55.7538, lon: 37.6206 },
        isActive: true,
        views: 42,
        contacts: 8
      },
      {
        _id: 'demo_2',
        skill: 'Сантехник',
        experience: '7 лет опыта',
        price: 2000,
        userId: 'demo2',
        username: 'Иван',
        rating: { average: 4.9, reviews: [] },
        isTopMaster: false,
        location: { lat: 55.7578, lon: 37.6150 },
        isActive: true,
        views: 38,
        contacts: 5
      }
    ];
    
    const dbData = db.read();
    if (dbData) {
      dbData.skills = demoSkills;
      db.write(dbData);
      console.log('✅ Демо-данные созданы');
    }
  }
}

createDemoData();

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Проверка, является ли строка Telegram ID
function isTelegramId(userId) {
  if (!userId) return false;
  
  const idStr = userId.toString();
  
  // Telegram ID обычно числовое значение от 6 до 12 цифр
  if (/^\d+$/.test(idStr)) {
    const numId = parseInt(idStr);
    return numId > 100000 && numId < 999999999999; // Реальные Telegram ID в этом диапазоне
  }
  
  return false;
}

// Функция для отправки прямых сообщений в Telegram чаты
async function sendDirectTelegramMessage(recipientTelegramId, senderName, messageText, chatData) {
  try {
    if (!recipientTelegramId || !isTelegramId(recipientTelegramId)) {
      console.log('❌ Неверный Telegram ID для отправки:', recipientTelegramId);
      return false;
    }

    // Получаем информацию об умейке
    const dbData = db.read();
    const skill = dbData.skills.find(s => s._id === chatData.umeykaId);
    const skillName = skill ? skill.skill : 'Услуга';

    // Форматируем сообщение
    const formattedMessage = 
      `💬 *Новое сообщение в Umeyka*\n\n` +
      `👤 *От:* ${senderName}\n` +
      `📝 *Услуга:* ${skillName}\n` +
      `💭 *Сообщение:*\n${messageText}\n\n` +
      `⏰ *${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}*\n\n` +
      `✍️ *Ответить в Umeyka:*`;

    console.log('📨 Отправка прямого сообщения Telegram ID:', recipientTelegramId);
    console.log('📝 Текст:', messageText.substring(0, 50) + '...');

    try {
      // Отправляем сообщение напрямую пользователю
      await bot.telegram.sendMessage(recipientTelegramId, formattedMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '💬 Ответить в приложении',
              url: `https://umeyka-oocn.onrender.com/#chat=${chatData.chatId}`
            }
          ]]
        }
      });

      console.log('✅ Прямое сообщение успешно отправлено Telegram ID:', recipientTelegramId);
      return true;
    } catch (telegramError) {
      console.error('❌ Ошибка отправки прямого сообщения:', telegramError.message);
      
      if (telegramError.response) {
        console.log('📊 Код ошибки:', telegramError.response.error_code);
        console.log('📋 Описание:', telegramError.response.description);
        
        if (telegramError.response.error_code === 403) {
          console.log('⚠️ Пользователь заблокировал бота или не запускал его');
        } else if (telegramError.response.error_code === 400) {
          console.log('⚠️ Неверный Telegram ID или пользователь не найден');
        }
      }
      return false;
    }

  } catch (error) {
    console.error('❌ Критическая ошибка в sendDirectTelegramMessage:', error);
    return false;
  }
}

// Функция для отправки уведомлений через бота (fallback)
async function sendBotNotification(recipientUserId, chat, message, senderUserId) {
  try {
    const dbData = db.read();
    const skill = dbData.skills.find(s => s._id === chat.umeykaId);
    const skillName = skill ? skill.skill : 'Услуга';
    const senderName = senderUserId === chat.clientUserId ? chat.clientName : chat.masterName;

    const notificationText = 
      `🤝 *Umeyka | Новое сообщение*\n\n` +
      `📝 *Услуга:* ${skillName}\n` +
      `👤 *От:* ${senderName}\n` +
      `💬 *Сообщение:*\n${message.text}\n\n` +
      `⏰ *Время:* ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n\n` +
      `📱 *Чтобы ответить, откройте приложение Umeyka:*`;

    console.log('📨 Отправка уведомления через бота для пользователя:', recipientUserId);

    // Пробуем найти Telegram ID пользователя
    let telegramId = null;
    const userData = db.getUserByUserId(recipientUserId);
    
    if (userData && userData.telegramId) {
      telegramId = userData.telegramId;
    } else if (isTelegramId(recipientUserId)) {
      telegramId = recipientUserId;
    }

    if (telegramId) {
      try {
        await bot.telegram.sendMessage(telegramId, notificationText, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '💬 Ответить в Umeyka',
                url: `https://umeyka-oocn.onrender.com/#chat=${chat._id}`
              }
            ]]
          }
        });
        console.log('✅ Уведомление через бота отправлено Telegram ID:', telegramId);
      } catch (botError) {
        console.error('❌ Ошибка отправки уведомления через бота:', botError.message);
      }
    } else {
      console.log('⚠️ Не найден Telegram ID для пользователя:', recipientUserId);
    }

  } catch (error) {
    console.error('❌ Ошибка в sendBotNotification:', error);
  }
}

// Основная функция отправки уведомлений в Telegram
async function sendTelegramNotification(recipientUserId, chat, message, senderUserId) {
  try {
    console.log('📨 Начало отправки уведомления:');
    console.log('   Получатель ID:', recipientUserId);
    console.log('   Чат ID:', chat._id);
    console.log('   Отправитель ID:', senderUserId);
    console.log('   Сообщение:', message.text);

    const senderName = senderUserId === chat.clientUserId ? chat.clientName : chat.masterName;
    const chatData = {
      chatId: chat._id,
      umeykaId: chat.umeykaId,
      senderName: senderName
    };

    // 1. Попробуем найти привязанный Telegram аккаунт
    const userData = db.getUserByUserId(recipientUserId);
    
    if (userData && userData.telegramId) {
      // У пользователя есть привязанный Telegram аккаунт
      console.log('✅ Найден привязанный Telegram ID:', userData.telegramId);
      
      // Обновляем время последней активности
      db.updateUserLastActive(recipientUserId);
      
      // Отправляем прямое сообщение
      const directSent = await sendDirectTelegramMessage(
        userData.telegramId,
        senderName,
        message.text,
        chatData
      );
      
      if (directSent) {
        console.log('✅ Сообщение отправлено напрямую в Telegram чат');
        return;
      }
    }

    // 2. Fallback: отправляем уведомление через бота
    console.log('🔄 Fallback: отправка через бота');
    await sendBotNotification(recipientUserId, chat, message, senderUserId);

  } catch (error) {
    console.error('❌ Критическая ошибка в sendTelegramNotification:', error);
    console.error('📋 Детали ошибки:', error.stack);
  }
}

// ========== КОМАНДЫ БОТА ==========

// Команда /start для бота
bot.command('start', async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name || 'Пользователь';
  
  console.log('👤 Пользователь запустил бота:', { telegramId, username });

  // Проверяем, привязан ли уже этот Telegram аккаунт
  const existingUser = db.getUserByTelegramId(telegramId);
  
  if (existingUser) {
    // Пользователь уже привязан
    ctx.reply(
      `✅ *Вы уже привязаны к Umeyka!*\n\n` +
      `👤 Ваш аккаунт: ${existingUser.username}\n` +
      `🆔 User ID: ${existingUser.userId}\n\n` +
      `📨 Теперь вы будете получать сообщения из чатов Umeyka прямо здесь!`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📱 Открыть Umeyka',
              url: 'https://umeyka-oocn.onrender.com'
            }
          ]]
        }
      }
    );
  } else {
    // Новый пользователь - создаем deep link для привязки
    const deepLink = `https://umeyka-oocn.onrender.com/#telegram=${telegramId}&username=${encodeURIComponent(username)}`;

    ctx.reply(
      `🤝 *Добро пожаловать в Umeyka!*\n\n` +
      `Чтобы получать сообщения из чатов Umeyka прямо в этот Telegram чат:\n\n` +
      `1. Откройте приложение Umeyka\n` +
      `2. Нажмите на кнопку ниже\n` +
      `3. Разрешите привязку аккаунта\n\n` +
      `После этого все сообщения из Umeyka будут приходить сюда!`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📱 Привязать мой аккаунт',
              url: deepLink
            }
          ]]
        }
      }
    );
  }
});

// Команда /help
bot.command('help', (ctx) => {
  ctx.reply(
    `🤖 *Команды бота Umeyka:*\n\n` +
    `/start - Привязать аккаунт к Umeyka\n` +
    `/help - Показать эту справку\n` +
    `/status - Проверить статус привязки\n\n` +
    `💬 *Как это работает:*\n` +
    `1. Привяжите ваш аккаунт через /start\n` +
    `2. Общайтесь в чатах Umeyka\n` +
    `3. Сообщения будут приходить сюда\n` +
    `4. Ответьте прямо здесь, чтобы отправить ответ в Umeyka\n\n` +
    `📱 *Открыть Umeyka:* https://umeyka-oocn.onrender.com`,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '📱 Открыть Umeyka',
            url: 'https://umeyka-oocn.onrender.com'
          }
        ]]
      }
    }
  );
});

// Команда /status
bot.command('status', (ctx) => {
  const telegramId = ctx.from.id;
  const userData = db.getUserByTelegramId(telegramId);
  
  if (userData) {
    ctx.reply(
      `✅ *Аккаунт привязан к Umeyka!*\n\n` +
      `👤 Имя: ${userData.username}\n` +
      `🆔 User ID: ${userData.userId}\n` +
      `📅 Привязан: ${new Date(userData.boundAt).toLocaleDateString('ru-RU')}\n` +
      `⏰ Последняя активность: ${new Date(userData.lastActive).toLocaleDateString('ru-RU')}\n\n` +
      `📨 Вы получаете сообщения из чатов Umeyka прямо здесь!`,
      { parse_mode: 'Markdown' }
    );
  } else {
    ctx.reply(
      `❌ *Аккаунт не привязан*\n\n` +
      `Для привязки аккаунта используйте команду /start\n\n` +
      `После привязки все сообщения из Umeyka будут приходить в этот чат.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Обработка ответов в чате (пользователь может ответить прямо в Telegram)
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id;
  const messageText = ctx.message.text;
  
  // Пропускаем команды
  if (messageText.startsWith('/')) return;
  
  // Проверяем, привязан ли пользователь
  const userData = db.getUserByTelegramId(telegramId);
  
  if (userData) {
    // Обновляем время последней активности
    db.updateUserLastActive(userData.userId);
    
    // Отправляем уведомление о возможности ответа
    ctx.reply(
      `✍️ *Чтобы ответить в Umeyka:*\n\n` +
      `1. Откройте приложение Umeyka\n` +
      `2. Перейдите в раздел "Чаты"\n` +
      `3. Выберите нужный чат\n` +
      `4. Напишите сообщение\n\n` +
      `📱 *Или откройте Umeyka сейчас:*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '💬 Открыть чаты в Umeyka',
              url: 'https://umeyka-oocn.onrender.com/#profile=chats'
            }
          ]]
        }
      }
    );
  } else {
    // Пользователь не привязан
    ctx.reply(
      `❌ *Аккаунт не привязан*\n\n` +
      `Используйте команду /start для привязки аккаунта к Umeyka.\n\n` +
      `После привязки вы сможете получать сообщения из Umeyka здесь.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ========== API ENDPOINTS ==========

// Получить все умейки
app.get('/api/skills', (req, res) => {
  try {
    const skills = db.getAllSkills();
    res.json({
      success: true,
      skills: skills.map(skill => ({
        ...skill,
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

// Создать умейку
app.post('/api/skills', (req, res) => {
  try {
    const skillData = req.body;
    
    if (!skillData.skill || !skillData.userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать умение и ID пользователя' 
      });
    }

    const newSkill = db.addSkill({
      skill: skillData.skill,
      experience: skillData.experience || 'Опыт не указан',
      price: skillData.price || 0,
      userId: skillData.userId,
      username: skillData.username || 'Аноним',
      isTopMaster: false,
      location: skillData.location || { lat: 55.7558, lon: 37.6173 },
      category: 'другое',
      contact: '',
      avatar: null,
      description: ''
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

// Увеличить просмотры
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

// Увеличить контакты
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

// Старая версия API для совместимости
app.post('/api/add-umeyka', (req, res) => {
  try {
    const { skill, experience, price, location, userId } = req.body;
    
    if (!skill || !experience || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newSkill = db.addSkill({
      skill,
      experience,
      price: parseFloat(price),
      userId: userId || 'demo-user',
      username: 'Пользователь',
      location: location || { lat: 55.7558, lon: 37.6173 }
    });

    if (newSkill) {
      res.json({ 
        success: true, 
        message: 'Умейка успешно добавлена!',
        id: newSkill._id 
      });
    } else {
      res.status(500).json({ error: 'Failed to save data' });
    }
  } catch (err) {
    console.error('❌ Error saving umeyka:', err);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Старый поиск для совместимости
app.get('/api/search-umeyka', (req, res) => {
  try {
    const { query } = req.query;
    const skills = db.searchSkills(query || '');
    
    if (skills.length === 0) {
      const demoSkills = [
        {
          _id: '1',
          skill: 'Ремонт смартфонов',
          experience: '5 лет опыта',
          price: 1500,
          location: { lat: 55.7558, lon: 37.6176 },
          username: 'Алексей',
          rating: { average: 8.7, count: 15 },
          isTopMaster: true
        },
        {
          _id: '2', 
          skill: 'Установка кондиционеров',
          experience: '3 года опыта',
          price: 3000,
          location: { lat: 55.7520, lon: 37.6170 },
          username: 'Сергей',
          rating: { average: 7.2, count: 8 }
        }
      ];
      return res.json(query ? 
        demoSkills.filter(s => s.skill.toLowerCase().includes(query.toLowerCase())) : 
        demoSkills
      );
    }
    
    res.json(skills);
  } catch (err) {
    console.error('Error searching umeyka:', err);
    res.json([]);
  }
});

// Старый эндпоинт для моих умейок
app.get('/api/my-umeyka/:userId', (req, res) => {
  try {
    const skills = db.getUserSkills(req.params.userId);
    res.json(skills);
  } catch (err) {
    console.error('Error fetching user skills:', err);
    res.status(500).json({ error: 'Failed to fetch user skills' });
  }
});

// ========== API ДЛЯ ЧАТОВ ==========

// Создание чата
app.post('/api/chats', (req, res) => {
  try {
    const { clientUserId, masterUserId, umeykaId, clientName, masterName } = req.body;
    
    console.log('💬 Создание чата:', { clientUserId, masterUserId, umeykaId });
    
    if (!clientUserId || !masterUserId || !umeykaId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать clientUserId, masterUserId и umeykaId' 
      });
    }

    const dbData = db.read();
    if (!dbData) {
      return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
    }

    // Проверяем, существует ли уже чат
    const existingChat = dbData.chats.find(chat => 
      chat.clientUserId === clientUserId && 
      chat.masterUserId === masterUserId && 
      chat.umeykaId === umeykaId &&
      chat.isActive !== false
    );

    if (existingChat) {
      console.log('💬 Чат уже существует, возвращаем существующий');
      return res.json({ 
        success: true, 
        chatId: existingChat._id,
        isNew: false 
      });
    }

    // Создаем новый чат
    const newChat = {
      _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      clientUserId,
      masterUserId,
      umeykaId,
      clientName: clientName || 'Клиент',
      masterName: masterName || 'Мастер',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      unreadCount: 0
    };

    dbData.chats.push(newChat);
    
    if (db.write(dbData)) {
      console.log('✅ Чат создан:', newChat._id);
      return res.json({ 
        success: true, 
        chatId: newChat._id,
        isNew: true 
      });
    } else {
      return res.status(500).json({ success: false, error: 'Ошибка сохранения чата' });
    }

  } catch (error) {
    console.error('❌ Ошибка создания чата:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получение сообщений чата
app.get('/api/chats/:chatId/messages', (req, res) => {
  try {
    const chatId = req.params.chatId;
    const userId = req.query.userId;
    
    console.log('📥 Загрузка сообщений чата:', { chatId, userId });
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать userId' 
      });
    }

    const dbData = db.read();
    if (!dbData) {
      return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
    }

    const chat = dbData.chats.find(c => c._id === chatId && c.isActive !== false);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    // Проверяем, является ли пользователь участником чата
    if (userId !== chat.clientUserId && userId !== chat.masterUserId) {
      return res.status(403).json({ success: false, error: 'Нет доступа к чату' });
    }

    // Помечаем сообщения как прочитанные при загрузке
    chat.messages.forEach(msg => {
      if (msg.senderUserId !== userId) {
        msg.isRead = true;
      }
    });
    chat.unreadCount = 0;
    db.write(dbData);

    return res.json({ 
      success: true, 
      messages: chat.messages,
      chatInfo: {
        clientName: chat.clientName,
        masterName: chat.masterName,
        umeykaId: chat.umeykaId
      }
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки сообщений:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Отправка сообщения в чат с уведомлением в Telegram
app.post('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { senderUserId, text } = req.body;
        
    console.log('📨 Отправка сообщения в чат:', { chatId, senderUserId });
        
    if (!senderUserId || !text || !text.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать senderUserId и текст сообщения' 
      });
    }

    const dbData = db.read();
    if (!dbData) {
      return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
    }

    const chat = dbData.chats.find(c => c._id === chatId && c.isActive !== false);
    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    // Проверяем, является ли пользователь участником чата
    if (senderUserId !== chat.clientUserId && senderUserId !== chat.masterUserId) {
      return res.status(403).json({ success: false, error: 'Нет доступа к чату' });
    }

    // Создаем сообщение
    const newMessage = {
      _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      senderUserId,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      isRead: false
    };

    chat.messages.push(newMessage);
    chat.updatedAt = new Date().toISOString();
        
    // Увеличиваем счетчик непрочитанных для другого участника
    const recipientUserId = senderUserId === chat.clientUserId ? chat.masterUserId : chat.clientUserId;
    chat.unreadCount = (chat.unreadCount || 0) + 1;

    if (db.write(dbData)) {
      console.log('✅ Сообщение сохранено в базе:', newMessage._id);
      console.log('👤 Отправитель:', senderUserId);
      console.log('👤 Получатель:', recipientUserId);
          
      // ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ В TELEGRAM (асинхронно, не ждем ответа)
      sendTelegramNotification(recipientUserId, chat, newMessage, senderUserId).catch(err => {
        console.error('⚠️ Уведомление не отправлено, но сообщение сохранено:', err.message);
      });
          
      return res.json({ 
        success: true, 
        messageId: newMessage._id 
      });
    } else {
      return res.status(500).json({ success: false, error: 'Ошибка сохранения сообщения' });
    }

  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получение списка чатов пользователя
app.get('/api/users/:userId/chats', (req, res) => {
  try {
    const userId = req.params.userId;
    
    console.log('📋 Загрузка чатов пользователя:', userId);
    
    const dbData = db.read();
    if (!dbData) {
      return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
    }

    const userChats = dbData.chats.filter(chat => 
      chat.isActive !== false && 
      (chat.clientUserId === userId || chat.masterUserId === userId)
    );

    // Сортируем по дате последнего сообщения
    userChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return res.json({ 
      success: true, 
      chats: userChats.map(chat => ({
        _id: chat._id,
        clientUserId: chat.clientUserId,
        masterUserId: chat.masterUserId,
        clientName: chat.clientName,
        masterName: chat.masterName,
        umeykaId: chat.umeykaId,
        lastMessage: chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null,
        unreadCount: chat.unreadCount || 0,
        updatedAt: chat.updatedAt
      }))
    });

  } catch (error) {
    console.error('❌ Ошибка загрузки чатов:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ========== API ДЛЯ TELEGRAM ПРИВЯЗКИ ==========

// Привязка Telegram аккаунта
app.post('/api/users/:userId/telegram', (req, res) => {
  try {
    const userId = req.params.userId;
    const { telegramId, username, first_name, last_name } = req.body;

    console.log('🔗 Привязка Telegram аккаунта:', { userId, telegramId, username });

    if (!telegramId || !isTelegramId(telegramId)) {
      return res.status(400).json({
        success: false,
        error: 'Неверный Telegram ID'
      });
    }

    // Проверяем, не привязан ли уже этот Telegram ID к другому аккаунту
    const existingUser = db.getUserByTelegramId(telegramId);
    if (existingUser && existingUser.userId !== userId) {
      return res.status(400).json({
        success: false,
        error: 'Этот Telegram аккаунт уже привязан к другому пользователю'
      });
    }

    // Привязываем аккаунт
    const success = db.bindTelegramUser(telegramId, userId, {
      username: username || 'Пользователь',
      first_name: first_name || '',
      last_name: last_name || ''
    });

    if (success) {
      console.log('✅ Telegram аккаунт успешно привязан:', { userId, telegramId });
      
      // Отправляем подтверждение в Telegram
      try {
        bot.telegram.sendMessage(telegramId,
          `✅ *Telegram успешно привязан к Umeyka!*\n\n` +
          `Теперь вы будете получать сообщения из чатов Umeyka прямо в этот чат.\n\n` +
          `👤 Ваш аккаунт: ${username || 'Пользователь'}\n` +
          `🆔 User ID: ${userId}\n\n` +
          `💬 Все новые сообщения из Umeyka будут приходить сюда.`,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '📱 Открыть Umeyka',
                  url: 'https://umeyka-oocn.onrender.com'
                }
              ]]
            }
          }
        ).then(() => {
          console.log('✅ Подтверждение отправлено в Telegram');
        }).catch(err => {
          console.log('⚠️ Не удалось отправить подтверждение:', err.message);
        });
      } catch (error) {
        console.log('⚠️ Ошибка отправки подтверждения:', error.message);
      }

      return res.json({
        success: true,
        message: 'Telegram аккаунт успешно привязан',
        telegramId: telegramId
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'Ошибка привязки аккаунта' 
    });

  } catch (error) {
    console.error('❌ Ошибка привязки Telegram аккаунта:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

// Проверка привязки Telegram аккаунта
app.get('/api/users/:userId/telegram', (req, res) => {
  try {
    const userId = req.params.userId;
    
    const userData = db.getUserByUserId(userId);
    
    if (userData) {
      return res.json({
        success: true,
        isBound: true,
        telegramId: userData.telegramId,
        username: userData.username,
        boundAt: userData.boundAt,
        lastActive: userData.lastActive
      });
    } else {
      return res.json({
        success: true,
        isBound: false
      });
    }

  } catch (error) {
    console.error('❌ Ошибка проверки привязки:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

// Отвязка Telegram аккаунта
app.delete('/api/users/:userId/telegram', (req, res) => {
  try {
    const userId = req.params.userId;
    
    const dbData = db.read();
    if (!dbData) {
      return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
    }

    // Ищем и удаляем привязку
    let removed = false;
    if (dbData.telegramUsers) {
      for (const [telegramId, userData] of Object.entries(dbData.telegramUsers)) {
        if (userData.userId === userId) {
          delete dbData.telegramUsers[telegramId];
          removed = true;
          break;
        }
      }
    }

    // Также удаляем из старой структуры
    if (dbData.users && dbData.users[userId]) {
      delete dbData.users[userId].telegramId;
    }

    if (removed && db.write(dbData)) {
      console.log('✅ Telegram аккаунт отвязан:', userId);
      return res.json({
        success: true,
        message: 'Telegram аккаунт успешно отвязан'
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Привязка не найдена'
      });
    }

  } catch (error) {
    console.error('❌ Ошибка отвязки Telegram аккаунта:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

// ========== API ДЛЯ ТЕСТИРОВАНИЯ ==========

// Эндпоинт для проверки статуса бота
app.get('/api/bot/status', (req, res) => {
  const botInfo = {
    isRunning: !!BOT_TOKEN && BOT_TOKEN.trim() !== '',
    hasToken: !!BOT_TOKEN && BOT_TOKEN.trim() !== '',
    tokenLength: BOT_TOKEN ? BOT_TOKEN.length : 0,
    botUsername: bot.botInfo?.username || 'Не определен',
    totalUsers: db.read()?.telegramUsers ? Object.keys(db.read().telegramUsers).length : 0,
    timestamp: new Date().toISOString()
  };
  
  res.json({
    success: true,
    bot: botInfo,
    instructions: !BOT_TOKEN || BOT_TOKEN.trim() === '' ? 
      '❌ Токен бота не установлен. Добавьте BOT_TOKEN в .env файл' : 
      '✅ Бот настроен корректно'
  });
});

// Эндпоинт для отправки тестового уведомления
app.post('/api/test-notification', async (req, res) => {
  try {
    const { telegramId, message } = req.body;
    
    if (!telegramId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Необходимо указать telegramId и сообщение' 
      });
    }
    
    console.log('🧪 Отправка тестового уведомления на Telegram ID:', telegramId);
    
    await bot.telegram.sendMessage(telegramId, 
      `🧪 *Тестовое уведомление от Umeyka*\n\n` +
      `${message}\n\n` +
      `✅ Если вы видите это сообщение, бот работает корректно!\n\n` +
      `💬 Теперь вы будете получать сообщения из чатов Umeyka прямо здесь.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📱 Открыть Umeyka',
              url: 'https://umeyka-oocn.onrender.com'
            }
          ]]
        }
      }
    );
    
    res.json({ 
      success: true, 
      message: 'Тестовое уведомление отправлено' 
    });
    
  } catch (error) {
    console.error('❌ Ошибка отправки тестового уведомления:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка отправки: ' + error.message 
    });
  }
});

// Получение статистики системы
app.get('/api/stats', (req, res) => {
  try {
    const dbData = db.read();
    
    if (!dbData) {
      return res.status(500).json({ success: false, error: 'Ошибка базы данных' });
    }

    const stats = {
      totalSkills: dbData.skills.filter(s => s.isActive !== false).length,
      totalChats: dbData.chats.filter(c => c.isActive !== false).length,
      totalTelegramUsers: dbData.telegramUsers ? Object.keys(dbData.telegramUsers).length : 0,
      recentMessages: dbData.chats.reduce((total, chat) => total + chat.messages.length, 0),
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Health check
app.get('/health', (req, res) => {
  const dbData = db.read();
  const skillsCount = dbData ? dbData.skills.filter(s => s.isActive !== false).length : 0;
  const telegramUsersCount = dbData && dbData.telegramUsers ? Object.keys(dbData.telegramUsers).length : 0;
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    version: '2.0.0',
    database: 'JSON',
    stats: {
      skills: skillsCount,
      telegramUsers: telegramUsersCount
    }
  });
});

// Простая версия
app.get('/simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simple-index.html'));
});

// Главная страница
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== ОБРАБОТКА ОШИБОК ==========

// Обработка 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Эндпоинт не найден',
    path: req.path
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('❌ Необработанная ошибка:', err);
  res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера',
    message: err.message
  });
});

// ========== ЗАПУСК СЕРВЕРА ==========

app.listen(port, () => {
  console.log(`🚀 Сервер запущен на порту ${port}`);
  console.log(`🌐 Основное приложение: http://localhost:${port}`);
  console.log(`📱 Простая версия: http://localhost:${port}/simple`);
  console.log(`💚 Проверка здоровья: http://localhost:${port}/health`);
  
  const dbData = db.read();
  console.log(`📊 Всего умейок в базе: ${db.getAllSkills().length}`);
  console.log(`👤 Привязанных Telegram аккаунтов: ${dbData.telegramUsers ? Object.keys(dbData.telegramUsers).length : 0}`);
  console.log(`💬 Всего чатов: ${dbData.chats ? dbData.chats.length : 0}`);
  
  if (BOT_TOKEN && BOT_TOKEN.trim() !== '') {
    console.log(`🤖 Бот запущен: https://t.me/${bot.botInfo?.username || 'ваш_бот'}`);
  } else {
    console.log(`⚠️  Бот НЕ запущен. Установите BOT_TOKEN в .env файле`);
  }
  
  console.log(`✅ Готово к работе!`);
});

// Обработка graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Получен сигнал SIGTERM, завершаем работу...');
  bot.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Получен сигнал SIGINT, завершаем работу...');
  bot.stop();
  process.exit(0);
});
