import { useContext, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import axios from 'axios'
import { toast } from 'react-toastify'

const MyProfile = () => {

    const { userData, setUserData, token, backendUrl, loadUserProfileData } = useContext(AppContext)

    const [isEdit, setIsEdit] = useState(false)
    const [image, setImage] = useState(false)

    // Update user profile data on the backend
    const updateUserProfileData = async () => {
        try {
            const formData = new FormData()

            formData.append('name', userData.name)
            formData.append('phone', userData.phone)
            formData.append('gender', userData.gender)
            formData.append('dob', userData.dob)
            
            // Safely pass nested address objects as strings or split parameters depending on your API structure
            formData.append('address', JSON.stringify(userData.address))

            if (image) {
                formData.append('image', image)
            }

            const { data } = await axios.post(`${backendUrl}/api/user/update-profile`, formData, { headers: { token } })

            if (data.success) {
                toast.success(data.message)
                await loadUserProfileData()
                setIsEdit(false)
                setImage(false)
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.error(error)
            toast.error(error.message)
        }
    }

    return userData ? (
        <div className='max-w-lg flex flex-col gap-4 text-sm pt-5'>

            {isEdit
                ? <label htmlFor="image">
                    <div className='inline-block relative cursor-pointer'>
                        <img className='w-36 h-36 rounded-full opacity-75 object-cover' src={image ? URL.createObjectURL(image) : userData.image} alt="" />
                        <img className='w-10 absolute bottom-12 right-12' src={image ? '' : assets.upload_icon} alt="" />
                    </div>
                    <input onChange={(e) => setImage(e.target.files[0])} type="file" id="image" hidden />
                </label>
                : <img className='w-36 h-36 rounded-full object-cover' src={userData.image} alt="" />
            }

            {isEdit
                ? <input className='bg-gray-50 text-3xl font-medium max-w-60 mt-4 px-2 py-1 rounded outline-none border focus:border-primary' type="text" value={userData.name} onChange={e => setUserData(prev => ({ ...prev, name: e.target.value }))} />
                : <p className='font-medium text-3xl text-[#262626] mt-4'>{userData.name}</p>
            }

            <hr className='bg-[#ADADAD] h-[1px] border-none' />

            <div>
                <p className='text-[#797979] underline uppercase font-semibold tracking-wider text-xs mb-3'>Contact Information</p>
                <div className='grid grid-cols-[1em_1fr] sm:grid-cols-[8rem_1fr] gap-y-2.5 text-[#363636]'>
                    <p className='font-medium'>Email id:</p>
                    <p className='text-blue-500 break-all'>{userData.email}</p>
                    <p className='font-medium'>Phone:</p>
                    {isEdit
                        ? <input className='bg-gray-50 max-w-52 px-2 py-0.5 rounded border outline-none' type="text" value={userData.phone} onChange={e => setUserData(prev => ({ ...prev, phone: e.target.value }))} />
                        : <p className='text-blue-400'>{userData.phone}</p>
                    }
                    <p className='font-medium'>Address:</p>
                    {isEdit
                        ? <div className='flex flex-col gap-1'>
                            <input className='bg-gray-50 px-2 py-0.5 rounded border outline-none' onChange={e => setUserData(prev => ({ ...prev, address: { ...prev.address, line1: e.target.value } }))} value={userData.address?.line1 || ''} type="text" placeholder="Line 1" />
                            <input className='bg-gray-50 px-2 py-0.5 rounded border outline-none' onChange={e => setUserData(prev => ({ ...prev, address: { ...prev.address, line2: e.target.value } }))} value={userData.address?.line2 || ''} type="text" placeholder="Line 2" />
                        </div>
                        : <p className='text-gray-600'>
                            {userData.address?.line1} <br />
                            {userData.address?.line2}
                        </p>
                    }
                </div>
            </div>

            <div>
                <p className='text-[#797979] underline uppercase font-semibold tracking-wider text-xs mb-3'>Basic Information</p>
                <div className='grid grid-cols-[1em_1fr] sm:grid-cols-[8rem_1fr] gap-y-2.5 text-[#363636]'>
                    <p className='font-medium'>Gender:</p>
                    {isEdit
                        ? <select className='max-w-24 bg-gray-50 px-2 py-0.5 rounded border outline-none' onChange={(e) => setUserData(prev => ({ ...prev, gender: e.target.value }))} value={userData.gender}>
                            <option value="Not Selected">Not Selected</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                        : <p className='text-gray-500'>{userData.gender}</p>
                    }
                    <p className='font-medium'>Birthday:</p>
                    {isEdit
                        ? <input className='max-w-36 bg-gray-50 px-2 py-0.5 rounded border outline-none' type='date' onChange={(e) => setUserData(prev => ({ ...prev, dob: e.target.value }))} value={userData.dob || ''} />
                        : <p className='text-gray-500'>{userData.dob}</p>
                    }
                </div>
            </div>

            <div className='mt-10'>
                {isEdit
                    ? <button onClick={updateUserProfileData} className='border border-primary px-8 py-2 rounded-full hover:bg-primary hover:text-white transition-all duration-300 font-medium text-gray-700'>Save Information</button>
                    : <button onClick={() => setIsEdit(true)} className='border border-primary px-8 py-2 rounded-full hover:bg-primary hover:text-white transition-all duration-300 font-medium text-gray-700'>Edit</button>
                }
            </div>
        </div>
    ) : (
        <div className='min-h-[60vh] flex items-center justify-center'>
            <div className="w-12 h-12 border-4 border-gray-300 border-t-primary rounded-full animate-spin"></div>
        </div>
    )
}

export default MyProfile