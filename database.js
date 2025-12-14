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
