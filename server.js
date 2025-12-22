const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { Telegraf } = require('telegraf');

// Создаем бота (токен должен быть в переменных окружения!)
const BOT_TOKEN = process.env.BOT_TOKEN 
const bot = new Telegraf(BOT_TOKEN);

// Запускаем бота
if (BOT_TOKEN && BOT_TOKEN !== 'ВАШ_ТОКЕН_ЗДЕСЬ') {
    bot.launch().then(() => {
        console.log('🤖 Telegram бот запущен');
    }).catch(err => {
        console.error('❌ Ошибка запуска бота:', err);
    });
} else {
    console.log('⚠️ Telegram бот не запущен: не указан токен');
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
        deals: []
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

// Отправка сообщения с уведомлением в Telegram
app.post('/api/chats/:chatId/messages', (req, res) => {
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
           console.log('✅ Сообщение отправлено:', newMessage._id);
                
            // ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ В TELEGRAM
            sendTelegramNotification(recipientUserId, chat, newMessage, senderUserId);
                
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

// Функция отправки уведомления в Telegram
async function sendTelegramNotification(recipientUserId, chat, message, senderUserId) {
    try {
        // Получаем информацию об отправителе
        const dbData = db.read();
        const senderName = senderUserId === chat.clientUserId ? chat.clientName : chat.masterName;
        const recipientName = senderUserId === chat.clientUserId ? chat.masterName : chat.clientName;
            
        // Получаем информацию об умейке
        const skill = dbData.skills.find(s => s._id === chat.umeykaId);
        const skillName = skill ? skill.skill : 'Услуга';
            
        // Создаем текст уведомления
        const notificationText = `🤝 *Умейка | Новое сообщение*\n\n` +
                               `📝 *Услуга:* ${skillName}\n` +
                               `👤 *От:* ${senderName}\n\n` +
                               `💬 *Сообщение:*\n${message.text}\n\n` +
                               `📱 *Ответить:* /reply_${chat._id}`;
            
        // Пытаемся отправить сообщение
        // Если recipientUserId это Telegram ID (число), отправляем напрямую
        if (!isNaN(recipientUserId) && recipientUserId.length < 20) {
            // Это похоже на Telegram ID
            await bot.telegram.sendMessage(recipientUserId, notificationText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '💬 Ответить в Umeyka',
                            url: `https://umeyka-oocn.onrender.com#chat=${chat._id}`
                        }
                    ]]
                }
            });
            console.log('📨 Уведомление отправлено в Telegram пользователю:', recipientUserId);
        } else {
            console.log('⚠️ Не Telegram ID, уведомление не отправлено:', recipientUserId);
        }
            
    } catch (error) {
        console.error('❌ Ошибка отправки уведомления в Telegram:', error);
        // Не прерываем выполнение, если не удалось отправить в Telegram
    }
}

// Команда /start для бота
bot.command('start', (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name;
        
    console.log('👤 Пользователь запустил бота:', userId, username);
        
    ctx.reply(
        `🤝 *Добро пожаловать в Umeyka!*\n\n` +
        `Я буду отправлять вам уведомления о новых сообщениях в чатах с мастерами и клиентами.\n\n` +
        `📱 *Ваш ID:* ${userId}\n` +
        `👤 *Имя:* ${username}\n\n` +
        `Чтобы получать уведомления, укажите этот ID в настройках профиля в приложении Umeyka.`,
        { parse_mode: 'Markdown' }
    );
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

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Umeyka server is running',
    version: '1.0.0',
    database: 'JSON'
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

// ========== ЗАПУСК СЕРВЕРА ==========

app.listen(port, () => {
  console.log(`🚀 Сервер запущен на порту ${port}`);
  console.log(`🌐 Основное приложение: http://localhost:${port}`);
  console.log(`📱 Простая версия: http://localhost:${port}/simple`);
  console.log(`💚 Проверка здоровья: http://localhost:${port}/health`);
  console.log(`📊 Всего умейок в базе: ${db.getAllSkills().length}`);
  console.log(`✅ Готово к работе!`);
});
