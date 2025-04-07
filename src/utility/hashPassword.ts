import crypto from "crypto";

// Function to hash a password
export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex"); // Generate a random salt
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return `${hash}.${salt}`; // Concatenate hash and salt with a dot
};

// Function to compare a password with its hash
export const comparePassword = (password, hashedPassword) => {
  const [hash, salt] = hashedPassword.split("."); // Split the concatenated string
  const computedHash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return hash === computedHash;
};
