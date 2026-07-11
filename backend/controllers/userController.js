import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import bcrypt from "bcrypt";
import validator from "validator";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import { v2 as cloudinary } from 'cloudinary'
import stripe from "stripe";

// Gateway Initialize
const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)


// API to register user
const registerUser = async (req, res) => {

    try {
        const { name, email, password } = req.body;

        // checking for all data to register user
        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        // validating email format
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        // validating strong password
        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10); // the more no. round the more time it will take
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword,
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to login user
const loginUser = async (req, res) => {

    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user profile data
const getProfile = async (req, res) => {

    try {
        const { userId } = req.body
        const userData = await userModel.findById(userId).select('-password')

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user profile
const updateProfile = async (req, res) => {

    try {

        const { userId, name, phone, address, dob, gender } = req.body
        const imageFile = req.file

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
        }

        await userModel.findByIdAndUpdate(userId, { name, phone, address: JSON.parse(address), dob, gender })

        if (imageFile) {

            // upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
            const imageURL = imageUpload.secure_url

            await userModel.findByIdAndUpdate(userId, { image: imageURL })
        }

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to book appointment 
const bookAppointment = async (req, res) => {

    try {

        const { userId, docId, slotDate, slotTime } = req.body
        const docData = await doctorModel.findById(docId).select("-password")

        if (!docData.available) {
            return res.json({ success: false, message: 'Doctor Not Available' })
        }

        let slots_booked = docData.slots_booked

        // checking for slot availablity 
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: 'Slot Not Available' })
            }
            else {
                slots_booked[slotDate].push(slotTime)
            }
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime)
        }

        const userData = await userModel.findById(userId).select("-password")

        delete docData.slots_booked

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: docData.fees,
            slotTime,
            slotDate,
            date: Date.now()
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        // save new slots data in docData
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment Booked' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to cancel appointment
const cancelAppointment = async (req, res) => {
    try {

        const { userId, appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        // verify appointment user 
        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

        // releasing doctor slot 
        const { docId, slotDate, slotTime } = appointmentData

        const doctorData = await doctorModel.findById(docId)

        let slots_booked = doctorData.slots_booked

        slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user appointments for frontend my-appointments page
const listAppointment = async (req, res) => {
    try {

        const { userId } = req.body
        const appointments = await appointmentModel.find({ userId })

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// PAYSTACK INTEGRATION ENGINE

const paymentPaystack = async (req, res) => {
    try {
        const { appointmentId, userId } = req.body; 
        const appointmentData = await appointmentModel.findById(appointmentId);
        const userData = await userModel.findById(userId);

        if (!appointmentData || appointmentData.cancelled || appointmentData.payment) {
            return res.status(400).json({ success: false, message: 'Invalid or completed appointment' });
        }

        // Paystack uses subunits (Kobo). Multiply real DB fees securely here.
        const amountInKobo = appointmentData.amount * 100; 

        const paystackResponse = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email: userData.email,
                amount: amountInKobo,
                reference: `PAYSTACK_${appointmentData._id}_${Date.now()}`,
                callback_url: `${req.headers.origin}/my-appointments`
            },
            {
                headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
            }
        );

        res.json({ success: true, authorization_url: paystackResponse.data.data.authorization_url });
    } catch (error) {
        console.log(error.response?.data || error.message);
        res.status(500).json({ success: false, message: "Paystack initiation failed" });
    }
};

const paystackWebhook = async (req, res) => {
    try {
        // Exploit Protection: Cryptographically verify the source is truly Paystack
        const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
                           .update(JSON.stringify(req.body))
                           .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
        }

        const event = req.body;
        if (event.event === 'charge.success') {
            const reference = event.data.reference;
            const appointmentId = reference.split('_')[1];
            const paidAmountKobo = event.data.amount;

            const appointment = await appointmentModel.findById(appointmentId);
            if (!appointment) return res.status(404).send('Appointment not found');

            // Business Logic Validation: Ensure the attacker didn't alter the webhook transaction payload value
            if (paidAmountKobo !== appointment.amount * 100) {
                return res.status(400).send('Amount manipulation detected');
            }

            if (!appointment.payment) {
                await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true });
            }
        }
        res.status(200).send('Webhook Processed');
    } catch (error) {
        console.log(error);
        res.status(500).send('Webhook Error');
    }
};

// FLUTTERWAVE INTEGRATION ENGINE

const paymentFlutterwave = async (req, res) => {
    try {
        const { appointmentId, userId } = req.body;
        const appointmentData = await appointmentModel.findById(appointmentId);
        const userData = await userModel.findById(userId);

        if (!appointmentData || appointmentData.cancelled || appointmentData.payment) {
            return res.status(400).json({ success: false, message: 'Invalid or completed appointment' });
        }

        const flwResponse = await axios.post(
            'https://api.flutterwave.com/v3/payments',
            {
                tx_ref: `FLW_${appointmentData._id}_${Date.now()}`,
                amount: appointmentData.amount,
                currency: process.env.CURRENCY || 'NGN',
                redirect_url: `${req.headers.origin}/my-appointments`,
                customer: {
                    email: userData.email,
                    name: userData.name
                },
                customizations: { title: "Appointment Payment" }
            },
            {
                headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
            }
        );

        res.json({ success: true, link: flwResponse.data.data.link });
    } catch (error) {
        console.log(error.response?.data || error.message);
        res.status(500).json({ success: false, message: "Flutterwave initiation failed" });
    }
};

const flutterwaveWebhook = async (req, res) => {
    try {
        // Exploit Protection: Verify matching secret header configuration token
        const signature = req.headers['verif-hash'];
        if (!signature || signature !== process.env.FLUTTERWAVE_WEBHOOK_HASH) {
            return res.status(401).json({ success: false, message: 'Invalid webhook secret string' });
        }

        const payload = req.body;
        if (payload.status === 'successful' || payload.event === 'charge.completed') {
            const txRef = payload.tx_ref || payload.data?.tx_ref;
            const appointmentId = txRef.split('_')[1];
            const paidAmount = payload.amount || payload.data?.amount;

            const appointment = await appointmentModel.findById(appointmentId);
            if (!appointment) return res.status(404).send('Appointment not found');

            // Business Logic Validation: Confirm exact amount matched to prevent price alterations
            if (Number(paidAmount) !== Number(appointment.amount)) {
                return res.status(400).send('Amount discrepancy detected');
            }

            if (!appointment.payment) {
                await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true });
            }
        }
        res.status(200).send('Webhook Processed');
    } catch (error) {
        console.log(error);
        res.status(500).send('Webhook Error');
    }
} 

