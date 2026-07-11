/* eslint-disable react-hooks/exhaustive-deps */
import { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets'

const MyAppointments = () => {

    const { backendUrl, token } = useContext(AppContext)

    const [appointments, setAppointments] = useState([])
    const [payment, setPayment] = useState('')

    // state variable to track conversion previews
    const [conversionPreview, setConversionPreview] = useState({ loading: false, usd: null, appointmentId: null });


    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Function to format the date eg. ( 20_01_2000 => 20 Jan 2000 )
    const slotDateFormat = (slotDate) => {
        const dateArray = slotDate.split('_')
        return dateArray[0] + " " + months[Number(dateArray[1])] + " " + dateArray[2]
    }

    // Getting User Appointments Data Using API
    const getUserAppointments = async () => {
        try {

            const { data } = await axios.get(backendUrl + '/api/user/appointments', { headers: { token } })
            setAppointments(data.appointments.reverse())

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }

    // Function to cancel appointment Using API
    const cancelAppointment = async (appointmentId) => {

        try {

            const { data } = await axios.post(backendUrl + '/api/user/cancel-appointment', { appointmentId }, { headers: { token } })

            if (data.success) {
                toast.success(data.message)
                getUserAppointments()
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }

    }

    // Function to fetch Currency convertion Preview from the backend 
    const fetchCurrencyPreview = async (appointmentId, ngnAmount) => {
        setConversionPreview({ loading: true, usd: null, appointmentId });
        try {
            const { data } = await axios.get(`${backendUrl}/api/user/convert-currency?amountInNgn=${ngnAmount}`, { headers: { token } });
            if (data.success) {
                setConversionPreview({ loading: false, usd: data.usdAmount, appointmentId });
            }
        } catch (error) {
            setConversionPreview({ loading: false, usd: null, appointmentId: null });
            toast.error("Could not fetch international payment preview.");
        }
    };

    const appointmentFlutterwave = async (appointmentId) => {
        try {
            // Rule Validation: Pass only the ID. Let the backend handle pricing from the DB.
            const { data } = await axios.post(backendUrl + '/api/user/payment-flutterwave', { appointmentId }, { headers: { token } })
            
            if (data.success) {
                const { link } = data
                // Securely redirecting the user out to the provider's server
                window.location.replace(link)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }

    // Function to make payment using Paystack (Secure Redirect)
    const appointmentPaystack = async (appointmentId) => {
        try {
            // Rule Validation: Pass only the ID. Let the backend handle pricing from the DB.
            const { data } = await axios.post(backendUrl + '/api/user/payment-paystack', { appointmentId }, { headers: { token } })
            
            if (data.success) {
                const { authorization_url } = data
                // Securely redirecting the user out to the provider's server
                window.location.replace(authorization_url)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }



    // Function to make payment using stripe
    const appointmentStripe = async (appointmentId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/user/payment-stripe', { appointmentId }, { headers: { token } })
            if (data.success) {
                const { session_url } = data
                window.location.replace(session_url)
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }



    useEffect(() => {
        if (token) {
            getUserAppointments()
        }
    }, [token])

    return (
        <div>
            <p className='pb-3 mt-12 text-lg font-medium text-gray-600 border-b'>My appointments</p>
            <div className=''>
                {appointments.map((item, index) => (
                    <div key={index} className='grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-4 border-b'>
                        <div>
                            <img className='w-36 bg-[#EAEFFF]' src={item.docData.image} alt="" />
                        </div>
                        <div className='flex-1 text-sm text-[#5E5E5E]'>
                            <p className='text-[#262626] text-base font-semibold'>{item.docData.name}</p>
                            <p>{item.docData.speciality}</p>
                            <p className='text-[#464646] font-medium mt-1'>Address:</p>
                            <p className=''>{item.docData.address.line1}</p>
                            <p className=''>{item.docData.address.line2}</p>
                            <p className=' mt-1'><span className='text-sm text-[#3C3C3C] font-medium'>Date & Time:</span> {slotDateFormat(item.slotDate)} |  {item.slotTime}</p>
                        </div>
                        <div></div>
                        <div className='flex flex-col gap-2 justify-end text-sm text-center'>

                            {!item.cancelled && !item.payment && !item.isCompleted && payment !== item._id && 
                                <button onClick={ () => {
                                    setPayment(item._id);
                                    // Fetch the conversion the moment they click pay options
                                    fetchCurrencyPreview(item._id, item.amount);}
                                    } className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-primary hover:text-white transition-all duration-300'>Pay Online
                                </button>
                            }

                            {/* Payment Options Menu selection triggers */}
                            {!item.cancelled && !item.payment && !item.isCompleted && payment === item._id && <button onClick={() => appointmentPaystack(item._id)} className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-gray-100 hover:text-black transition-all duration-300 flex items-center justify-center font-medium'><img className='max-w-24 max-h-7' src={assets.paystack_logo} alt="" /></button>}
                            {!item.cancelled && !item.payment && !item.isCompleted && payment === item._id && <button onClick={() => appointmentFlutterwave(item._id)} className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-gray-100 hover:text-black transition-all duration-300 flex items-center justify-center font-medium'><img className='max-w-24 max-h-7' src={assets.flutterwave_logo} alt="" /></button>}
                            {!item.cancelled && !item.payment && !item.isCompleted && payment === item._id &&
                                <div> 
                                    <button 
                                        onClick={() => appointmentStripe(item._id)} 
                                        className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-gray-100 hover:text-white transition-all duration-300 flex items-center justify-center'
                                    >
                                        <img className='max-w-20 max-h-5' src={assets.stripe_logo} alt="" />
                                    </button>
                                    {conversionPreview.appointmentId === item._id && (
                                        <p className="text-[11px] text-gray-500 font-medium">
                                            {conversionPreview.loading ? "Calculating dynamic rate..." : `International Card Processing total: $${conversionPreview.usd} USD`}
                                        </p>
                                    )}
                                </div>
                            }
                            {!item.cancelled && item.payment && !item.isCompleted && <button className='sm:min-w-48 py-2 border rounded text-[#696969]  bg-[#EAEFFF]'>Paid</button>}

                            {item.isCompleted && <button className='sm:min-w-48 py-2 border border-green-500 rounded text-green-500'>Completed</button>}

                            {!item.cancelled && !item.isCompleted && <button onClick={() => cancelAppointment(item._id)} className='text-[#696969] sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300'>Cancel appointment</button>}
                            {item.cancelled && !item.isCompleted && <button className='sm:min-w-48 py-2 border border-red-500 rounded text-red-500'>Appointment cancelled</button>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default MyAppointments