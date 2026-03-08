const { customAlphabet } = require('nanoid');

// Generate room codes with only uppercase letters and numbers
// Excludes confusing characters: 0, O, I, 1
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const generateRoomCode = () => {
  return nanoid();
};

module.exports = { generateRoomCode };
