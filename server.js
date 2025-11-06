const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server started on port ${port}`);
});
