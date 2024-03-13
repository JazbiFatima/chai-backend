import {assyncHandler} from "../utils/assyncHandler.js";

const registerUser = assyncHandler( async (req, res) => {
    res.status(200).json({
        message: "ok"
    })

})

export {registerUser}