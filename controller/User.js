const { Category } = require('../model/Category');
const { User } = require('../model/User');

exports.createAdmin = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Use the static method from the User model to create an admin
    const admin = await User.createAdmin(email, password, name);
    
    res.status(201).json({
      id: admin.id,
      email: admin.email,
      role: admin.role
    });
  } catch (err) {
    if (err.message === 'Admin already exists') {
      return res.status(400).json({ message: 'Admin already exists' });
    }
    res.status(500).json({ message: 'Error creating admin', error: err.message });
  }
};

exports.fetchUserById = async (req, res) => {
  const { id } = req.user;
  console.log(id)
  try {
    const user = await User.findById(id);
    res.status(200).json({id:user.id,addresses:user.addresses,email:user.email,role:user.role});
  } catch (err) {
    res.status(400).json(err);
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json(err);
  }
};
