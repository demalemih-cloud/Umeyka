const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

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
