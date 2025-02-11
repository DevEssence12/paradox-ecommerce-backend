const express = require('express');
const router = express.Router();
const { createPaymentIntent } = require('../controller/Payment');

router.post('/create-payment-intent', async (req, res) => {
    try {
        await createPaymentIntent(req, res); // Assuming createPaymentIntent handles its own responses
   } catch (error) {
       console.error("Error in /create-payment-intent route:", error);
       res.status(500).json({ error: "Failed to create payment intent" });
   }    
});

module.exports = router;