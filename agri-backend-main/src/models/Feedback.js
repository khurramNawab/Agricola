const mongoose = require('mongoose');

// Website/general feedback submitted by customers (distinct from product Reviews).
const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    rating: { type: Number, min: 1, max: 5 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    page: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
