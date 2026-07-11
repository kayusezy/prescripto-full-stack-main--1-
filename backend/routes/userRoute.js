import express from 'express';
import { loginUser, registerUser, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, paymentStripe, paymentFlutterwave, paymentPaystack, getUsdEquivalent } from '../controllers/userController.js';
import upload from '../middleware/multer.js';
import authUser from '../middleware/authUser.js';
const userRouter = express.Router();

userRouter.post("/register", registerUser)
userRouter.post("/login", loginUser)

userRouter.get("/get-profile", authUser, getProfile)
userRouter.post("/update-profile", upload.single('image'), authUser, updateProfile)
userRouter.post("/book-appointment", authUser, bookAppointment)
userRouter.get("/appointments", authUser, listAppointment)
userRouter.post("/cancel-appointment", authUser, cancelAppointment)

// Secure Payment Intends / Checkout Initialization Routes
userRouter.post("/payment-stripe", authUser, paymentStripe);
userRouter.post("/payment-paystack", authUser, paymentPaystack);
userRouter.post("/payment-flutterwave", authUser, paymentFlutterwave);
// Dynamic Currency Preview for the Frontend Layout
userRouter.get("/convert-currency", authUser, getUsdEquivalent);

export default userRouter;