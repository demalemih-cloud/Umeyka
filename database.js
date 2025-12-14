// database.js
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Убедимся, что папка data существует
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Инициализация базы данных
function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        const initialData = {
            skills: [],
            users: {},
            chats: [],
            deals: []
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
        console.log('✅ База данных создана');
    }
}

// Чтение всей базы
function readDB() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ Ошибка чтения базы данных:', error);
        return null;
    }
}

// Запись в базу данных
function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Ошибка записи в базу данных:', error);
        return false;
    }
}

// Функции для работы с умейками
const db = {
    // Получить все активные умейки
    getAllSkills() {
        const dbData = readDB();
        return dbData?.skills.filter(skill => skill.isActive !== false) || [];
    },

    // Получить умейки пользователя
    getUserSkills(userId) {
        const dbData = readDB();
        return dbData?.skills.filter(skill => 
            skill.userId === userId && skill.isActive !== false
        ) || [];
    },

    // Добавить новую умейку
    addSkill(skillData) {
        const dbData = readDB();
        if (!dbData) return false;

        const newSkill = {
            _id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            ...skillData,
            createdAt: new Date().toISOString(),
            isActive: true,
            views: 0,
            contacts: 0
        };

        dbData.skills.push(newSkill);
        
        if (writeDB(dbData)) {
            console.log('✅ Умейка добавлена в базу:', newSkill._id);
            return newSkill;
        }
        return false;
    },

    // Обновить умейку
    updateSkill(skillId, updates) {
        const dbData = readDB();
        if (!dbData) return false;

        const index = dbData.skills.findIndex(s => s._id === skillId);
        if (index === -1) return false;

        dbData.skills[index] = {
            ...dbData.skills[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        return writeDB(dbData);
    },

    // Удалить умейку (пометить как неактивную)
    deleteSkill(skillId) {
        return this.updateSkill(skillId, { isActive: false });
    },

    // Увеличить счетчик просмотров
    incrementViews(skillId) {
        const dbData = readDB();
        if (!dbData) return false;

        const skill = dbData.skills.find(s => s._id === skillId);
        if (skill) {
            skill.views = (skill.views || 0) + 1;
            return writeDB(dbData);
        }
        return false;
    },

    // Увеличить счетчик контактов
    incrementContacts(skillId) {
        const dbData = readDB();
        if (!dbData) return false;

        const skill = dbData.skills.find(s => s._id === skillId);
        if (skill) {
            skill.contacts = (skill.contacts || 0) + 1;
            return writeDB(dbData);
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

// Инициализируем базу при запуске
initDB();

module.exports = db;

// В database.js, после initDB() добавляем:
function createDemoData() {
    const dbData = readDB();
    if (!dbData || dbData.skills.length > 0) return;

    console.log('🔄 Создание демо-данных...');
    
    const demoSkills = [
        {
            _id: 'demo_' + Date.now() + '_1',
            skill: 'Ремонт смартфонов',
            experience: '5 лет опыта, ремонтирую все модели',
            price: 1500,
            userId: 'demo_user_1',
            username: 'Алексей',
            rating: { average: 4.8, reviews: [
                { rating: 5, comment: 'Отличный мастер!', userId: 'client_1' },
                { rating: 4, comment: 'Быстро и качественно', userId: 'client_2' }
            ]},
            isTopMaster: true,
            location: { lat: 55.7538, lon: 37.6206 },
            createdAt: new Date().toISOString(),
            isActive: true,
            category: 'ремонт электроники',
            description: 'Профессиональный ремонт iPhone, Samsung, Xiaomi. Диагностика бесплатно.',
            views: 42,
            contacts: 8
        },
        {
            _id: 'demo_' + Date.now() + '_2',
            skill: 'Сантехник',
            experience: '7 лет опыта, все виды работ',
            price: 2000,
            userId: 'demo_user_2',
            username: 'Иван',
            rating: { average: 4.9, reviews: [
                { rating: 5, comment: 'Спас от потопа!', userId: 'client_3' }
            ]},
            isTopMaster: false,
            location: { lat: 55.7578, lon: 37.6150 },
            createdAt: new Date().toISOString(),
            isActive: true,
            category: 'сантехника',
            description: 'Установка, замена, ремонт сантехники. Гарантия на работы.',
            views: 38,
            contacts: 5
        },
        {
            _id: 'demo_' + Date.now() + '_3',
            skill: 'Электрик',
            experience: '3 года опыта, сертифицированный специалист',
            price: 1200,
            userId: 'demo_user_3',
            username: 'Петр',
            rating: { average: 4.5, reviews: [] },
            isTopMaster: true,
            location: { lat: 55.7510, lon: 37.6190 },
            createdAt: new Date().toISOString(),
            isActive: true,
            category: 'электрика',
            description: 'Монтаж проводки, установка розеток, люстр, электрощитов.',
            views: 25,
            contacts: 3
        },
        {
            _id: 'demo_' + Date.now() + '_4',
            skill: 'Репетитор по математике',
            experience: '8 лет преподавания, кандидат наук',
            price: 800,
            userId: 'demo_user_4',
            username: 'Ольга',
            rating: { average: 5.0, reviews: [
                { rating: 5, comment: 'Дочь сдала ЕГЭ на 92 балла!', userId: 'client_4' }
            ]},
            isTopMaster: true,
            location: { lat: 55.7590, lon: 37.6175 },
            createdAt: new Date().toISOString(),
            isActive: true,
            category: 'обучение',
            description: 'Подготовка к ЕГЭ, ОГЭ, помощь студентам. Индивидуальный подход.',
            views: 31,
            contacts: 6
        }
    ];

    dbData.skills = demoSkills;
    writeDB(dbData);
    console.log('✅ Демо-данные созданы:', demoSkills.length, 'умейок');
}

// Вызываем после initDB()
initDB();
createDemoData();
