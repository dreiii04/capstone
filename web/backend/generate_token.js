const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });

const secret = process.env.JWT_SECRET || 'supersecretverifitor123';
const token = jwt.sign(
    { id: 'a72c0617-3670-491c-b894-a8355d7504ca', email: 'sysadmin@verifitor.com', role: 'super admin' },
    secret,
    { expiresIn: '1h' }
);

console.log(token);