const convertNgnToUsd = async (ngnAmount) => {
    try {
        // Fetch live conversion rates based on USD
        const response = await axios.get('https://open.er-api.com/v6/latest/USD');

        // Extract the current NGN rate against 1 USD (e.g., ~1379 NGN per dollar)
        const ngnRatePerDollar = response.data.rates.NGN;

        // Calculate the USD price
        const usdAmount = ngnAmount / ngnRatePerDollar;

        // Round up to 2 decimal places to prevent infinite floating-point values
        return Math.ceil(usdAmount * 100) / 100;
    } catch (error) {
        console.error("Currency conversion failed, falling back to static rate:", error);
        // Backup plan: use a safe, slightly padded static rate if the API goes down
        return Math.ceil((ngnAmount / 1380) * 100) / 100;
    }
};

// Add this to your backend controllers
const getUsdEquivalent = async (req, res) => {
    try {
        const { amountInNgn } = req.query; // Pass the NGN price as a query parameter
        
        if (!amountInNgn) {
            return res.status(400).json({ success: false, message: "Amount required" });
        }

        // Call the secure helper function we built earlier
        const usdAmount = await convertNgnToUsd(Number(amountInNgn));

        res.json({ 
            success: true, 
            ngnAmount: Number(amountInNgn),
            usdAmount: usdAmount 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Conversion failed" });
    }
};

// Export it so your router can use it
export {  };

const paymentStripe = async (req, res) => {
    try {
        const { appointmentId, userId } = req.body;
        const appointmentData = await appointmentModel.findById(appointmentId);

        if (!appointmentData || appointmentData.cancelled || appointmentData.payment) {
            return res.status(400).json({ success: false, message: 'Invalid appointment status' });
        }

        // 1. Perform the conversion on the backend (Input: original NGN amount)
        const totalInUsd = await convertNgnToUsd(appointmentData.amount); 
        
        // 2. Stripe expects amounts in cents (multiply USD by 100)
        const stripeAmountInCents = Math.round(totalInUsd * 100);

        const session = await stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd', // Stripe processes the payment in USD
                    product_data: {
                        name: "Appointment Consultation Fee",
                        description: `Converted from original value: ₦${appointmentData.amount.toLocaleString()}`
                    },
                    unit_amount: stripeAmountInCents, 
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin}/my-appointments?success=true`,
            cancel_url: `${req.headers.origin}/my-appointments?success=false`,
            metadata: {
                appointmentId: appointmentData._id.toString(),
                expectedNgnAmount: appointmentData.amount.toString(), // Saved for validation checks
                expectedUsdCents: stripeAmountInCents.toString()
            }
        });

        res.json({ success: true, session_url: session.url });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Stripe payment compilation failed" });
    }
};

// Cryptographically Secured Stripe Webhook
const stripeWebhook = async (req, res) => {
    let event;

    try {
        const sig = req.headers['stripe-signature'];
        
        // Exploit Protection: Stripe's official SDK handles the cryptographic signature check.
        // NOTE: req.body MUST be the raw, unparsed buffer string for Stripe verification to pass.
        event = stripeInstance.webhooks.constructEvent(
            req.body, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log(`Webhook Signature Verification Failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Retrieve the secure tracking variables we embedded during initialization
        const appointmentId = session.metadata.appointmentId;
        const expectedAmount = Number(session.metadata.expectedAmount);
        const totalPaid = session.amount_total;

        // Reject transaction if the amount paid deviates from the generated token balance
        if (totalPaidInCents !== expectedUsdCents) {
            console.log(`CRITICAL: Currency/Price tampering intercepted for appointment ${appointmentId}`);
            return res.status(400).send('Transaction price mismatch');
        }

        try {
            const appointment = await appointmentModel.findById(appointmentId);
            if (!appointment) {
                console.log(`Appointment ${appointmentId} not found during webhook processing.`);
                return res.status(404).send('Appointment not found');
            }

            // Business Logic Validation: Ensure actual paid amount matches database expected fee
            if (totalPaid !== expectedAmount) {
                console.log(`CRITICAL: Price tampering attempt or mismatch detected for appointment ${appointmentId}`);
                return res.status(400).send('Amount manipulation detected');
            }

            // Safe to fulfill the order now
            if (!appointment.payment) {
                await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true });
                console.log(`Appointment ${appointmentId} marked as PAID via secure Stripe Webhook.`);
            }
        } catch (error) {
            console.log(error);
            return res.status(500).send('Database update error');
        }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
};

export {
    loginUser,
    registerUser,
    getProfile,
    updateProfile,
    bookAppointment,
    listAppointment,
    cancelAppointment,
    paymentPaystack,
    paystackWebhook,
    paymentFlutterwave,
    flutterwaveWebhook,
    paymentStripe,
    stripeWebhook,
    getUsdEquivalent,
}