const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array();
    return res.status(400).json({
      success: false,
      message: details[0]?.msg || 'Input validation failed',
      errors: details
    });
  }
  next();
};

const registerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 3 }).withMessage('First name must be at least 3 characters long')
    .notEmpty().withMessage('First name is required'),
  body('lastName')
    .trim()
    .isLength({ min: 3 }).withMessage('Last name must be at least 3 characters long')
    .notEmpty().withMessage('Last name is required'),
  body('email')
    .trim()
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  // Role might be required for some systems, we make it optional but string if provided
  body('role').optional().isString()
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail()
    .notEmpty().withMessage('Email is required'),
  body('password')
    .notEmpty().withMessage('Password is required')
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 101 })
    .withMessage('Name must contain 2 to 101 characters')
    .matches(/^[\p{L} .’'\-]+$/u)
    .withMessage('Name may only contain letters, spaces, apostrophes, and hyphens'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must contain 2 to 50 characters')
    .matches(/^[\p{L} .’'\-]+$/u)
    .withMessage('First name may only contain letters, spaces, apostrophes, and hyphens'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must contain 2 to 50 characters')
    .matches(/^[\p{L} .’'\-]+$/u)
    .withMessage('Last name may only contain letters, spaces, apostrophes, and hyphens'),
  body('course').optional().trim().isLength({ max: 120 }).withMessage('Program is too long'),
  body('yearLevel').optional().trim().isLength({ max: 50 }).withMessage('Academic year is too long'),
  body('profilePic').optional().trim().isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Profile photo must use a valid HTTPS URL'),
  body('email').optional().trim().isEmail().withMessage('Must be a valid email address').normalizeEmail(),
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  updateProfileValidation
};
