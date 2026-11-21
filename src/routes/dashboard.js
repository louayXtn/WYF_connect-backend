const express = require('express');
const { User } = require('../models/user');
const Project = require('../models/project');
const Investment = require('../models/investment');
const auth = require('../middleware/auth');

const router = express.Router();

// آخر 6 أشهر بالترتيب (labels)
function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth()
    });
  }
  return months;
}

router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const months = getLast6Months();

    // ---------- Platform-wide: new users per month (youth vs investor) ----------
    const allUsers = await User.find({ role: { $in: ['youth', 'investor'] } }).select('role createdAt');

    const newUsersChart = months.map(({ label, year, month }) => {
      const youthCount = allUsers.filter(
        (u) => u.role === 'youth' && u.createdAt.getFullYear() === year && u.createdAt.getMonth() === month
      ).length;
      const investorCount = allUsers.filter(
        (u) => u.role === 'investor' && u.createdAt.getFullYear() === year && u.createdAt.getMonth() === month
      ).length;
      return { month: label, youth: youthCount, investor: investorCount };
    });

    // ---------- Platform-wide: cumulative confirmed funding over time ----------
    const confirmedInvestments = await Investment.find({ status: 'confirmed' }).select('amount createdAt');

    let cumulative = 0;
    const fundingChart = months.map(({ label, year, month }) => {
      const monthTotal = confirmedInvestments
        .filter((inv) => inv.createdAt.getFullYear() === year && inv.createdAt.getMonth() === month)
        .reduce((sum, inv) => sum + inv.amount, 0);
      cumulative += monthTotal;
      return { month: label, total: cumulative };
    });

    const platformTotalFunding = confirmedInvestments.reduce((sum, inv) => sum + inv.amount, 0);
    const platformTotalProjects = await Project.countDocuments();
    const platformTotalUsers = allUsers.length;

    let personalStats = {};
    let categoryPie = [];
    let recentActivity = [];

    if (user.role === 'youth') {
      const myProjects = await Project.find({ owner: user._id });
      const myProjectIds = myProjects.map((p) => p._id);

      const totalFunding = myProjects.reduce((sum, p) => sum + (p.fundedAmount || 0), 0);
      const totalInvestors = myProjects.reduce((sum, p) => sum + (p.investorsCount || 0), 0);

      personalStats = {
        totalProjects: myProjects.length,
        totalFunding,
        totalInvestors
      };

      // Pie: my projects by category
      const categoryMap = {};
      myProjects.forEach((p) => {
        categoryMap[p.category] = (categoryMap[p.category] || 0) + 1;
      });
      categoryPie = Object.entries(categoryMap).map(([category, count]) => ({ category, count }));

      // Recent activity: latest confirmed funding on my projects
      const recentInvestments = await Investment.find({
        project: { $in: myProjectIds },
        status: 'confirmed'
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('project', 'title')
        .populate('investor', 'firstName lastName');

      recentActivity = recentInvestments.map((inv) => ({
        label: inv.investor ? `${inv.investor.firstName} ${inv.investor.lastName}` : inv.investorName || 'Anonymous',
        detail: inv.project?.title || '',
        amount: inv.amount,
        createdAt: inv.createdAt
      }));
    } else if (user.role === 'investor') {
      const myInvestments = await Investment.find({ investor: user._id, status: 'confirmed' }).populate(
        'project',
        'title category'
      );

      const totalInvested = myInvestments.reduce((sum, inv) => sum + inv.amount, 0);
      const projectsBacked = new Set(myInvestments.map((inv) => inv.project?._id?.toString())).size;

      const Opportunity = require('../models/opportunity');
      const myOpportunitiesCount = await Opportunity.countDocuments({ postedBy: user._id });

      personalStats = {
        totalInvestments: myInvestments.length,
        totalInvested,
        projectsBacked,
        opportunitiesPosted: myOpportunitiesCount
      };

      // Pie: my investments by project category
      const categoryMap = {};
      myInvestments.forEach((inv) => {
        const cat = inv.project?.category || 'Other';
        categoryMap[cat] = (categoryMap[cat] || 0) + inv.amount;
      });
      categoryPie = Object.entries(categoryMap).map(([category, amount]) => ({ category, amount }));

      // Recent activity: my latest investments
      recentActivity = myInvestments
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5)
        .map((inv) => ({
          label: inv.project?.title || 'Unknown project',
          detail: inv.project?.category || '',
          amount: inv.amount,
          createdAt: inv.createdAt
        }));
    }

    res.json({
      platform: {
        totalFunding: platformTotalFunding,
        totalProjects: platformTotalProjects,
        totalUsers: platformTotalUsers,
        newUsersChart,
        fundingChart
      },
      personal: personalStats,
      categoryPie,
      recentActivity,
      role: user.role
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;