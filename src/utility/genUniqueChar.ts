const { customAlphabet } = require("nanoid");

// Define the alphabet containing only numbers
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Define the function to generate IDs
export const genNumericId = customAlphabet(alphabet, 6);
