const multer = require('multer');
const path = require('path');
const fs = require('fs');

// General uploads (CV / cover letter attached to an application) and a dedicated
// resumes subfolder for the resume library.
const uploadDir = path.join(__dirname, '../../uploads');
const resumesDir = path.join(uploadDir, 'resumes');
if (!fs.existsSync(resumesDir)) {
  fs.mkdirSync(resumesDir, { recursive: true });
}

const makeStorage = (dir) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Arbitrary attachments for an application.
const upload = multer({ storage: makeStorage(uploadDir) });

// Resume library: restricted to document types, capped at 10MB.
const resumeUpload = multer({
  storage: makeStorage(resumesDir),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
  },
});

module.exports = { uploadDir, resumesDir, upload, resumeUpload };
