const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { Telegraf } = require('telegraf');

// Создаем бота
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const bot = new Telegraf(BOT_TOKEN);

if (!BOT_TOKEN || BOT_TOKEN.trim() === '') {
    console.error('❌ ОШИБКА: Не указан токен Telegram бота!');
    console.log('ℹ️  Чтобы получить токен:');
    console.log('1. Найдите @BotFather в Telegram');
    console.log('2. Создайте нового бота или получите токен существующего');
    console.log('3. Добавьте токен в .env файл: BOT_TOKEN=ваш_токен');
} else {
    bot.launch().then(() => {
        console.log('🤖 Telegram бот успешно запущен!');
        console.log('👤 Бот доступен по ссылке: https://t.me/' + (bot.botInfo?.username || 'ваш_бот'));
    }).catch(err => {
        console.error('❌ Ошибка запуска бота:', err.message);
    });
}

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ========== УЛУЧШЕННЫЙ JSON ДАТАБЕЙЗ ==========

const fs = require('fs');
const DB_PATH = path.join(__dirname, 'data', 'db.json');

if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = {
    init() {
        if (!fs.existsSync(DB_PATH)) {
            const initialData = {
                skills: [],
                users: {},
                chats: [],
                deals: [], // Новая коллекция для сделок
                telegramUsers: {}
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

    // Методы для сделок
    getAllDeals() {
        const dbData = this.read();
        return dbData?.deals || [];
    },

    getDealById(dealId) {
        const dbData = this.read();
        if (!dbData || !dbData.deals) return null;
        return dbData.deals.find(deal => deal.id === dealId);
    },

    getUserDeals(userId) {
        const dbData = this.read();
        if (!dbData || !dbData.deals) return [];
        return dbData.deals.filter(deal => 
            deal.clientId === userId || deal.masterId === userId
        );
    },

    getMasterDeals(masterId) {
        const dbData = this.read();
        if (!dbData || !dbData.deals) return [];
        return dbData.deals.filter(deal => deal.masterId === masterId);
    },

    createDeal(dealData) {
        const dbData = this.read();
        if (!dbData) return null;

        if (!dbData.deals) {
            dbData.deals = [];
        }

        const newDeal = {
            id: 'deal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...dealData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'pending',
            clientSigned: false,
            masterSigned: false,
            clientSeen: false,
            masterSeen: false,
            messages: []
        };

        dbData.deals.push(newDeal);
        
        if (this.write(dbData)) {
            console.log('✅ Сделка создана:', newDeal.id);
            return newDeal;
        }
        return null;
    },

    updateDeal(dealId, updates) {
        const dbData = this.read();
        if (!dbData || !dbData.deals) return false;

        const dealIndex = dbData.deals.findIndex(deal => deal.id === dealId);
        if (dealIndex === -1) return false;

        dbData.deals[dealIndex] = {
            ...dbData.deals[dealIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        return this.write(dbData);
    },

    addDealMessage(dealId, messageData) {
        const dbData = this.read();
        if (!dbData || !dbData.deals) return false;

        const dealIndex = dbData.deals.findIndex(deal => deal.id === dealId);
        if (dealIndex === -1) return false;

        if (!dbData.deals[dealIndex].messages) {
            dbData.deals[dealIndex].messages = [];
        }

        const newMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...messageData,
            timestamp: new Date().toISOString(),
            isRead: false
        };

        dbData.deals[dealIndex].messages.push(newMessage);
        dbData.deals[dealIndex].updatedAt = new Date().toISOString();

        return this.write(dbData);
    },

    markDealMessagesAsRead(dealId, userId) {
        const dbData = this.read();
        if (!dbData || !dbData.deals) return false;

        const dealIndex = dbData.deals.findIndex(deal => deal.id === dealId);
        if (dealIndex === -1) return false;

        if (dbData.deals[dealIndex].messages) {
            dbData.deals[dealIndex].messages.forEach(msg => {
                if (msg.senderId !== userId) {
                    msg.isRead = true;
                }
            });
        }

        // Помечаем как просмотренное для пользователя
        if (dbData.deals[dealIndex].clientId === userId) {
            dbData.deals[dealIndex].clientSeen = true;
        } else if (dbData.deals[dealIndex].masterId === userId) {
            dbData.deals[dealIndex].masterSeen = true;
        }

        return this.write(dbData);
    },

    // Существующие методы для умейок
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

    searchSkills(query, filters = {}) {
        const skills = this.getAllSkills();
        const searchTerm = query.toLowerCase();

        return skills.filter(skill => {
            const matchesText = 
                skill.skill.toLowerCase().includes(searchTerm) ||
                skill.experience.toLowerCase().includes(searchTerm);

            const matchesPrice = !filters.maxPrice || skill.price <= filters.maxPrice;
            const matchesRating = !filters.minRating || 
                (skill.rating?.average || 0) >= filters.minRating;

            return matchesText && matchesPrice && matchesRating;
        });
    },

    getUserByTelegramId(telegramId) {
        const dbData = this.read();
        if (!dbData) return null;

        return dbData.telegramUsers[telegramId] || null;
    },

    getUserByUserId(userId) {
        const dbData = this.read();
        if (!dbData) return null;

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

        if (!dbData.users) {
            dbData.users = {};
        }
        
        if (!dbData.users[userId]) {
            dbData.users[userId] = {};
        }
        
        dbData.users[userId].telegramId = telegramId;
        dbData.users[userId].username = userData.username || 'Пользователь';

        return this.write(dbData);
    }
};

db.init();

// ========== API ДЛЯ СДЕЛОК ==========

// Создание сделки
app.post('/api/deals', async (req, res) => {
    try {
        const dealData = req.body;
        
        console.log('📝 Создание сделки:', dealData);

        // Валидация
        if (!dealData.title || !dealData.description || !dealData.period || 
            !dealData.amount || !dealData.clientId || !dealData.masterId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо заполнить все обязательные поля' 
            });
        }

        // Создаем сделку
        const newDeal = db.createDeal({
            title: dealData.title,
            description: dealData.description,
            period: dealData.period,
            amount: parseInt(dealData.amount),
            quality: dealData.quality || 'standard',
            options: dealData.options || [],
            commission: Math.round(dealData.amount * 0.05),
            total: Math.round(dealData.amount * 1.05),
            clientId: dealData.clientId,
            clientName: dealData.clientName || 'Клиент',
            masterId: dealData.masterId,
            masterName: dealData.masterName || 'Мастер',
            masterSkill: dealData.masterSkill || '',
            masterContact: dealData.masterContact || '',
            skillId: dealData.skillId || null
        });

        if (!newDeal) {
            return res.status(500).json({ 
                success: false, 
                error: 'Ошибка создания сделки' 
            });
        }

        // Отправляем уведомление мастеру через Telegram
        await sendDealNotificationToMaster(newDeal);

        res.json({ 
            success: true, 
            deal: newDeal 
        });

    } catch (error) {
        console.error('❌ Ошибка создания сделки:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Получение сделки по ID
app.get('/api/deals/:dealId', (req, res) => {
    try {
        const dealId = req.params.dealId;
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать userId' 
            });
        }

        const deal = db.getDealById(dealId);
        
        if (!deal) {
            return res.status(404).json({ 
                success: false, 
                error: 'Сделка не найдена' 
            });
        }

        // Проверяем доступ пользователя к сделке
        if (deal.clientId !== userId && deal.masterId !== userId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Нет доступа к сделке' 
            });
        }

        // Помечаем как просмотренное
        if (deal.clientId === userId) {
            db.updateDeal(dealId, { clientSeen: true });
        } else if (deal.masterId === userId) {
            db.updateDeal(dealId, { masterSeen: true });
        }

        res.json({ 
            success: true, 
            deal: deal 
        });

    } catch (error) {
        console.error('❌ Ошибка получения сделки:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Получение сделок пользователя
app.get('/api/deals/user/:userId', (req, res) => {
    try {
        const userId = req.params.userId;
        const status = req.query.status; // Опциональный фильтр по статусу
        
        let deals = db.getUserDeals(userId);
        
        if (status) {
            deals = deals.filter(deal => deal.status === status);
        }
        
        // Сортируем по дате создания (новые сначала)
        deals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ 
            success: true, 
            deals: deals 
        });

    } catch (error) {
        console.error('❌ Ошибка получения сделок пользователя:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Получение сделок мастера
app.get('/api/deals/master/:masterId', (req, res) => {
    try {
        const masterId = req.params.masterId;
        const status = req.query.status;
        
        let deals = db.getMasterDeals(masterId);
        
        if (status) {
            deals = deals.filter(deal => deal.status === status);
        }
        
        deals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ 
            success: true, 
            deals: deals 
        });

    } catch (error) {
        console.error('❌ Ошибка получения сделок мастера:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Обновление сделки (подпись, статус и т.д.)
app.put('/api/deals/:dealId', async (req, res) => {
    try {
        const dealId = req.params.dealId;
        const updates = req.body;
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать userId' 
            });
        }

        const deal = db.getDealById(dealId);
        
        if (!deal) {
            return res.status(404).json({ 
                success: false, 
                error: 'Сделка не найдена' 
            });
        }

        // Проверяем доступ пользователя к сделке
        if (deal.clientId !== userId && deal.masterId !== userId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Нет доступа к сделке' 
            });
        }

        // Проверяем подпись
        if (updates.clientSigned === true && deal.clientId === userId) {
            updates.clientSigned = true;
            
            // Отправляем уведомление мастеру
            if (deal.masterId) {
                await sendDealUpdateNotification(deal, 'client_signed');
            }
        }

        if (updates.masterSigned === true && deal.masterId === userId) {
            updates.masterSigned = true;
            
            // Отправляем уведомление клиенту
            if (deal.clientId) {
                await sendDealUpdateNotification(deal, 'master_signed');
            }
        }

        // Проверяем, обе ли стороны подписали
        const clientSigned = updates.clientSigned !== undefined ? updates.clientSigned : deal.clientSigned;
        const masterSigned = updates.masterSigned !== undefined ? updates.masterSigned : deal.masterSigned;

        if (clientSigned && masterSigned && deal.status === 'pending') {
            updates.status = 'active';
            // Отправляем уведомление обеим сторонам
            await sendDealUpdateNotification(deal, 'deal_active');
        }

        // Обработка завершения сделки
        if (updates.status === 'completed' && deal.masterId === userId) {
            updates.status = 'completed';
            updates.completedAt = new Date().toISOString();
            await sendDealUpdateNotification(deal, 'deal_completed');
        }

        // Обновляем сделку
        const success = db.updateDeal(dealId, updates);
        
        if (success) {
            const updatedDeal = db.getDealById(dealId);
            res.json({ 
                success: true, 
                deal: updatedDeal 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Ошибка обновления сделки' 
            });
        }

    } catch (error) {
        console.error('❌ Ошибка обновления сделки:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Добавление сообщения в сделку
app.post('/api/deals/:dealId/messages', async (req, res) => {
    try {
        const dealId = req.params.dealId;
        const { senderId, text } = req.body;
        
        if (!senderId || !text || !text.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать senderId и текст сообщения' 
            });
        }

        const deal = db.getDealById(dealId);
        
        if (!deal) {
            return res.status(404).json({ 
                success: false, 
                error: 'Сделка не найдена' 
            });
        }

        // Проверяем доступ пользователя к сделке
        if (deal.clientId !== senderId && deal.masterId !== senderId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Нет доступа к сделке' 
            });
        }

        // Добавляем сообщение
        const messageData = {
            senderId: senderId,
            text: text.trim(),
            senderName: senderId === deal.clientId ? deal.clientName : deal.masterName
        };

        const success = db.addDealMessage(dealId, messageData);
        
        if (success) {
            // Отправляем уведомление другому участнику
            const recipientId = senderId === deal.clientId ? deal.masterId : deal.clientId;
            await sendDealMessageNotification(deal, recipientId, messageData);
            
            res.json({ 
                success: true, 
                message: 'Сообщение отправлено' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Ошибка отправки сообщения' 
            });
        }

    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Получение сообщений сделки
app.get('/api/deals/:dealId/messages', (req, res) => {
    try {
        const dealId = req.params.dealId;
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать userId' 
            });
        }

        const deal = db.getDealById(dealId);
        
        if (!deal) {
            return res.status(404).json({ 
                success: false, 
                error: 'Сделка не найдена' 
            });
        }

        // Проверяем доступ пользователя к сделке
        if (deal.clientId !== userId && deal.masterId !== userId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Нет доступа к сделке' 
            });
        }

        // Помечаем сообщения как прочитанные
        db.markDealMessagesAsRead(dealId, userId);

        const messages = deal.messages || [];
        
        res.json({ 
            success: true, 
            messages: messages 
        });

    } catch (error) {
        console.error('❌ Ошибка получения сообщений:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// ========== ФУНКЦИИ УВЕДОМЛЕНИЙ ДЛЯ СДЕЛОК ==========

async function sendDealNotificationToMaster(deal) {
    try {
        console.log('📨 Отправка уведомления мастеру о новой сделке:', deal.masterId);

        // Получаем Telegram ID мастера
        const masterData = db.getUserByUserId(deal.masterId);
        
        if (masterData && masterData.telegramId) {
            const message = 
                `📝 *Новая сделка в Umeyka!*\n\n` +
                `👤 *Клиент:* ${deal.clientName}\n` +
                `📋 *Услуга:* ${deal.masterSkill || 'Услуга'}\n` +
                `💰 *Сумма:* ${deal.amount} ₽\n` +
                `⏱️ *Срок:* ${deal.period}\n` +
                `⭐ *Качество:* ${deal.quality}\n\n` +
                `📄 *Описание:*\n${deal.description}\n\n` +
                `⚠️ *Сделка ожидает вашей подписи!*\n\n` +
                `✍️ Подпишите сделку, чтобы начать работу.`;

            await bot.telegram.sendMessage(masterData.telegramId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '📝 Подписать сделку',
                            url: `https://umeyka-oocn.onrender.com/#deal=${deal.id}`
                        }
                    ]]
                }
            });

            console.log('✅ Уведомление отправлено мастеру:', masterData.telegramId);
        } else {
            console.log('⚠️ У мастера не привязан Telegram аккаунт:', deal.masterId);
        }

    } catch (error) {
        console.error('❌ Ошибка отправки уведомления мастеру:', error);
    }
}

async function sendDealUpdateNotification(deal, updateType) {
    try {
        let message = '';
        let recipientId = null;
        let actionText = '';

        switch (updateType) {
            case 'client_signed':
                recipientId = deal.masterId;
                message = 
                    `✅ *Клиент подписал сделку!*\n\n` +
                    `👤 *Клиент:* ${deal.clientName}\n` +
                    `📋 *Услуга:* ${deal.masterSkill || 'Услуга'}\n` +
                    `💰 *Сумма:* ${deal.amount} ₽\n\n` +
                    `⚠️ *Теперь ваша очередь подписать сделку.*\n\n` +
                    `После вашей подписи сделка станет активной.`;
                actionText = '📝 Подписать сделку';
                break;

            case 'master_signed':
                recipientId = deal.clientId;
                message = 
                    `✅ *Мастер подписал сделку!*\n\n` +
                    `👤 *Мастер:* ${deal.masterName}\n` +
                    `📋 *Услуга:* ${deal.masterSkill || 'Услуга'}\n` +
                    `💰 *Сумма:* ${deal.amount} ₽\n\n` +
                    `🎉 *Сделка активирована!*\n\n` +
                    `Можете приступать к обсуждению деталей и выполнению работ.`;
                actionText = '💬 Открыть чат сделки';
                break;

            case 'deal_active':
                // Отправляем обоим участникам
                await sendDealUpdateNotificationToUser(deal, deal.clientId, 'deal_active_client');
                await sendDealUpdateNotificationToUser(deal, deal.masterId, 'deal_active_master');
                return;

            case 'deal_completed':
                recipientId = deal.clientId;
                message = 
                    `🏆 *Сделка завершена!*\n\n` +
                    `👤 *Мастер:* ${deal.masterName}\n` +
                    `📋 *Услуга:* ${deal.masterSkill || 'Услуга'}\n` +
                    `💰 *Сумма:* ${deal.amount} ₽\n\n` +
                    `✅ *Работы выполнены успешно!*\n\n` +
                    `Благодарим за использование Umeyka!`;
                actionText = '⭐ Оставить отзыв';
                break;
        }

        if (recipientId) {
            const userData = db.getUserByUserId(recipientId);
            
            if (userData && userData.telegramId) {
                await bot.telegram.sendMessage(userData.telegramId, message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: actionText,
                                url: `https://umeyka-oocn.onrender.com/#deal=${deal.id}`
                            }
                        ]]
                    }
                });

                console.log('✅ Уведомление о обновлении сделки отправлено:', recipientId);
            }
        }

    } catch (error) {
        console.error('❌ Ошибка отправки уведомления об обновлении:', error);
    }
}

