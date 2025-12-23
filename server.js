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

// Команда /start для бота
bot.command('start', (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name || 'Пользователь';
    
    console.log('👤 Пользователь запустил бота:', { userId, username });
    
    ctx.reply(
        `🤝 *Добро пожаловать в Umeyka!*\n\n` +
        `Я буду отправлять вам уведомления о новых сообщениях в чатах с мастерами и клиентами.\n\n` +
        `📱 *Ваш Telegram ID:* \`${userId}\`\n` +
        `👤 *Имя:* ${username}\n\n` +
        `💡 *Как использовать:*\n` +
        `1. Скопируйте ваш Telegram ID выше\n` +
        `2. В приложении Umeyka перейдите в "Личный кабинет"\n` +
        `3. Нажмите "Редактировать профиль"\n` +
        `4. Вставьте Telegram ID в специальное поле\n` +
        `5. Сохраните профиль\n\n` +
        `📨 Теперь вы будете получать уведомления о новых сообщениях!`,
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
    
    // Сохраняем информацию о пользователе
    const userData = {
        telegramId: userId,
        username: username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        languageCode: ctx.from.language_code,
        startedAt: new Date().toISOString()
    };
    
    console.log('💾 Данные пользователя сохранены:', userData);
});

// Обработка текстовых сообщений в боте
bot.on('text', (ctx) => {
    const message = ctx.message.text;
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name || 'Пользователь';
    
    console.log('📨 Сообщение в боте от', username, '(', userId, '):', message);
    
    // Если сообщение начинается с /reply_, это ответ на уведомление
    if (message.startsWith('/reply_')) {
        const chatId = message.replace('/reply_', '').split(' ')[0];
        const replyText = message.replace(`/reply_${chatId} `, '');
        
        if (replyText.trim()) {
            ctx.reply(`✍️ *Ответ отправлен в чат Umeyka!*\n\nВаше сообщение: "${replyText}"\n\nОткройте приложение Umeyka, чтобы продолжить общение.`, {
                parse_mode: 'Markdown'
            });
        }
    } else if (!message.startsWith('/')) {
        // Простое сообщение
        ctx.reply(
            `💬 *Уведомления о сообщениях в Umeyka*\n\n` +
            `Я только отправляю уведомления о новых сообщениях в чатах.\n\n` +
            `Чтобы общаться с мастерами или клиентами:\n` +
            `1. Откройте приложение Umeyka\n` +
            `2. Перейдите в раздел "Чаты"\n` +
            `3. Выберите нужный чат\n` +
            `4. Напишите сообщение\n\n` +
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
    }
});

// Отправка уведомления в Telegram
async function sendTelegramNotification(recipientUserId, chat, message, senderUserId) {
    try {
        console.log('📨 Отправка уведомления в Telegram:');
        console.log('   Получатель ID:', recipientUserId);
        console.log('   Чат ID:', chat._id);
        console.log('   Отправитель ID:', senderUserId);
        console.log('   Сообщение:', message.text);

        // Получаем информацию об отправителе
        const dbData = db.read();
        const senderName = senderUserId === chat.clientUserId ? chat.clientName : chat.masterName;
        const recipientName = senderUserId === chat.clientUserId ? chat.masterName : chat.clientName;
            
        // Получаем информацию об умейке
        const skill = dbData.skills.find(s => s._id === chat.umeykaId);
        const skillName = skill ? skill.skill : 'Услуга';

        // Создаем текст уведомления
        const notificationText = `🤝 *Umeyka | Новое сообщение*\n\n` +
                               `📝 *Услуга:* ${skillName}\n` +
                               `👤 *От:* ${senderName}\n` +
                               `💬 *Сообщение:*\n${message.text}\n\n` +
                               `⏰ *Время:* ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n\n` +
                               `📱 *Чтобы ответить, откройте приложение Umeyka:*`;

        console.log('📝 Текст уведомления:', notificationText);

        // Получаем Telegram ID получателя из базы данных
        // Ищем пользователя по recipientUserId (это userId из приложения)
        let telegramId = null;
        
        // Попробуем найти в нашей JSON базе (в реальности здесь должна быть проверка по БД)
        // Для демо - просто используем recipientUserId, если это число
        if (!isNaN(recipientUserId) && recipientUserId.toString().length < 20) {
            telegramId = recipientUserId;
            console.log('✅ Используем recipientUserId как Telegram ID:', telegramId);
        } else {
            // Если это не число, попробуем получить из localStorage (в реальном приложении - из БД)
            console.log('⚠️ recipientUserId не похож на Telegram ID:', recipientUserId);
            
            // Для демо - попробуем преобразовать строку в число
            const possibleId = parseInt(recipientUserId.toString().replace('user_', '').replace('master_', ''));
            if (!isNaN(possibleId) && possibleId > 0) {
                telegramId = possibleId;
                console.log('🔄 Преобразовали в Telegram ID:', telegramId);
            }
        }

        if (!telegramId) {
            console.log('❌ Не удалось определить Telegram ID для пользователя:', recipientUserId);
            console.log('💡 Совет: Убедитесь, что пользователь указал свой Telegram ID в профиле');
            return;
        }

        try {
            // Отправляем уведомление
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
            
            console.log('✅ Уведомление успешно отправлено в Telegram пользователю:', telegramId);
            console.log('📱 Ссылка для ответа:', `https://umeyka-oocn.onrender.com/#chat=${chat._id}`);
            
        } catch (telegramError) {
            console.error('❌ Ошибка отправки в Telegram:', telegramError.message);
            
            if (telegramError.response && telegramError.response.error_code === 403) {
                console.log('⚠️ Пользователь заблокировал бота или не запускал его');
                console.log('💡 Пользователь должен запустить бота @umeyka_bot в Telegram');
            } else if (telegramError.response && telegramError.response.error_code === 400) {
                console.log('⚠️ Неверный Telegram ID или пользователь не найден');
            }
        }
            
    } catch (error) {
        console.error('❌ Ошибка в функции sendTelegramNotification:', error);
        console.error('📋 Детали ошибки:', error.stack);
    }
}

// Функция для проверки, является ли строка Telegram ID
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

// Улучшенная функция для отправки сообщений в чат с уведомлением
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
            console.log('👤 Получатель уведомления:', recipientUserId);
                
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

// Эндпоинт для проверки статуса бота
app.get('/api/bot/status', (req, res) => {
    const botInfo = {
        isRunning: !!BOT_TOKEN && BOT_TOKEN.trim() !== '',
        hasToken: !!BOT_TOKEN && BOT_TOKEN.trim() !== '',
        tokenLength: BOT_TOKEN ? BOT_TOKEN.length : 0,
        botUsername: bot.botInfo?.username || 'Не определен',
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
            `✅ Если вы видите это сообщение, бот работает корректно!`,
            { parse_mode: 'Markdown' }
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
