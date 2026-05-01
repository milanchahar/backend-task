const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')


const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body
        
        const hassedpassword = await bcrypt.hash(password, 10)
        
        const user = await prisma.user.create(
            { data: name, email, password: hassedpassword })
        
        res.status(201).json({
            message: 'user created succesfully',
                userid = user.id
            })
    } catch (error) {
        if (error.code === 'P2002') {
            res.status(400).json({ message: 'email already exists' })
        }
        res.status(500).json({ message: 'user creation failed' })
    }
}



const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body
        
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
                return res.status(404).json({message : 'user not found'})
        }
        const isMatrch = await bcrypt.compare(password, user.password)
        if (!isMatrch) {
                return res.status(400).json({message : 'invalid credentials'})
        }
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
        res.json({ token })

    }
    catch (error) {
        res.status(500).json({ message: 'login failed' })
    }   

}

module.exports={
    registerUser,
    loginUser
}

