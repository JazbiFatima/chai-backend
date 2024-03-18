import {assyncHandler} from "../utils/assyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import Jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});
        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access And Refresh Tokens");
    }
}
const registerUser = assyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists : username, email
    // check for images, check for avatar
    // upload them on cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token fields from response
    // check for user creation
    // return response
    const {fullName, email, username,  password} = req.body;
    /* const user = await User.create({
        username,
        email,
        password
    }) */

    //validation code
    /* if (fullName === "") {
        throw new ApiError(400, "fullName cannot be empty");        
    } */
    if([fullName, email, username, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [ {username}, {email} ]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files?.coverImage[0]?.path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    const user = await User.create({
        fullName,
        email,
        username: username.toLowerCase(),
        password,
        avatar: avatar?.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    res.status(201).json({
        success: true,
        data: createdUser
    })

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while creating user");
        
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User created successfully")
    )
});

const loginUser = assyncHandler( async (req, res) => {
    // get user data from req body
    // validation - not empty
    // username or email 
    // find the user
    // check password
    // access and refresh token
    // send cookie
    // return response

    const {email, username, password} = req.body;

    if(!email && !username) {
        throw new ApiError(400, "email or username are required");
    }

    const user = await User.findOne({
        $or: [{email}, {username}]
    })

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);
    
    const logedInUser = await User.findById(user._id).select("-password -refreshToken");
    
    const options = {
        httpOnly: true,
        secure: true,
    }
    // define like this, cookie will be modify only by server

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
            user: logedInUser, accessToken, refreshToken
            },
            "User LogedIn Successfully"
        )
    )
    
});

const logOutUser = assyncHandler( async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
        $unset: {
            refreshToken: 1 // this removes the field from the document
        }
    },
    {
        new: true,
    })

    const options = {
        httpOnly: true,
        secure: true,
    }
    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json( new ApiResponse(200, {}, "User LoggedOut Successfully") )
});

const refreshAccessToken = assyncHandler( async (req, res) => {
    const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if(!incommingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = Jwt.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id);
        if(!user) {
            throw new ApiError(404, "Invalid refresh token");
        }
    
        if (incommingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }
    
        const options = {
            httpOnly: true,
            secure: true,
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json( new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access Token Refreshed Successfully") )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
        
    }
})

const changeCurrentPassword = assyncHandler( async (req, res) => {
    const {oldPassword, newPassword, confirmNewPassword} = req.body;
    if(newPassword !== confirmNewPassword) {
        throw new ApiError(400, "Passwords do not match");
    }
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }
    user.password = newPassword
    await user.save({validateBeforeSave: false})
    return res.status(200).json( new ApiResponse(200, {}, "Password Changed Successfully") )
})

const getCurrentUser = assyncHandler( async (req, res) => {
    return res.status(200).json( new ApiResponse(200, req.user, "Current user fetched successfully") )
})

const UpdateAccountDetails = assyncHandler( async (req, res) => {
    const {fullName, email} = req.body;
    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {
                fullName,
                email
            }
        },
        {
            new: true,  // returns information after update
            runValidators: true
        }).select("-password");
    return res.status(200).json( new ApiResponse(200, req.user, "Account Details Updated Successfully") )
})

const updateUserAvatar = assyncHandler( async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!updateUserAvatar) {
        throw new ApiError(400, "Avatar file not found");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar) {
        throw new ApiError(400, "Error while uploading Avatar");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {
                avatar: avatar?.url
            }
        },
        {
            new: true,  // returns information after update
        }).select("-password");
        // todo: create function to delete old avatar in utility folder
    return res.status(200).json( new ApiResponse(200, user, "Avatar Updated Successfully") )

})

const updateCoverImage = assyncHandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file not found");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage) {
        throw new ApiError(400, "Error while uploading Cover Image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {
                coverImage: coverImageLocalPath
            }
        },
        {
            new: true,  // returns information after update
        }).select("-password");
    return res.status(200).json( new ApiResponse(200, user, "Cover Image Updated Successfully") )
});

const getUserChannelProfile = assyncHandler( async (req,res) => {
    const {username} = req.params
    if(!username?.trim()) {
        throw new ApiError(404, "Username not found")
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "Subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "SubscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$Subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$SubscribedTo"
                },
                isSubscribed: {
                    if: {$in: [req.user?._id, "$Subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);

    if(!channel?.length) {
        throw new ApiError(404, "Channel doesn't exists");
    }

    console.log(channel);

    return res.status(200).json( new ApiResponse(200, channel[0], "User channel fetched successfully") )
});

const getWatchHistory = assyncHandler( async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                videos: 1
            }
        }
    ])

    return res.status(200).json( new ApiResponse(200, user[0].watchHistory, "User watch history fetched successfully") )
});

export {
    registerUser, 
    loginUser, 
    logOutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    UpdateAccountDetails,
    updateUserAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
}