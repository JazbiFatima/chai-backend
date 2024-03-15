import {assyncHandler} from "../utils/assyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";

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
})

export {registerUser}