async function sendDealUpdateNotificationToUser(deal, userId, type) {
    try {
        const userData = db.getUserByUserId(userId);
        
        if (userData && userData.telegramId) {
            let message = '';
            let actionText = '';

            if (type === 'deal_active_client') {
                message = 
                    `🎉 *Сделка активирована!*\n\n` +
                    `👤 *Мастер:* ${deal.masterName}\n` +
                    `📋 *Услуга:* ${deal.masterSkill || 'Услуга'}\n` +
                    `💰 *Сумма:* ${deal.amount} ₽\n\n` +
                    `✅ *Обе стороны подписали сделку.*\n\n` +
                    `Можете приступать к обсуждению деталей и выполнению работ.`;
                actionText = '💬 Открыть чат сделки';
            } else if (type === 'deal_active_master') {
                message = 
                    `🎉 *Сделка активирована!*\n\n` +
                    `👤 *Клиент:* ${deal.clientName}\n` +
                    `📋 *Услуга:* ${deal.masterSkill || 'Услуга'}\n` +
                    `💰 *Сумма:* ${deal.amount} ₽\n\n` +
                    `✅ *Обе стороны подписали сделку.*\n\n` +
                    `Можете приступать к выполнению работ.`;
                actionText = '💬 Открыть чат сделки';
            }

            await bot.telegram.sendMessage(userData.telegramId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: actionText,
                            url: `https://umeyka-oocn.onrender.com/#deal=${deal.id}`
                        }
                    ]]
                }
            });
        }

    } catch (error) {
        console.error('❌ Ошибка отправки уведомления пользователю:', error);
    }
}

