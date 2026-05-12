const Joi = require('joi');

// Schema for validating edit profile request
const editProfileSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name must not exceed 50 characters',
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': 'Last name must be at least 2 characters',
      'string.max': 'Last name must not exceed 50 characters',
    }),

  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Email must be a valid email address',
    }),

  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Phone number must be 10-15 digits',
    }),

  address: Joi.string()
    .max(200)
    .optional()
    .messages({
      'string.max': 'Address must not exceed 200 characters',
    }),

  city: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'City must not exceed 50 characters',
    }),

  country: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Country must not exceed 50 characters',
    }),

  bio: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Bio must not exceed 500 characters',
    }),

  avatar: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'Avatar must be a valid URI',
    }),
})
.min(1)
.messages({
  'object.min': 'At least one field must be provided for update',
});

// Validation function
const validateEditProfile = (data) => {
  return editProfileSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });
};

module.exports = {
  editProfileSchema,
  validateEditProfile,
};
