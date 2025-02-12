const mongoose = require('mongoose');
const { Schema } = mongoose;

const paymentSchema = new Schema(
 {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true, 
    },
    stripeClientSecret: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled'],
      default: 'pending',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'inr',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    products: [{
      productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true
      },
      price: {
        type: Number,
        required: true
      }
    }],
    metadata: {
      type: Map,
      of: String,
      default: {},
    }
  },
  {
    timestamps: true,
  }
);

exports.Payment = mongoose.model('Payment', paymentSchema);