async function sendDealMessageNotification(deal, recipientId, messageData) {
    try {
        const userData = db.getUserByUserId(recipientId);
        
        if (userData && userData.telegramId) {
            const message = 
                `💬 *Новое сообщение в сделке Umeyka*\n\n` +
                `👤 *От:* ${messageData.senderName}\n` +
                `📋 *Услуга:* ${deal.masterSkill || 'Услуга'}\n` +
                `💰 *Сумма:* ${deal.amount} ₽\n\n` +
                `💭 *Сообщение:*\n${messageData.text}\n\n` +
                `⏰ *${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}*`;

            await bot.telegram.sendMessage(userData.telegramId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '💬 Ответить в сделке',
                            url: `https://umeyka-oocn.onrender.com/#deal=${deal.id}`
                        }
                    ]]
                }
            });

            console.log('✅ Уведомление о сообщении отправлено:', recipientId);
        }

    } catch (error) {
        console.error('❌ Ошибка отправки уведомления о сообщении:', error);
    }
}

// ========== СУЩЕСТВУЮЩИЕ API ЭНДПОИНТЫ (упрощенные версии) ==========

// Получить все умейки
app.get('/api/skills', (req, res) => {
    try {
        const skills = db.getAllSkills();
        res.json({
            success: true,
            skills: skills
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
            location: skillData.location || { lat: 55.7558, lon: 37.6173 },
            photo: skillData.photo || null
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

// Поиск умейок
app.get('/api/skills/search', (req, res) => {
    try {
        const query = req.query.q || '';
        const skills = db.searchSkills(query);
        
        res.json({
            success: true,
            skills: skills,
            count: skills.length
        });
    } catch (error) {
        console.error('❌ Ошибка поиска:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// API для Telegram привязки (упрощенные)
app.post('/api/users/:userId/telegram', (req, res) => {
    try {
        const userId = req.params.userId;
        const { telegramId, username } = req.body;

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                error: 'Неверный Telegram ID'
            });
        }

        const success = db.bindTelegramUser(telegramId, userId, {
            username: username || 'Пользователь'
        });

        if (success) {
            res.json({
                success: true,
                message: 'Telegram аккаунт успешно привязан'
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Ошибка привязки аккаунта' 
            });
        }

    } catch (error) {
        console.error('❌ Ошибка привязки Telegram аккаунта:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сервера' 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    const dbData = db.read();
    const skillsCount = dbData ? db.getAllSkills().length : 0;
    const dealsCount = dbData && dbData.deals ? dbData.deals.length : 0;
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Umeyka server is running with deals system',
        version: '3.0.0',
        stats: {
            skills: skillsCount,
            deals: dealsCount
        }
    });
});

// Главная страница
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== ЗАПУСК СЕРВЕРА ==========

app.listen(port, () => {
    console.log(`🚀 Сервер запущен на порту ${port}`);
    console.log(`🌐 Основное приложение: http://localhost:${port}`);
    console.log(`💚 Проверка здоровья: http://localhost:${port}/health`);
    
    const dbData = db.read();
    console.log(`📊 Всего умейок в базе: ${db.getAllSkills().length}`);
    console.log(`🤝 Всего сделок в базе: ${dbData.deals ? dbData.deals.length : 0}`);
    
    if (BOT_TOKEN && BOT_TOKEN.trim() !== '') {
        console.log(`🤖 Бот запущен: https://t.me/${bot.botInfo?.username || 'ваш_бот'}`);
    } else {
        console.log(`⚠️  Бот НЕ запущен. Установите BOT_TOKEN в .env файле`);
    }
    
    console.log(`✅ Готово к работе! Система сделок активирована.`);
});
