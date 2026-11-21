const express = require('express');
const Project = require('../models/project');
const Investment = require('../models/investment');
const NdaRequest = require('../models/nda-request');
const auth = require('../middleware/auth');

const router = express.Router();
const notify = require('../utils/notify');
// إنشاء مشروع جديد — لازم يكون مسجل دخول
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, goalAmount, totalCost, images, confidentialInfo } = req.body;

    if (!title || !description || !goalAmount || !totalCost) {
      return res.status(400).json({ error: 'missing fields' });
    }

    const project = await Project.create({
      title,
      description,
      category,
      goalAmount: Number(goalAmount),
      totalCost: Number(totalCost),
      images: images || [],
      confidentialInfo: confidentialInfo || undefined,
      owner: req.user.id // ياخد صاحب المشروع من التوكن، مش من الـ body
    });

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// عرض كل المشاريع (مع فلترة وبحث)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category, status } = req.query;
    const q = {};

    if (search) q.$or = [{ title: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }];
    if (category) q.category = category;
    if (status) {
      q.status = status;
    } else {
      q.status = { $ne: 'closed' };
    }

    const projects = await Project.find(q)
      .populate('owner', 'firstName lastName email verification.status')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Project.countDocuments(q);

    res.json({ total, page: Number(page), limit: Number(limit), projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// عرض مشاريعي الخاصة (لازم يكون مسجل دخول) — لازم تكون قبل /:id عشان "my" ما تتفسر كـ id
router.get('/my', auth, async (req, res) => {
  try {
    const projects = await Project.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// طلبات NDA الواردة على مشاريعي (صاحب المشروع)
router.get('/nda/incoming', auth, async (req, res) => {
  try {
    const myProjects = await Project.find({ owner: req.user.id }).select('_id');
    const projectIds = myProjects.map((p) => p._id);

    const requests = await NdaRequest.find({ project: { $in: projectIds }, status: 'pending' })
      .populate('requester', 'firstName lastName email verification.status')
      .populate('project', 'title')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// موافقة/رفض طلب NDA — بس صاحب المشروع
router.post('/nda/:requestId/:action', auth, async (req, res) => {
  try {
    const { action } = req.params;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'invalid action' });
    }

    const ndaRequest = await NdaRequest.findById(req.params.requestId).populate('project');
    if (!ndaRequest) return res.status(404).json({ error: 'request not found' });

    if (ndaRequest.project.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'only the project owner can respond to this request' });
    }

    ndaRequest.status = action === 'approve' ? 'approved' : 'rejected';
ndaRequest.respondedAt = new Date();
await ndaRequest.save();

await notify(
  ndaRequest.requester,
  ndaRequest.status === 'approved' ? 'NDA Request Approved' : 'NDA Request Declined',
  `Your NDA request for "${ndaRequest.project.title}" was ${ndaRequest.status}.`,
  `/dashboard/projects/${ndaRequest.project._id}`
);

res.json({ message: `NDA request ${ndaRequest.status}`, ndaRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// الإدمن يشوف كل المشاريع (بدون قيد على الحالة)
router.get('/admin/all', auth, requireAdmin, async (req, res) => {
  try {
    const { search, status } = req.query;
    const q = {};
    if (search) q.title = new RegExp(search, 'i');
    if (status) q.status = status;

    const projects = await Project.find(q)
      .populate('owner', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// عرض مشروع واحد بالتفصيل
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'firstName lastName email verification.status')
      .populate('comments.author', 'firstName lastName');

    if (!project) return res.status(404).json({ error: 'not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تعديل مشروع — بس صاحبه يقدر يعدله
router.put('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'not authorized to edit this project' });
    }

    const { title, description, category, goalAmount, totalCost, images, status } = req.body;

    if (title) project.title = title;
    if (description) project.description = description;
    if (category) project.category = category;
    if (goalAmount) project.goalAmount = Number(goalAmount);
    if (totalCost) project.totalCost = Number(totalCost);
    if (images) project.images = images;
    if (status) project.status = status;

    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'not found' });

    const isOwner = project.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'not authorized to delete this project' });
    }

    const confirmedInvestments = await Investment.countDocuments({
      project: project._id,
      status: 'confirmed'
    });

    if (confirmedInvestments > 0 && !isAdmin) {
      return res.status(400).json({
        error: 'This project has confirmed investments and cannot be deleted. You can close it instead.'
      });
    }

    await project.deleteOne();
    await Investment.deleteMany({ project: project._id });
    await NdaRequest.deleteMany({ project: project._id });

    res.json({ success: true, message: 'project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إغلاق مشروع (أرشفة) — بدل الحذف لو فيه استثمارات مؤكدة
router.post('/:id/close', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'not authorized to close this project' });
    }

    project.status = 'closed';
    await project.save();

    res.json({ message: 'Project closed', project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// عرض كل المساهمات (استثمارات) الخاصة بمشروع، مع توضيح المصدر (منصة أو خارجي)
router.get('/:id/investments', async (req, res) => {
  try {
    const investments = await Investment.find({ project: req.params.id, status: 'confirmed' })
  .populate('investor', 'firstName lastName verification.status')
  .sort({ createdAt: -1 });

    const formatted = investments.map((inv) => ({
  _id: inv._id,
  amount: inv.amount,
  note: inv.note,
  source: inv.source,
  proofUrl: inv.proofUrl || null,
  investorName:
    inv.source === 'platform' && inv.investor
      ? `${inv.investor.firstName} ${inv.investor.lastName}`
      : inv.investorName || 'Anonymous',
  investorVerified: inv.source === 'platform' && inv.investor?.verification?.status === 'verified',
  createdAt: inv.createdAt
}));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// المساهمة/الاستثمار بمشروع — لازم يكون role: investor، ولازم إثبات دائماً
router.post('/:id/invest', auth, async (req, res) => {
  try {
    if (req.user.role !== 'investor') {
      return res.status(403).json({ error: 'only investor accounts can invest' });
    }

    const { amount, note, proofUrl } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'invalid amount' });
    if (!proofUrl) {
      return res.status(400).json({ error: 'proof of transfer is required to submit an investment' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'project not found' });

    const investment = await Investment.create({
      project: project._id,
      investor: req.user.id,
      amount: Number(amount),
      note,
      proofUrl,
      source: 'platform',
      status: 'pending', // كل استثمار عبر المنصة لازم مراجعة إدمن
      addedBy: req.user.id
    });

    res.json({
      investment,
      message: 'Investment submitted for admin review. It will be added to the project once approved.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post('/:id/external-contribution', auth, async (req, res) => {
  try {
    const { amount, investorName, note, proofUrl } = req.body;

    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'invalid amount' });
    if (!investorName) return res.status(400).json({ error: 'investor name is required' });

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'project not found' });

    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'only the project owner can add external contributions' });
    }

    const investment = await Investment.create({
      project: project._id,
      investorName,
      amount: Number(amount),
      note,
      proofUrl,
      source: 'external',
      status: 'pending', // بينتظر موافقة الإدمن، ما بينحسب فوراً
      addedBy: req.user.id
    });

    res.json({
      investment,
      message: 'External contribution submitted for admin review. It will be added once approved.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة تعليق على مشروع — لازم يكون مسجل دخول
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'comment text is required' });

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'project not found' });

    project.comments.push({ author: req.user.id, text });
    await project.save();

    const updated = await Project.findById(project._id).populate('comments.author', 'firstName lastName verification.status');

    res.json(updated.comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin access required' });
  }
  next();
}

// الإدمن يشوف كل الاستثمارات المعلقة (من مستثمرين غير موثقين)
router.get('/admin/pending-investments', auth, requireAdmin, async (req, res) => {
  try {
    const investments = await Investment.find({ status: 'pending' })
      .populate('investor', 'firstName lastName email')
      .populate('project', 'title')
      .sort({ createdAt: -1 });

    res.json(investments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// الإدمن يوافق على استثمار معلق
router.post('/admin/investments/:investmentId/approve', auth, requireAdmin, async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.investmentId);
    if (!investment) return res.status(404).json({ error: 'investment not found' });
    if (investment.status !== 'pending') return res.status(400).json({ error: 'investment already processed' });

    investment.status = 'confirmed';
    await investment.save();

    const project = await Project.findById(investment.project);
    project.fundedAmount = (project.fundedAmount || 0) + investment.amount;

    const uniqueInvestors = await Investment.distinct('investor', {
      project: project._id,
      status: 'confirmed'
    });
    project.investorsCount = uniqueInvestors.length;

    if (project.fundedAmount >= project.goalAmount) {
      project.status = 'funded';
    }

    await project.save();

    // إشعار للمستثمر (لو كان استثمار عبر المنصة، مش مساهمة خارجية)
    if (investment.investor) {
      await notify(
        investment.investor,
        'Investment Approved',
        `Your investment of $${investment.amount.toLocaleString()} in "${project.title}" has been confirmed.`,
        `/dashboard/projects/${project._id}`
      );
    }

    // إشعار لصاحب المشروع
    await notify(
      project.owner,
      'New Funding Confirmed',
      `$${investment.amount.toLocaleString()} was confirmed for "${project.title}".`,
      `/dashboard/projects/${project._id}`
    );

    res.json({ message: 'Investment approved', investment, project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// الإدمن يرفض استثمار معلق
router.post('/admin/investments/:investmentId/reject', auth, requireAdmin, async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.investmentId);
    if (!investment) return res.status(404).json({ error: 'investment not found' });
    if (investment.status !== 'pending') return res.status(400).json({ error: 'investment already processed' });

    investment.status = 'rejected';
    await investment.save();

    if (investment.source === 'platform' && investment.investor) {
      await notify(
        investment.investor,
        'Investment Declined',
        'Your investment submission was declined by our review team. Please contact support for details.',
        '/dashboard/projects'
      );
    } else if (investment.source === 'external') {
      const project = await Project.findById(investment.project);
      if (project) {
        await notify(
          project.owner,
          'Off-Platform Funding Declined',
          `Your reported off-platform funding for "${project.title}" was declined.`,
          '/dashboard/my-projects'
        );
      }
    }

    res.json({ message: 'Investment rejected', investment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// طلب وصول NDA لمشروع — بس investor
router.post('/:id/nda-request', auth, async (req, res) => {
  try {
    if (req.user.role !== 'investor') {
      return res.status(403).json({ error: 'only investors can request NDA access' });
    }

    const { message } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'project not found' });

    if (project.owner.toString() === req.user.id) {
      return res.status(400).json({ error: 'you cannot request NDA access to your own project' });
    }

    const existing = await NdaRequest.findOne({ project: project._id, requester: req.user.id });
    if (existing) {
      return res.status(400).json({ error: 'you already requested NDA access for this project', status: existing.status });
    }

    const ndaRequest = await NdaRequest.create({
  project: project._id,
  requester: req.user.id,
  message
});

await notify(
  project.owner,
  'New NDA Request',
  `Someone requested confidential access to "${project.title}".`,
  '/dashboard/nda-requests'
);

res.json({ message: 'NDA request submitted', ndaRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تحقق من حالة الوصول لمشروع معين (للمستثمر الحالي)
router.get('/:id/nda-status', auth, async (req, res) => {
  try {
    const ndaRequest = await NdaRequest.findOne({ project: req.params.id, requester: req.user.id });
    res.json({ status: ndaRequest?.status || 'none' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// عرض المعلومات السرية — بس لو عندك موافقة NDA أو انت صاحب المشروع
router.get('/:id/confidential', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'project not found' });

    const isOwner = project.owner.toString() === req.user.id;

    if (!isOwner) {
      const ndaRequest = await NdaRequest.findOne({
        project: project._id,
        requester: req.user.id,
        status: 'approved'
      });
      if (!ndaRequest) {
        return res.status(403).json({ error: 'you do not have NDA access to this project' });
      }
    }

    res.json(project.confidentialInfo || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;