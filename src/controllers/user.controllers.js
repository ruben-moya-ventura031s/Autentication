const catchError = require('../utils/catchError');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const sendEmail = require('../utils/sendEmail');
const EmailCode = require('../models/EmailCode');
const jwt = require('jsonwebtoken');

const getAll = catchError(async(req, res) => {
    const results = await User.findAll();
    return res.json(results);
});

const create = catchError(async(req, res) => {
    const { email, password, firstName, lastName, country, image, frontBaseUrl } = req.body;
    const encriptedPassword = await bcrypt.hash(password, 10);
    const result = await User.create({email, password: encriptedPassword, firstName, lastName, country, image});

    const code = require('crypto').randomBytes(64).toString('hex'); 
    const link = `${frontBaseUrl}/${code}`;

    await EmailCode.create({ code, userId: result.id });

    await sendEmail({
      to: email,
      subject: 'Verify email for user app',
      html: `
        <h1>Hola ${firstName} ${lastName}</h1>
        <p><a href="${link}">${link}</a></p>
        <p><b>Code: </b> ${code}</p>
        <b>Gracias por iniciar sesión en user app</b>
      `
    });

    return res.status(201).json(result);
});



const getOne = catchError(async(req, res) => {
    const { id } = req.params;
    const result = await User.findByPk(id);
    if(!result) return res.sendStatus(404);
    return res.json(result);
});

const remove = catchError(async(req, res) => {
    const { id } = req.params;
    await User.destroy({ where: {id} });
    return res.sendStatus(204);
});

const update = catchError(async(req, res) => {
    const { id } = req.params;
    const { email, firstName, lastName, country, image } = req.body;
    const result = await User.update(
      { email, firstName, lastName, country, image },
        { where: {id}, returning: true }
    );
    if(result[0] === 0) return res.sendStatus(404);
    return res.json(result[1][0]);
});

const verifyEmail = catchError(async(req, res) => {
    const { code } = req.params;
    const emailCode = await EmailCode.findOne({
         where: {code: code} });
         if(!emailCode) return res.status(401).json({ message: 'Invalid code' });
         const user = await User.update({ isVerified: true }, { where: {id: emailCode.userId}, returning: true });
        await EmailCode.destroy({ where: {id: emailCode.id} });

    return res.json(user) ;
});

const login = catchError(async(req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ where: {email: email} });
    if(!user) return res.status(401).json({ message: 'Invalid credentials' });
    const isValid = await bcrypt.compare(password, user.password);
    if(!isValid) return res.status(401).json({ message: 'Invalid credentials' });
    if(user.isVerified === false) return res.status(401).json({ message: 'Please verify your email'});

    const token = jwt.sign({ user }, process.env.TOKEN_SECRET, { expiresIn: "1d" });
    return res.json({ user, token });

});

const getLoggerUser = catchError(async(req, res) => {
    return res.json(req.user);
});

const resetPassword = catchError(async(req, res) => {
    const { email, frontBaseUrl } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid email' });

 const code = require('crypto').randomBytes(64).toString('hex');    
    const link = `${frontBaseUrl}/${code}`;
    await EmailCode.create({ code, userId: user.id });

    await sendEmail({
        to: email,
        subject: 'Reset Password',
        html: `
            <h1>Reset Password</h1>
            <p>Click the link below to reset your password:</p>
            <p><a href="${link}">${link}</a></p>
        `
    });

    return res.sendStatus(200);
});

const resetPasswordConfirm = catchError(async(req, res) => {
    const { code } = req.params;
    const { password } = req.body;

    const emailCode = await EmailCode.findOne({ where: { code } });
    if (!emailCode) return res.status(401).json({ message: 'Invalid code' });

    const encriptedPassword = await bcrypt.hash(password, 10);
    await User.update({ password: encriptedPassword }, { where: { id: emailCode.userId } });
    await EmailCode.destroy({ where: { id: emailCode.id } });

    return res.sendStatus(200);
});

module.exports = {
    getAll,
    create,
    getOne,
    remove,
    update,
    verifyEmail,
    login,
    getLoggerUser,
    resetPassword,
    resetPasswordConfirm
}