const express = require('express');
const Opportunity = require('../models/opportunity');
const Project = require('../models/project');
const { User } = require('../models/user');
const auth = require('../middleware/auth');

const router = express.Router();

// إنشاء فرصة جديدة — بس investor أو admin
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'investor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'only investors or admins can post opportunities' });
    }

    const {
      title,
      type,
      description,
      fundingMin,
      fundingMax,
      targetStage,
      targetIndustries,
      geographicScope,
      requiredDocuments,
      deadline
    } = req.body;

    if (!title || !type || !description || !fundingMin || !fundingMax || !targetStage) {
      return res.status(400).json({ error: 'missing fields' });
    }

    const user = await User.findById(req.user.id);
    const entityName = user?.investorProfile?.entityName || `${user.firstName} ${user.lastName}`;

    const opportunity = await Opportunity.create({
      title,
      entityName,
      type,
      description,
      fundingMin: Number(fundingMin),
      fundingMax: Number(fundingMax),
      targetStage,
      targetIndustries: targetIndustries || [],
      geographicScope: geographicScope || [],
      requiredDocuments: requiredDocuments || {},
      deadline,
      postedBy: req.user.id
    });

    res.json(opportunity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// عرض كل الفرص (فلترة)
router.get('/', async (req, res) => {
  try {
    const { type, status, targetStage } = req.query;
    const q = {};
    if (type) q.type = type;
    if (status) {
  q.status = status;
} else {
  q.status = { $ne: 'closed' };
}
    if (targetStage) q.targetStage = targetStage;

    const opportunities = await Opportunity.find(q)
      .populate('postedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(opportunities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// فرصي الخاصة — لازم قبل /:id
router.get('/my', auth, async (req, res) => {
  try {
    const opportunities = await Opportunity.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(opportunities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// طلباتي الخاصة (اللي قدمتها كـ youth) — عبر كل الفرص
router.get('/applications/my', auth, async (req, res) => {
  try {
    const opportunities = await Opportunity.find({ 'applications.applicant': req.user.id })
      .populate('postedBy', 'firstName lastName email')
      .select('title type entityName applications');

    const myApplications = opportunities.flatMap((opp) =>
      opp.applications
        .filter((a) => a.applicant.toString() === req.user.id)
        .map((a) => ({
          _id: a._id,
          opportunityId: opp._id,
          opportunityTitle: opp.title,
          entityName: opp.entityName,
          status: a.status,
          createdAt: a.createdAt,
          postedBy: opp.status === undefined ? undefined : opp.postedBy,
          contactEmail: a.status === 'accepted' ? opp.postedBy.email : undefined
        }))
    );

    res.json(myApplications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// الإدمن يشوف كل الفرص (بدون قيد status='open')
router.get('/admin/all', auth, requireAdmin, async (req, res) => {
  try {
    const { search, status } = req.query;
    const q = {};
    if (search) q.title = new RegExp(search, 'i');
    if (status) q.status = status;

    const opportunities = await Opportunity.find(q)
      .populate('postedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(opportunities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// فرصة واحدة بالتفصيل
router.get('/:id', async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id)
      .populate('postedBy', 'firstName lastName email')
      .populate('applications.applicant', 'firstName lastName email')
      .populate('applications.project', 'title category');

    if (!opportunity) return res.status(404).json({ error: 'not found' });
    res.json(opportunity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// التقدم لفرصة — بس youth
router.post('/:id/apply', auth, async (req, res) => {
  try {
    if (req.user.role !== 'youth') {
      return res.status(403).json({ error: 'only youth founders can apply to opportunities' });
    }

    const { projectId, message, pitchDeckUrl, financialModelUrl, pitchVideoUrl } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'project not found' });
    if (project.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'you can only apply with your own project' });
    }

    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity) return res.status(404).json({ error: 'opportunity not found' });
    if (opportunity.status !== 'open') {
      return res.status(400).json({ error: 'this opportunity is not open for applications' });
    }

    // تحقق من المستندات المطلوبة
    if (opportunity.requiredDocuments?.pitchDeck && !pitchDeckUrl) {
      return res.status(400).json({ error: 'pitch deck is required for this opportunity' });
    }
    if (opportunity.requiredDocuments?.financialModel && !financialModelUrl) {
      return res.status(400).json({ error: 'financial model is required for this opportunity' });
    }
    if (opportunity.requiredDocuments?.pitchVideo && !pitchVideoUrl) {
      return res.status(400).json({ error: 'pitch video is required for this opportunity' });
    }

    const alreadyApplied = opportunity.applications.some(
      (a) => a.applicant.toString() === req.user.id && a.project.toString() === projectId
    );
    if (alreadyApplied) {
      return res.status(400).json({ error: 'you already applied to this opportunity with this project' });
    }

    opportunity.applications.push({
      applicant: req.user.id,
      project: projectId,
      message,
      pitchDeckUrl,
      financialModelUrl,
      pitchVideoUrl
    });
    await opportunity.save();

    res.json({ message: 'Application submitted', opportunity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// قبول/رفض طلب — بس صاحب الفرصة
router.post('/:id/applications/:applicationId/:action', auth, async (req, res) => {
  try {
    const { action } = req.params;
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'invalid action' });
    }

    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity) return res.status(404).json({ error: 'opportunity not found' });

    if (opportunity.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'only the opportunity owner can respond to applications' });
    }

    const application = opportunity.applications.id(req.params.applicationId);
    if (!application) return res.status(404).json({ error: 'application not found' });

    application.status = action === 'accept' ? 'accepted' : 'rejected';
    await opportunity.save();

    res.json({ message: `Application ${application.status}`, opportunity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// حذف فرصة — بس صاحبها أو الإدمن
router.delete('/:id', auth, async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity) return res.status(404).json({ error: 'not found' });

    const isOwner = opportunity.postedBy.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'not authorized to delete this opportunity' });
    }

    const acceptedApplications = opportunity.applications.filter((a) => a.status === 'accepted');

    if (acceptedApplications.length > 0 && !isAdmin) {
      return res.status(400).json({
        error: 'This opportunity has accepted applications and cannot be deleted. You can close it instead.'
      });
    }

    await opportunity.deleteOne();

    res.json({ success: true, message: 'opportunity deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إغلاق فرصة (أرشفة) — بدل الحذف
router.post('/:id/close', auth, async (req, res) => {
  try {
    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity) return res.status(404).json({ error: 'not found' });

    if (opportunity.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ error: 'not authorized to close this opportunity' });
    }

    opportunity.status = 'closed';
    await opportunity.save();

    res.json({ message: 'Opportunity closed', opportunity });
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


module.exports = router;