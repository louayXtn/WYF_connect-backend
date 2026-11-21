const { connect } = require('./db');
const Project = require('./models/project');
const User = require('./models/user');
const bcrypt = require('bcryptjs');

async function seed() {
  await connect();
  await Project.deleteMany({});
  await User.deleteMany({});

  const hash = await bcrypt.hash('password123', 10);
  const user = await User.create({ name: 'Seed Founder', email: 'founder@example.com', password: hash });

  await Project.create({
    title: 'Solar charging for rural schools',
    description: 'Affordable solar charging kits for students',
    category: 'energy',
    goalAmount: 5000,
    fundedAmount: 1200,
    owner: user._id,
    images: []
  });

  console.log('Seed complete - user credentials: founder@example.com / password123');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
