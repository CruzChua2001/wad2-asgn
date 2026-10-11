const { supabase } = require("../lib/supabase");

const signedInUser = async (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
        return res.status(401).json({ error: "Please log in first." });
    }
    req.user = data.user;

    next();
};

const optionalUser = async (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
        const { data } = await supabase.auth.getUser(token);
        req.user = data.user;
    }

    next();
}

module.exports = { signedInUser, optionalUser };