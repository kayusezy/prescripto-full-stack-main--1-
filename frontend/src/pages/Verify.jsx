import axios from 'axios';
import { useContext, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { toast } from 'react-toastify';

const Verify = () => {
    const [searchParams] = useSearchParams();
    const success = searchParams.get("success");
    const appointmentId = searchParams.get("appointmentId");

    const { backendUrl, token } = useContext(AppContext);
    const navigate = useNavigate();
    
    // Prevent double execution in React StrictMode
    const hasCalledVerify = useRef(false);

    useEffect(() => {
        const verifyStripe = async () => {
            try {
                const { data } = await axios.post(
                    `${backendUrl}/api/user/verifyStripe`, 
                    { success, appointmentId }, 
                    { headers: { token } }
                );

                if (data.success) {
                    toast.success(data.message);
                } else {
                    toast.error(data.message);
                }
                navigate("/my-appointments");
            } catch (error) {
                toast.error(error.message);
                console.log(error);
                navigate("/my-appointments");
            }
        };

        // Correct conditional check using AND (&&) operators
        if (token && appointmentId && success && !hasCalledVerify.current) {
            hasCalledVerify.current = true;
            verifyStripe();
        }
    }, [token, appointmentId, success, backendUrl, navigate]);

    return (
        <div className='min-h-[60vh] flex items-center justify-center'>
            <div className="w-20 h-20 border-4 border-gray-300 border-t-primary rounded-full animate-spin"></div>
        </div>
    );
};

export default Verify;