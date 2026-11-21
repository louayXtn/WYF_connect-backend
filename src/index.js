const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { connect } = require('./db');

const projectsRouter = require('./routes/projects');
const usersRouter = require('./routes/users');
const investmentsRouter = require('./routes/investments');
const opportunitiesRouter = require('./routes/opportunities');
const app = express();
const notificationsRouter = require('./routes/notifications');
const dashboardRouter = require('./routes/dashboard');
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/projects', projectsRouter);
app.use('/api/users', usersRouter);
app.use('/api/investments', investmentsRouter);
const authRouter = require('./routes/auth'); 
const imagekitRouter = require('./routes/imagekit');
const verificationRouter = require('./routes/verification');
app.use('/api/auth', authRouter);
app.use('/api/imagekit', imagekitRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.get('/', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 4000;

connect()
  .then(() => {
    app.listen(PORT, () => console.log(`WYF backend listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('DB connect error', err);
    process.exit(1);
  });
